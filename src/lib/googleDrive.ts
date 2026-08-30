/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import {
  getGoogleDriveAuthClient,
  getGoogleDriveOAuthClient,
  DEFAULT_DRIVE_FOLDER_ID,
} from './googleAuth';
import { IStorageProvider, StorageUploadResult, LocalStorageProvider } from './storage';
import { convertToStandardMp4 } from './videoConverter';

export class GoogleDriveStorageProvider implements IStorageProvider {
  name = 'googledrive';
  private folderId: string;
  private localBackupProvider: LocalStorageProvider;

  constructor(folderId?: string) {
    this.folderId =
      folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
    this.localBackupProvider = new LocalStorageProvider();
  }

  /**
   * Uploads an interview recording video to Google Drive.
   * Converts the candidate's browser recording to universal MP4 (H.264 + AAC)
   * so it displays a video icon, plays smoothly in Google Drive, and is downloadable.
   */
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
    const rawSize = fileBuffer.length;
    const statedDuration = candidateInfo?.durationSeconds || 0;

    const startTime = (candidateInfo as any)?.reqStartTime || Date.now();

    // 1. Convert video to standard MP4 (H.264/AAC with +faststart)
    console.log(`[VIDEO] Conversion started ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
    const conversion = await convertToStandardMp4(fileBuffer, {
      interviewId,
      declaredDurationSeconds: statedDuration,
      candidateName: candidateInfo?.candidateName,
    });

    const finalBuffer = conversion.buffer;
    const finalMimeType = 'video/mp4';
    const finalExtension = '.mp4';
    const processedDurationSeconds = conversion.durationSeconds;

    console.log(`[VIDEO] Conversion completed ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
    console.log(`inputSize=${rawSize}`);
    console.log(`outputSize=${finalBuffer.length}`);
    console.log(`inputDuration=${statedDuration}`);
    console.log(`outputDuration=${processedDurationSeconds}`);

    // 2. Save local backup copy
    const localResult = await this.localBackupProvider.uploadRecording(
      interviewId,
      finalBuffer,
      finalMimeType
    );

    // 3. Authenticate with Google Drive
    const auth = getGoogleDriveAuthClient();
    const isOAuth = Boolean(getGoogleDriveOAuthClient());

    if (!auth) {
      const msg = 'Google Drive OAuth credentials are not initialized or inactive.';
      console.error(`[DRIVE] ❌ ${msg}`);
      throw new Error(msg);
    }

    try {
      console.log(`[DRIVE] Upload started ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
      const drive = google.drive({ version: 'v3', auth: auth as any });

      const cleanName = (candidateInfo?.candidateName || 'Candidate')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 35);
      const cleanDomain = (candidateInfo?.domain || 'General')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 25);
      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');

      const fileName = `GenZ_Interview_${cleanName}_${cleanDomain}_${interviewId}_${timestampStr}${finalExtension}`;
      const streamBody = Readable.from(finalBuffer);

      const existingFileId = candidateInfo?.existingDriveFileId;
      let fileId: string | null | undefined = existingFileId;
      let driveFile: any = null;

      if (existingFileId) {
        console.log(
          `[GoogleDrive] 🔄 Updating existing Drive file [${existingFileId}] for interview [${interviewId}]...`
        );
        try {
          const updateResponse = await drive.files.update({
            fileId: existingFileId,
            requestBody: {
              name: fileName,
              mimeType: finalMimeType,
              description: `GenZ Upskill Foundation Interview Recording | Candidate: ${candidateInfo?.candidateName || 'N/A'} | Domain: ${candidateInfo?.domain || 'N/A'} | Duration: ${processedDurationSeconds}s | Interview ID: ${interviewId}`,
              properties: {
                interviewId,
                candidateName: candidateInfo?.candidateName || '',
                domain: candidateInfo?.domain || '',
                durationSeconds: String(processedDurationSeconds),
                updatedAt: new Date().toISOString(),
                mediaFormat: finalMimeType,
              },
            },
            media: {
              mimeType: finalMimeType,
              body: streamBody,
            },
            fields: 'id, name, mimeType, webViewLink, webContentLink, size, videoMediaMetadata',
            supportsAllDrives: true,
          });

          driveFile = updateResponse.data;
          fileId = driveFile.id;
        } catch (updateErr: unknown) {
          console.warn(
            `[GoogleDrive] ⚠️ Failed to update existing Drive file [${existingFileId}], creating new file instead:`,
            (updateErr as Error)?.message || updateErr
          );
          fileId = null;
        }
      }

      // If no existing file ID or update failed, create a new file
      if (!fileId || !driveFile) {
        console.log(
          `[GoogleDrive] 📤 Streaming MP4 "${fileName}" (${finalMimeType}, ${(finalBuffer.length / 1024).toFixed(1)} KB) to Drive folder [${this.folderId}] via ${isOAuth ? 'User OAuth2' : 'Service Account'}...`
        );

        const createResponse = await drive.files.create({
          requestBody: {
            name: fileName,
            mimeType: finalMimeType, // EXPLICIT video/mp4
            parents: [this.folderId],
            description: `GenZ Upskill Foundation Interview Recording | Candidate: ${candidateInfo?.candidateName || 'N/A'} | Domain: ${candidateInfo?.domain || 'N/A'} | Duration: ${processedDurationSeconds}s | Interview ID: ${interviewId}`,
            properties: {
              interviewId,
              candidateName: candidateInfo?.candidateName || '',
              domain: candidateInfo?.domain || '',
              durationSeconds: String(processedDurationSeconds),
              uploadedAt: new Date().toISOString(),
              mediaFormat: finalMimeType,
            },
          },
          media: {
            mimeType: finalMimeType, // EXPLICIT video/mp4
            body: Readable.from(finalBuffer),
          },
          fields: 'id, name, mimeType, webViewLink, webContentLink, size, videoMediaMetadata',
          supportsAllDrives: true,
        });

        driveFile = createResponse.data;
        fileId = driveFile.id;
      }

      if (!fileId) {
        throw new Error('Google Drive API response did not contain a valid file ID.');
      }

      const viewLink =
        driveFile.webViewLink ||
        `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;

      console.log(`[DRIVE] Upload completed ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
      console.log(`fileId=${driveFile.id}`);
      console.log(`name=${driveFile.name}`);
      console.log(`mimeType=${driveFile.mimeType}`);
      console.log(`size=${driveFile.size || finalBuffer.length}`);
      console.log(`webViewLink=${viewLink}`);

      // Attempt to set reader permissions asynchronously without blocking the upload flow
      drive.permissions
        .create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true,
        })
        .catch((permErr) => {
          console.warn('[DRIVE] ⚠️ Non-blocking permission set notice:', (permErr as Error)?.message || permErr);
        });

      return {
        path: localResult.path,
        provider: 'googledrive',
        publicUrl: viewLink,
        sizeBytes: finalBuffer.length,
        driveFileId: fileId,
        driveViewLink: viewLink,
        driveDownloadLink: driveFile.webContentLink || undefined,
      };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || String(err);
      console.error(
        `[DRIVE] ❌ Google Drive upload FAILED for interview ${interviewId}:`,
        errorMsg
      );
      throw new Error(`Google Drive upload failed: ${errorMsg}`);
    }
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    return this.localBackupProvider.getSignedUrl(storagePath);
  }

  async getStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    return this.localBackupProvider.getStream(storagePath);
  }

  async deleteRecording(storagePath: string): Promise<boolean> {
    return this.localBackupProvider.deleteRecording(storagePath);
  }
}
