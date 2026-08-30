/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

export interface VideoConversionResult {
  buffer: Buffer;
  mimeType: 'video/mp4';
  extension: '.mp4';
  sizeBytes: number;
  durationSeconds: number;
  originalDurationSeconds: number;
}

/**
 * Validates whether the buffer has valid WebM or MP4 container signatures (EBML/ftyp header).
 */
function isValidVideoContainer(buffer: Buffer): { valid: boolean; reason?: string } {
  if (!buffer || buffer.length < 16) {
    return { valid: false, reason: 'File buffer is too small to contain valid video headers (less than 16 bytes).' };
  }

  // Check for WebM EBML ID (0x1A 0x45 0xDF 0xA3)
  const isWebM = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;

  // Check for ISO MP4 / QuickTime ftyp (bytes 4-7 are 'ftyp' or 'moov')
  const ftypStr = buffer.toString('utf8', 4, 8);
  const isMp4 = ftypStr === 'ftyp' || ftypStr === 'moov' || buffer.toString('utf8', 0, 4) === 'ftyp';

  if (!isWebM && !isMp4) {
    // Check if EBML header might be located within first 64 bytes
    const sub = buffer.subarray(0, Math.min(buffer.length, 64));
    const ebmlIdx = sub.indexOf(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (ebmlIdx === -1) {
      return {
        valid: false,
        reason: 'File does not have a valid WebM (EBML) or MP4 container header signature.',
      };
    }
  }

  return { valid: true };
}

/**
 * Converts any browser recorded video (WebM VP8/VP9, MP4, etc.) to a universally compatible
 * standard MP4 video (H.264 video codec + AAC audio codec with yuv420p pixel format and +faststart flag).
 * This ensures native playback in Google Drive, iOS, Android, and all web browsers.
 */
export async function convertToStandardMp4(
  inputBuffer: Buffer,
  options: {
    interviewId: string;
    declaredDurationSeconds?: number;
    candidateName?: string;
  }
): Promise<VideoConversionResult> {
  const { interviewId, declaredDurationSeconds = 0 } = options;

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('Recording upload was empty — please retry the interview.');
  }

  // 1. Sanity check container signatures
  const containerCheck = isValidVideoContainer(inputBuffer);
  if (!containerCheck.valid) {
    console.warn(`[VideoConverter] ⚠️ Container validation warning for ${interviewId}: ${containerCheck.reason}`);
    // If fewer than 2048 bytes, fail early with clear candidate-friendly message
    if (inputBuffer.length < 2048) {
      throw new Error('Recording upload was incomplete — recording file header was truncated. Please retry the interview.');
    }
  }

  console.log(
    `[VideoConverter] 🎬 Starting MP4 conversion for interview ${interviewId} (Input: ${(inputBuffer.length / 1024).toFixed(1)} KB, declared duration: ${declaredDurationSeconds}s)...`
  );

  if (!ffmpegPath) {
    throw new Error('[VideoConverter] FFmpeg binary was not found via ffmpeg-static.');
  }

  const tmpDir = os.tmpdir();
  const safeId = interviewId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const tempInputPath = path.join(tmpDir, `input_${safeId}_${Date.now()}.webm`);
  const tempOutputPath = path.join(tmpDir, `output_${safeId}_${Date.now()}.mp4`);

  try {
    // Write input buffer to temporary file
    await fs.promises.writeFile(tempInputPath, inputBuffer);

    // Run FFmpeg transcoding with H.264 + AAC + faststart for instant streaming.
    // Use error resilience flags to ignore packet glitches and fps=30 filter to prevent VFR frame duplication explosions.
    const primaryArgs = [
      '-y',
      '-err_detect', 'ignore_err',
      '-fflags', '+genpts+discardcorrupt+nobuffer',
      '-i', tempInputPath,
      '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '24',
      '-max_muxing_queue_size', '4096',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-movflags', '+faststart',
      tempOutputPath,
    ];

    let stderrOutput = '';
    try {
      const { stderr } = await execFileAsync(ffmpegPath, primaryArgs, {
        timeout: 90000, // 90s max timeout for conversion
        maxBuffer: 15 * 1024 * 1024,
      });
      stderrOutput = stderr;
    } catch (primaryErr) {
      console.warn(
        `[VideoConverter] ⚠️ Primary transcode encountered an issue for ${interviewId}, attempting rescue transcode:`,
        (primaryErr as Error)?.message || primaryErr
      );

      // Rescue conversion with ultra-resilient fallback flags
      const fallbackArgs = [
        '-y',
        '-err_detect', 'ignore_err',
        '-fflags', '+genpts+discardcorrupt',
        '-reorder_queue_size', '4096',
        '-i', tempInputPath,
        '-vf', 'fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-max_muxing_queue_size', '4096',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-movflags', '+faststart',
        tempOutputPath,
      ];

      const { stderr } = await execFileAsync(ffmpegPath, fallbackArgs, {
        timeout: 90000,
        maxBuffer: 15 * 1024 * 1024,
      });
      stderrOutput = stderr;
    }

    // Parse duration from FFmpeg stderr output
    let detectedDurationSeconds = declaredDurationSeconds;
    const durationMatch = stderrOutput.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+|\d+)/);
    if (durationMatch) {
      const hours = parseFloat(durationMatch[1]);
      const minutes = parseFloat(durationMatch[2]);
      const seconds = parseFloat(durationMatch[3]);
      const totalSec = hours * 3600 + minutes * 60 + seconds;
      if (totalSec > 0) {
        detectedDurationSeconds = Math.round(totalSec);
      }
    }

    // Read the converted MP4 file
    const convertedBuffer = await fs.promises.readFile(tempOutputPath);
    const convertedSizeBytes = convertedBuffer.length;

    console.log(
      `[VideoConverter] ✅ MP4 conversion complete for ${interviewId}: ` +
      `Output Size: ${(convertedSizeBytes / 1024).toFixed(1)} KB | ` +
      `Duration: ${detectedDurationSeconds}s (Original declared: ${declaredDurationSeconds}s)`
    );

    return {
      buffer: convertedBuffer,
      mimeType: 'video/mp4',
      extension: '.mp4',
      sizeBytes: convertedSizeBytes,
      durationSeconds: detectedDurationSeconds || declaredDurationSeconds,
      originalDurationSeconds: declaredDurationSeconds,
    };
  } catch (err: unknown) {
    const error = err as Error;
    const rawStderr = error.message || String(error);
    console.error(`[VideoConverter] ❌ FFmpeg conversion error for ${interviewId}:`, rawStderr);

    // Format human-friendly, candidate-ready error messages instead of raw stderr dump
    let friendlyMessage = 'Recording upload was incomplete or corrupted — please retry the interview.';
    if (rawStderr.includes('File ended prematurely') || rawStderr.includes('Duration: N/A') || rawStderr.includes('Invalid data found')) {
      friendlyMessage = 'Recording upload was incomplete (file ended prematurely) — please retry the interview.';
    } else if (rawStderr.includes('timeout') || rawStderr.includes('timed out')) {
      friendlyMessage = 'Video conversion timed out due to complex processing — please retry the interview.';
    } else if (rawStderr.includes('No space') || rawStderr.includes('ENOSPC')) {
      friendlyMessage = 'Server storage limit reached during video conversion.';
    }

    throw new Error(friendlyMessage);
  } finally {
    // Safely cleanup temporary files
    try {
      if (fs.existsSync(tempInputPath)) await fs.promises.unlink(tempInputPath);
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tempOutputPath)) await fs.promises.unlink(tempOutputPath);
    } catch {
      // ignore
    }
  }
}
