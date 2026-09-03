/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { B2StorageProvider, BackblazeB2StorageProvider, R2StorageProvider } from './b2Storage';

export { B2StorageProvider, BackblazeB2StorageProvider, R2StorageProvider };

export interface StorageUploadResult {
  path: string;
  provider: 'local' | 'b2' | 'backblaze';
  publicUrl?: string;
  sizeBytes: number;
  driveFileId?: string; // Kept for backwards-compatible DB schema mapping (stores B2 object key)
  driveViewLink?: string; // Kept for backwards-compatible DB schema mapping (empty for private B2)
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
 * Local Filesystem Storage Provider (Fallback when B2 is not configured).
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
      driveFileId: filename,
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
 * 2. Local Filesystem Provider (Fallback)
 * 
 * Note: Google Drive is completely deprecated and removed for video storage.
 */
export function getStorageProvider(): IStorageProvider {
  const b2KeyId = (process.env.B2_KEY_ID || '').trim();
  const b2AppKey = (process.env.B2_APPLICATION_KEY || '').trim();
  const b2Bucket = (process.env.B2_BUCKET_NAME || '').trim();

  if (b2KeyId && b2AppKey && b2Bucket) {
    console.log('[Storage] 🟢 Initializing Backblaze B2 Storage Provider (S3-compatible)...');
    return new B2StorageProvider();
  }

  console.warn(
    '[Storage] ⚠️ Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME) not fully set. Falling back to Local Disk Storage.'
  );
  return new LocalStorageProvider();
}
