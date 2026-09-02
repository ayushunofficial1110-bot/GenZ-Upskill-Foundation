/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { getGoogleAuthClient, getGoogleConfigStatus } from './googleAuth';
import { IStorageProvider, StorageUploadResult, LocalStorageProvider } from './storage';
import { convertToStandardMp4 } from './videoConverter';

export interface DriveConfigStatus {
  isConfigured: boolean;
  hasServiceAccount: boolean;
  hasPrivateKey: boolean;
  folderId: string;
  hasFolderId: boolean;
  serviceAccountEmail: string;
}

export function getDriveConfigStatus(): DriveConfigStatus {
  const googleConfig = getGoogleConfigStatus();
  return {
    isConfigured: Boolean(googleConfig.hasPrivateKey && googleConfig.serviceAccountEmail),
    hasServiceAccount: Boolean(googleConfig.serviceAccountEmail),
    hasPrivateKey: googleConfig.hasPrivateKey,
    folderId: googleConfig.driveFolderId,
    hasFolderId: googleConfig.hasDriveFolderId,
    serviceAccountEmail: googleConfig.serviceAccountEmail,
  };
}

/**
 * Google Drive Storage Provider
 * Direct server-side upload to Google Drive using Google Service Account credentials.
 * Preserves candidate interview video as real playable video file (video/mp4 or video/webm).
 */
export class GoogleDriveStorageProvider implements IStorageProvider {
  name = 'googledrive';
  private folderId?: string;
  private localBackupProvider: LocalStorageProvider;

