/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { GoogleDriveStorageProvider } from './googleDriveStorage';

export interface StorageUploadResult {
  path: string;
  provider: 'local' | 'googledrive';
  publicUrl?: string;
  sizeBytes: number;
  driveFileId?: string;
  driveViewLink?: string;
  driveDownloadLink?: string;
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
 * Defaults to GoogleDriveStorageProvider (Google Drive via Service Account) with local filesystem fallback.
 */
export function getStorageProvider(): IStorageProvider {
  return new GoogleDriveStorageProvider();
}

