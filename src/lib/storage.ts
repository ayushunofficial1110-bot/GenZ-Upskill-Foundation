/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { GoogleDriveStorageProvider } from './googleDriveStorage';
import { BackblazeB2StorageProvider, R2StorageProvider } from './backblazeStorage';

export { BackblazeB2StorageProvider, R2StorageProvider };

export interface StorageUploadResult {
  path: string;
  provider: 'local' | 'googledrive' | 'b2' | 'backblaze';
  publicUrl?: string;
  sizeBytes: number;
  driveFileId?: string;
  driveViewLink?: string;
  driveDownloadLink?: string;
  b2Key?: string;
}

export interface IStorageProvider {
  name: string;
  uploadRecording(
    interviewId: string,
    fileBuffer: Buffer,
    mimeType: string,
    candidateInfo?: {
      candidateName?: string;
      domain?: string;
      durationSeconds?: number;
      existingDriveFileId?: string;
      existingObjectKey?: string;
      reqStartTime?: number;
    }
  ): Promise<StorageUploadResult>;
  getSignedUrl(storagePath: string, expiresInSeconds?: number): Promise<string>;
  getStream(storagePath: string): Promise<NodeJS.ReadableStream | null>;
  deleteRecording(storagePath: string): Promise<boolean>;
}

/**
 * Local Filesystem Storage Provider (Default local & fallback).
 * Stores files securely inside the private `uploads/recordings` directory.
 */
export class LocalStorageProvider implements IStorageProvider {
  name = 'local';
  private uploadDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.join(process.cwd(), 'uploads', 'recordings');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadRecording(
    interviewId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
    const filename = `${interviewId}_${Date.now()}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, fileBuffer);

    return {
      path: filename,
      provider: 'local',
      sizeBytes: fileBuffer.length,
    };
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    // Return internal proxy endpoint for authenticated HR playback
    return `/api/admin/interviews/stream/${encodeURIComponent(storagePath)}`;
  }

  async getStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    const fullPath = path.join(this.uploadDir, path.basename(storagePath));
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.createReadStream(fullPath);
  }

  async deleteRecording(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.uploadDir, path.basename(storagePath));
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete recording:', e);
      return false;
    }
  }
}

/**
 * Factory that initializes active storage provider.
 * Priority:
 * 1. Backblaze B2 Storage Provider (if B2_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_NAME are set)
 * 2. Google Drive Storage Provider (if Google OAuth or Service Account is configured)
 * 3. Local Filesystem fallback
 */
export function getStorageProvider(): IStorageProvider {
  const b2KeyId = (process.env.B2_KEY_ID || '').trim();
  const b2AppKey = (process.env.B2_APPLICATION_KEY || '').trim();
  const b2Bucket = (process.env.B2_BUCKET_NAME || '').trim();

  if (b2KeyId && b2AppKey && b2Bucket) {
    console.log('[Storage] 🟢 Initializing Backblaze B2 Storage Provider (S3-compatible)...');
    return new BackblazeB2StorageProvider();
  }

  return new GoogleDriveStorageProvider();
}