  constructor(folderId?: string) {
    this.folderId = folderId || (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim() || undefined;
    this.localBackupProvider = new LocalStorageProvider();
  }

  async uploadRecording(
    interviewId: string,
    fileBuffer: Buffer,
    mimeType: string,
    candidateInfo?: {
      candidateName?: string;
      domain?: string;
      durationSeconds?: number;
      existingDriveFileId?: string;
      reqStartTime?: number;
    }
  ): Promise<StorageUploadResult> {
    const startTime = candidateInfo?.reqStartTime || Date.now();
    console.log(
      `[GoogleDrive] 🚀 Initiating Google Drive video upload for [${interviewId}] (Raw size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB, type: ${mimeType})`
    );

    // 1. Convert video to standardized MP4 (H.264/AAC + faststart) for universal browser & Drive playback
    let finalBuffer = fileBuffer;
    let finalMimeType = mimeType || 'video/webm';
    let extension = '.webm';

    try {
      const conversionResult = await convertToStandardMp4(fileBuffer, {
        interviewId,
        candidateName: candidateInfo?.candidateName,
        declaredDurationSeconds: candidateInfo?.durationSeconds,
      });
      finalBuffer = conversionResult.buffer;
      finalMimeType = 'video/mp4';
      extension = '.mp4';
      console.log(
        `[GoogleDrive] 🎬 Video standardized to MP4: ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB`
      );
    } catch (convErr) {
      console.warn(
        `[GoogleDrive] ⚠️ MP4 conversion warning, uploading original format (${mimeType}):`,
        (convErr as Error).message
      );
      if (mimeType.includes('mp4')) {
        extension = '.mp4';
        finalMimeType = 'video/mp4';
      } else {
        extension = '.webm';
        finalMimeType = 'video/webm';
      }
    }

    // 2. Save local disk backup for instant zero-latency admin streaming and recovery
    let localSavedPath = '';
    try {
      const localResult = await this.localBackupProvider.uploadRecording(
        interviewId,
        finalBuffer,
        finalMimeType
      );
      localSavedPath = localResult.path;
      console.log(`[GoogleDrive] 💾 Saved local backup file: ${localSavedPath}`);
    } catch (localErr) {
      console.warn('[GoogleDrive] ⚠️ Notice: Local backup write error:', (localErr as Error).message);
    }

    // 3. Authenticate with Google Service Account
    const auth = getGoogleAuthClient();
    if (!auth) {
      const errorMsg =
        'Google Service Account authentication unavailable. Please ensure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set.';
      console.error(`[GoogleDrive] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const drive = google.drive({ version: 'v3', auth });

    // 4. Construct descriptive filename: CandidateName_CandidateID_Interview_Date.mp4
    const cleanCandidateName = (candidateInfo?.candidateName || 'Candidate')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const cleanId = (interviewId || 'ID').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const driveFilename = `${cleanCandidateName}_${cleanId}_Interview_${dateStr}${extension}`;

    const targetFolderId = this.folderId || (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim() || undefined;

    console.log(
      `[GoogleDrive] 📤 Uploading "${driveFilename}" to Google Drive (Folder: ${targetFolderId || 'Root / Service Account Drive'})...`
    );

    // 5. Upload file directly to Google Drive
    const fileMetadata: { name: string; parents?: string[] } = {
      name: driveFilename,
    };

    if (targetFolderId) {
      fileMetadata.parents = [targetFolderId];
    }

    const media = {
      mimeType: finalMimeType,
      body: Readable.from(finalBuffer),
    };

    let driveFileId: string | undefined;
    let driveViewLink: string | undefined;
    let driveDownloadLink: string | undefined;

    // Check if we can update an existing file ID for idempotency/retry
    const existingFileId = candidateInfo?.existingDriveFileId;
    let uploadSuccess = false;

    if (existingFileId && !existingFileId.startsWith('placeholder') && !existingFileId.includes('/')) {
      try {
        console.log(`[GoogleDrive] 🔄 Updating existing Drive file: ${existingFileId}`);
        const updateRes = await drive.files.update({
          fileId: existingFileId,
          media,
          fields: 'id, name, webViewLink, webContentLink, size',
          supportsAllDrives: true,
        });

        driveFileId = updateRes.data.id || existingFileId;
        driveViewLink = updateRes.data.webViewLink || undefined;
        driveDownloadLink = updateRes.data.webContentLink || undefined;
        uploadSuccess = true;
        console.log(`[GoogleDrive] ✅ Updated existing Drive file: ${driveFileId}`);
      } catch (updateErr) {
        console.warn(
          `[GoogleDrive] ⚠️ Could not update existing file [${existingFileId}], creating new file instead:`,
          (updateErr as Error).message
        );
      }
    }

    if (!uploadSuccess) {
      const createRes = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, webContentLink, size',
        supportsAllDrives: true,
      });

      driveFileId = createRes.data.id || undefined;
      driveViewLink = createRes.data.webViewLink || undefined;
      driveDownloadLink = createRes.data.webContentLink || undefined;
    }

    if (!driveFileId) {
      throw new Error('Google Drive upload did not return a valid file ID');
    }

    // Fallback URL generation if webViewLink / webContentLink were omitted by API
    if (!driveViewLink) {
      driveViewLink = `https://drive.google.com/file/d/${driveFileId}/view?usp=drivesdk`;
    }
    if (!driveDownloadLink) {
      driveDownloadLink = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
    }

    console.log(
      `[GoogleDrive] ✅ Successfully uploaded to Google Drive in ${Date.now() - startTime}ms!`
    );
    console.log(`[GoogleDrive] 🆔 Drive File ID : ${driveFileId}`);
    console.log(`[GoogleDrive] 🔗 View Link     : ${driveViewLink}`);

    return {
      path: localSavedPath || driveFilename,
      provider: 'googledrive',
      sizeBytes: finalBuffer.length,
      driveFileId,
      driveViewLink,
      driveDownloadLink,
      publicUrl: driveViewLink,
    };
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    if (!storagePath || storagePath === 'placeholder_no_file') {
      return '';
    }

    // If storagePath is a Google Drive file ID (alphanumeric ID), return proxy or drive link
    if (!storagePath.includes('/') && !storagePath.includes('\\')) {
      // Return streaming proxy URL for authenticated dashboard playback
      return `/api/admin/interviews/stream/${encodeURIComponent(storagePath)}`;
    }

    return `/api/admin/interviews/stream/${encodeURIComponent(path.basename(storagePath))}`;
  }

  async getStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    // 1. Try local backup first for highest performance & zero egress
    const localStream = await this.localBackupProvider.getStream(storagePath);
    if (localStream) {
      return localStream;
    }

    // 2. Stream directly from Google Drive API using service account
    const auth = getGoogleAuthClient();
    if (!auth) return null;

    try {
      const drive = google.drive({ version: 'v3', auth });
      const response = await drive.files.get(
        {
          fileId: storagePath,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'stream' }
      );

      return response.data as unknown as NodeJS.ReadableStream;
    } catch (driveErr) {
      console.error(`[GoogleDrive] ❌ Failed to stream file [${storagePath}] from Google Drive:`, driveErr);
      return null;
    }
  }

  async deleteRecording(storagePath: string): Promise<boolean> {
    let deletedLocal = false;
    let deletedDrive = false;

    // Delete local copy
    try {
      deletedLocal = await this.localBackupProvider.deleteRecording(storagePath);
    } catch (e) {
      // Ignored
    }

    // Delete Google Drive copy
    const auth = getGoogleAuthClient();
    if (auth && !storagePath.includes('/') && !storagePath.includes('\\')) {
      try {
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.delete({
          fileId: storagePath,
          supportsAllDrives: true,
        });
        deletedDrive = true;
      } catch (e) {
        console.warn(`[GoogleDrive] ⚠️ Notice deleting Drive file [${storagePath}]:`, (e as Error).message);
      }
    }

    return deletedLocal || deletedDrive;
  }
}
