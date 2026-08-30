/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { GoogleDriveStorageProvider } from './googleDrive';

export interface StorageUploadResult {
  path: string;
  provider: 'local' | 'supabase' | 'googledrive';
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
 * Supabase Storage Provider (Modular wrapper for Supabase Private Bucket).
 */
export class SupabaseStorageProvider implements IStorageProvider {
  name = 'supabase';
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private bucketName: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, bucketName: string = 'interview-recordings') {
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
    this.bucketName = bucketName;
  }

  async uploadRecording(
    interviewId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
    const filePath = `${interviewId}/${Date.now()}${ext}`;

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${filePath}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed with status ${response.status}`);
    }

    return {
      path: filePath,
      provider: 'supabase',
      sizeBytes: fileBuffer.length,
    };
  }

  async getSignedUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
    const signUrl = `${this.supabaseUrl}/storage/v1/object/sign/${this.bucketName}/${storagePath}`;
    const response = await fetch(signUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate Supabase signed URL');
    }

    const data = (await response.json()) as { signedURL?: string };
    return `${this.supabaseUrl}/storage/v1${data.signedURL}`;
  }

  async getStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    const signed = await this.getSignedUrl(storagePath, 300);
    const resp = await fetch(signed);
    if (!resp.ok || !resp.body) return null;
    // Return readable stream
    return resp.body as unknown as NodeJS.ReadableStream;
  }

  async deleteRecording(storagePath: string): Promise<boolean> {
    const delUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}`;
    const response = await fetch(delUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [storagePath] }),
    });
    return response.ok;
  }
}

/**
 * Factory that initializes active storage provider based on environment variables.
 * Defaults to GoogleDriveStorageProvider with fallback to local filesystem / Supabase.
 */
export function getStorageProvider(): IStorageProvider {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (supabaseUrl && serviceKey) {
    return new SupabaseStorageProvider(supabaseUrl, serviceKey);
  }

  // Use GoogleDriveStorageProvider as default enterprise storage provider
  return new GoogleDriveStorageProvider();
}
