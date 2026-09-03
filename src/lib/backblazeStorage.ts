/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getAwsSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { IStorageProvider, StorageUploadResult, LocalStorageProvider } from './storage';
import { convertToStandardMp4 } from './videoConverter';

export interface B2ConfigStatus {
  isConfigured: boolean;
  hasKeyId: boolean;
  keyIdLength: number;
  hasApplicationKey: boolean;
  hasBucketName: boolean;
  bucketName: string;
  hasEndpoint: boolean;
  endpoint: string;
  region: string;
}

/**
 * Normalizes string values from environment variables by removing wrapping quotes, whitespace, and newlines.
 */
function cleanEnvString(raw?: string): string {
  if (!raw) return '';
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.substring(1, val.length - 1).trim();
  }
  return val.replace(/[\r\n]+/g, '').trim();
}

/**
 * Normalizes Backblaze B2 S3 endpoint.
 * Backblaze provides endpoints like: s3.us-west-004.backblazeb2.com or https://s3.us-west-004.backblazeb2.com
 */
export function normalizeB2Endpoint(rawEndpoint?: string): string {
  let endpoint = cleanEnvString(rawEndpoint);
  if (!endpoint) {
    return 'https://s3.us-west-004.backblazeb2.com';
  }
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }
  return endpoint.replace(/\/+$/, '');
}

/**
 * Extracts the region from a Backblaze B2 S3 endpoint.
 * Example: https://s3.us-west-004.backblazeb2.com -> us-west-004
 */
export function extractB2Region(endpoint: string): string {
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  if (match && match[1]) {
    return match[1];
  }
  return 'us-west-004';
}

/**
 * Returns summary of runtime Backblaze B2 configuration without exposing secrets.
 */
export function getB2ConfigStatus(): B2ConfigStatus {
  const keyId = cleanEnvString(process.env.B2_KEY_ID);
  const applicationKey = cleanEnvString(process.env.B2_APPLICATION_KEY);
  const bucketName = cleanEnvString(process.env.B2_BUCKET_NAME);
  const rawEndpoint = cleanEnvString(process.env.B2_ENDPOINT);
  const endpoint = normalizeB2Endpoint(rawEndpoint);
  const region = extractB2Region(endpoint);

  const isConfigured = Boolean(keyId && applicationKey && bucketName);

  return {
    isConfigured,
    hasKeyId: Boolean(keyId),
    keyIdLength: keyId.length,
    hasApplicationKey: Boolean(applicationKey),
    hasBucketName: Boolean(bucketName),
    bucketName,
    hasEndpoint: Boolean(rawEndpoint),
    endpoint,
    region,
  };
}

/**
 * Backblaze B2 Storage Provider (S3-Compatible Object Storage)
 * 
 * High-reliability server-side video upload to Backblaze B2.
 * - S3-compatible client using B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT
 * - Presigned URLs for private admin-only video access (expires in 1 hour)
 * - NO permanent public URLs (all bucket objects are private)
 * - Retry idempotency checking for existing object key before re-upload
 * - Local filesystem backup for instant zero-latency recovery
 */
export class BackblazeB2StorageProvider implements IStorageProvider {
  name = 'backblaze';
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private endpoint: string;
  private region: string;
  private localBackupProvider: LocalStorageProvider;

  constructor() {
    const keyId = cleanEnvString(process.env.B2_KEY_ID);
    const applicationKey = cleanEnvString(process.env.B2_APPLICATION_KEY);
    this.bucketName = cleanEnvString(process.env.B2_BUCKET_NAME);
    this.endpoint = normalizeB2Endpoint(process.env.B2_ENDPOINT);
    this.region = extractB2Region(this.endpoint);
    this.localBackupProvider = new LocalStorageProvider();

    if (keyId && applicationKey && this.bucketName) {
      try {
        this.s3Client = new S3Client({
          endpoint: this.endpoint,
          region: this.region,
          credentials: {
            accessKeyId: keyId,
            secretAccessKey: applicationKey,
          },
          // Backblaze B2 S3-compatible API supports path-style requests reliably
          forcePathStyle: true,
        });
        console.log(
          `[Backblaze B2] ✅ Initialized B2 S3 Client (Endpoint: ${this.endpoint}, Region: ${this.region}, Bucket: ${this.bucketName})`
        );
      } catch (initErr) {
        console.error('[Backblaze B2] ❌ Failed to initialize S3 client:', (initErr as Error).message);
        this.s3Client = null;
      }
    } else {
      console.warn(
        '[Backblaze B2] ⚠️ Missing credentials: B2_KEY_ID, B2_APPLICATION_KEY, or B2_BUCKET_NAME not fully set.'
      );
    }
  }

  /**
   * Helper to verify if the S3 client is initialized.
   */
  private getClient(): S3Client {
    if (!this.s3Client) {
      throw new Error(
        'Backblaze B2 is not configured. Please ensure B2_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_NAME are set.'
      );
    }
    return this.s3Client;
  }

  /**
   * Uploads candidate interview recording to Backblaze B2.
   * Includes idempotency check before re-upload.
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
      existingObjectKey?: string;
      reqStartTime?: number;
    }
  ): Promise<StorageUploadResult> {
    const client = this.getClient();
    console.log(
      `[Backblaze B2] 🚀 Initiating video upload for [${interviewId}] (Raw size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB, type: ${mimeType})`
    );

    // 1. Standardize video to MP4 (H.264/AAC + faststart)
    let finalBuffer = fileBuffer;
    let finalMimeType = mimeType || 'video/mp4';
    let extension = '.mp4';

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
        `[Backblaze B2] 🎬 Video standardized to MP4: ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB`
      );
    } catch (convErr) {
      console.warn(
        `[Backblaze B2] ⚠️ MP4 conversion notice, uploading original format (${mimeType}):`,
        (convErr as Error).message
      );
      if (mimeType.includes('webm')) {
        extension = '.webm';
        finalMimeType = 'video/webm';
      } else {
        extension = '.mp4';
        finalMimeType = 'video/mp4';
      }
    }

    // 2. Save local disk backup for instant zero-latency recovery
    try {
      await this.localBackupProvider.uploadRecording(
        interviewId,
        finalBuffer,
        finalMimeType
      );
    } catch (localErr) {
      console.warn('[Backblaze B2] ⚠️ Local backup notice:', (localErr as Error).message);
    }

    // 3. Construct canonical object key: recordings/CandidateName_ID_Interview_Date.mp4
    const cleanCandidateName = (candidateInfo?.candidateName || 'Candidate')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const cleanId = (interviewId || 'ID').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];

    const requestedKey = candidateInfo?.existingObjectKey || candidateInfo?.existingDriveFileId;
    const objectKey =
      requestedKey && requestedKey.startsWith('recordings/')
        ? requestedKey
        : `recordings/${cleanCandidateName}_${cleanId}_Interview_${dateStr}${extension}`;

    // 4. RETRY IDEMPOTENCY CHECK: Check if object already exists in B2 bucket before re-uploading
    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        })
      );

      if (head.ContentLength && head.ContentLength > 0) {
        console.log(
          `[Backblaze B2] ⚡ Idempotency hit: Object "${objectKey}" already exists in bucket "${this.bucketName}" (${(head.ContentLength / (1024 * 1024)).toFixed(2)} MB). Skipping re-upload.`
        );
        return {
          path: objectKey,
          provider: 'b2',
          sizeBytes: head.ContentLength,
          driveFileId: objectKey,
          driveViewLink: '', // NO permanent public URL; access via presigned URLs only
          driveDownloadLink: '',
          b2Key: objectKey,
        };
      }
    } catch (headErr: any) {
      // 404 / NotFound indicates object does not exist yet; proceed with upload
      if (headErr.name !== 'NotFound' && headErr.$metadata?.httpStatusCode !== 404) {
        console.warn(`[Backblaze B2] Idempotency check status for "${objectKey}":`, headErr.message);
      }
    }

    // 5. Upload object to Backblaze B2 (Private by default; NO permanent public-read ACL)
    console.log(
      `[Backblaze B2] 📤 Uploading "${objectKey}" to bucket "${this.bucketName}" (${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`
    );

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: finalBuffer,
        ContentType: finalMimeType,
        Metadata: {
          interviewId,
          candidateName: cleanCandidateName,
          uploadedAt: new Date().toISOString(),
        },
      })
    );

    console.log(`[Backblaze B2] 🎯 Upload completed successfully! Key: ${objectKey}`);

    return {
      path: objectKey,
      provider: 'b2',
      sizeBytes: finalBuffer.length,
      driveFileId: objectKey,
      driveViewLink: '', // NO permanent public URLs
      driveDownloadLink: '',
      b2Key: objectKey,
    };
  }

  /**
   * Generates a time-limited presigned URL for private, authenticated Admin/HR video playback.
   * NO permanent public URLs are exposed; tokens expire automatically (default: 3600 seconds / 1 hour).
   */
  async getSignedUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
    const client = this.getClient();
    // Normalize storage path to object key
    const objectKey = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const presignedUrl = await getAwsSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });

      console.log(`[Backblaze B2] 🔐 Generated secure presigned URL for "${objectKey}" (expires in ${expiresInSeconds}s)`);
      return presignedUrl;
    } catch (err) {
      console.error(`[Backblaze B2] ❌ Error generating presigned URL for "${objectKey}":`, (err as Error).message);
      // Fallback to internal proxy streaming route if presigning fails
      return `/api/admin/interviews/stream/${encodeURIComponent(path.basename(objectKey))}`;
    }
  }

  /**
   * Streams video content directly from Backblaze B2 (used for internal server streaming fallback).
   */
  async getStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    const objectKey = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;

    // Try fetching directly from Backblaze B2
    if (this.s3Client) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
          })
        );
        if (response.Body) {
          return response.Body as unknown as NodeJS.ReadableStream;
        }
      } catch (b2Err) {
        console.warn(`[Backblaze B2] ⚠️ S3 getStream notice for "${objectKey}":`, (b2Err as Error).message);
      }
    }

    // Fallback to local backup copy if available
    return this.localBackupProvider.getStream(path.basename(objectKey));
  }

  /**
   * Deletes a recording from Backblaze B2.
   */
  async deleteRecording(storagePath: string): Promise<boolean> {
    const client = this.getClient();
    const objectKey = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        })
      );
      console.log(`[Backblaze B2] 🗑️ Deleted object "${objectKey}" from bucket "${this.bucketName}"`);

      // Also clean up local backup if exists
      await this.localBackupProvider.deleteRecording(path.basename(objectKey)).catch(() => {});
      return true;
    } catch (delErr) {
      console.error(`[Backblaze B2] ❌ Error deleting object "${objectKey}":`, (delErr as Error).message);
      return false;
    }
  }
}

/**
 * Backward compatibility alias for Cloudflare R2 migrations.
 */
export class R2StorageProvider extends BackblazeB2StorageProvider {}
