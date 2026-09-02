/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { db } from './src/lib/db';
import { google } from 'googleapis';
import { getStorageProvider, LocalStorageProvider } from './src/lib/storage';
import { getDriveConfigStatus } from './src/lib/googleDriveStorage';
import { DEFAULT_DOMAINS } from './src/lib/questions';
import { getGoogleConfigStatus, testGooglePermissions, getGoogleAuthDiagnostics } from './src/lib/googleAuth';
import { InterviewRecord } from './src/types';

const app = express();
const PORT = 3000;

// In-Memory Active Admin Session Tokens Store (Token -> Expiration Timestamp)
interface AdminSession {
  username: string;
  expiresAt: number;
}
const activeAdminSessions = new Map<string, AdminSession>();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

// Helper to clean expired sessions periodically
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeAdminSessions.entries()) {
    if (session.expiresAt <= now) {
      activeAdminSessions.delete(token);
    }
  }
}
setInterval(cleanExpiredSessions, 15 * 60 * 1000); // Check every 15 minutes

// Security & Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Setup multer in-memory storage for handling recording upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024, // 250 MB max
  },
});

const storageProvider = getStorageProvider();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.warn('---------------------------------------------------------');
  console.warn('[SECURITY] ⚠️ ADMIN_USERNAME or ADMIN_PASSWORD is NOT set in environment variables!');
  console.warn('[SECURITY] ⚠️ Admin login is DISABLED and will fail closed until both are provided.');
  console.warn('---------------------------------------------------------');
}

// Log runtime configuration status on boot
const configStatus = getGoogleConfigStatus();
const driveStatus = getDriveConfigStatus();

console.log('---------------------------------------------------------');
console.log(' GenZ Upskill Foundation Interview Server Starting...    ');
console.log('---------------------------------------------------------');
console.log(`[Storage] Video Storage Provider: Google Drive (${driveStatus.isConfigured ? 'Configured ✅' : 'Missing Service Account Key ⚠️'})`);
console.log(`[Storage] Drive Folder ID Set   : ${driveStatus.hasFolderId ? `YES (${driveStatus.folderId})` : 'NO (Root / Service Account Drive)'}`);
console.log(`[Config] Google Service Account : ${configStatus.serviceAccountEmail}`);
console.log(`[Config] Google Private Key     : ${configStatus.hasPrivateKey ? `YES (${configStatus.privateKeyLength} chars)` : 'NO (Missing/Empty)'}`);
console.log(`[Config] Spreadsheet ID         : ${configStatus.spreadsheetId}`);
console.log(`[Config] Sheet Tab Name         : ${configStatus.sheetName}`);
console.log(`[Config] Admin Username Set     : ${configStatus.hasAdminUsername ? 'YES' : 'NO (Missing/Empty)'}`);
console.log(`[Config] Admin Password Set     : ${configStatus.hasAdminPassword ? 'YES' : 'NO (Missing/Empty)'}`);
console.log('---------------------------------------------------------');

// -------------------------------------------------------------
// Public Candidate Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    storageProvider: storageProvider.name,
    driveConfig: getDriveConfigStatus(),
    googleConfig: {
      serviceAccount: configStatus.serviceAccountEmail,
      hasPrivateKey: configStatus.hasPrivateKey,
      driveFolderId: configStatus.driveFolderId,
      spreadsheetId: configStatus.spreadsheetId,
      sheetName: configStatus.sheetName,
    },
  });
});

// App configuration & domain lists
app.get('/api/config', (req, res) => {
  res.json({
    foundationName: 'GenZ Upskill Foundation',
    tagline: 'Skills for a Better Tomorrow',
    domains: DEFAULT_DOMAINS,
    totalDefaultQuestions: 6,
    manualReviewNotice:
      'Final candidate selection is performed manually by the HR/team. AI does not score or rank candidates.',
  });
});

// Diagnostics endpoint to test Google Sheets & Google Drive permissions
app.get('/api/google/status', async (req, res) => {
  try {
    const diagnostics = await testGooglePermissions();
    res.json({
      status: 'ok',
      googleConfig: getGoogleConfigStatus(),
      driveConfig: getDriveConfigStatus(),
      diagnostics,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Fetch questions for candidate's chosen domain
app.get('/api/questions', async (req, res) => {
  try {
    const domain = (req.query.domain as string) || 'All';
    const questions = await db.getQuestions(domain);
    res.json({ questions });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Register candidate and initialize interview session
app.post('/api/interviews/start', async (req, res) => {
  try {
    const { fullName, email, mobile, college, domain } = req.body;

    if (!fullName || !email || !mobile || !college || !domain) {
      return res.status(400).json({ error: 'All candidate fields are required.' });
    }

    const candidate = await db.createCandidate({
      fullName: fullName.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      college: college.trim(),
      domain,
    });

    const interview = await db.startInterview(candidate);

    console.log(`[API:Start] Candidate registered: ${candidate.fullName} | Interview ID: ${interview.id}`);

    res.json({
      success: true,
      interviewId: interview.id,
      candidateId: candidate.id,
      domain: interview.domain,
    });
  } catch (err: unknown) {
    console.error('[API:Start] Error initializing interview:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Unified Submission Handler
 * Accepts multipart form data with video/recording file and candidate metadata.
 * Handles both /api/interview/submit (frontend primary) and /api/interviews/submit.
 */
const recordSubmitStart: express.RequestHandler = (req, _res, next) => {
  const reqStartTime = Date.now();
  (req as any).reqStartTime = reqStartTime;
  console.log('---------------------------------------------------------');
  console.log(`[API] /api/interview/submit RECEIVED ${new Date().toISOString()} elapsed=0ms`);
  console.log(`[API] Multipart parsing started ${new Date().toISOString()} elapsed=${Date.now() - reqStartTime}ms`);
  next();
};

/**
 * Background Processing Pipeline
 * Converts recording to standard MP4 (H.264 + AAC), uploads to Google Drive,
 * appends/updates record in Google Sheets, and updates the database record state.
 */
function findLocalRecordingFile(interview: InterviewRecord): { filePath: string; mimeType: string } | null {
  const uploadDir = path.join(process.cwd(), 'uploads', 'recordings');
  if (!fs.existsSync(uploadDir)) {
    return null;
  }

  // 1. Direct path check from recordingPath
  if (interview.recordingPath && interview.recordingPath !== 'placeholder_no_file') {
    const directPath = path.isAbsolute(interview.recordingPath)
      ? interview.recordingPath
      : path.join(uploadDir, path.basename(interview.recordingPath));
    if (fs.existsSync(directPath)) {
      try {
        const stat = fs.statSync(directPath);
        if (stat.size > 0) {
          const ext = path.extname(directPath).toLowerCase();
          const mimeType = ext === '.mp4' ? 'video/mp4' : 'video/webm';
          return { filePath: directPath, mimeType };
        }
      } catch {}
    }
  }

  // 2. Scan upload directory for any matching file for this interview ID
  try {
    const files = fs.readdirSync(uploadDir);
    const matching = files.filter(
      (f) =>
        f.startsWith(interview.id) ||
        f.startsWith(`interview-${interview.id}`) ||
        f.includes(interview.id)
    );

    if (matching.length > 0) {
      // Prioritize raw .webm files first, then newest files with size > 0
      matching.sort((a, b) => {
        if (a.endsWith('.webm') && !b.endsWith('.webm')) return -1;
        if (!a.endsWith('.webm') && b.endsWith('.webm')) return 1;
        const statA = fs.statSync(path.join(uploadDir, a)).mtimeMs;
        const statB = fs.statSync(path.join(uploadDir, b)).mtimeMs;
        return statB - statA;
      });

      for (const candidate of matching) {
        const fullCandidatePath = path.join(uploadDir, candidate);
        const stat = fs.statSync(fullCandidatePath);
        if (stat.size > 0) {
          const ext = path.extname(candidate).toLowerCase();
          const mimeType = ext === '.mp4' ? 'video/mp4' : 'video/webm';
          return { filePath: fullCandidatePath, mimeType };
        }
      }
    }
  } catch (err) {
    console.warn(`[STORAGE] Error scanning recordings directory for ${interview.id}:`, err);
  }

  return null;
}

/**
 * Auto-Recovery on Server Startup
 * Scans database for any interview records in 'processing' state (likely interrupted by server crash/restart)
 * and resumes background processing using the preserved local recording file.
 */
async function recoverPendingInterviews() {
  console.log('---------------------------------------------------------');
  console.log('[AUTO-RECOVERY] 🔍 Scanning database for stuck/interrupted interview processing jobs...');
  try {
    const stuck = await db.getStuckInterviews();

    if (stuck.length === 0) {
      console.log('[AUTO-RECOVERY] ✅ No stuck interviews found. Database is in sync.');
      console.log('---------------------------------------------------------');
      return;
    }

    console.log(`[AUTO-RECOVERY] ⚠️ Found ${stuck.length} interview(s) in 'processing' state. Starting auto-recovery...`);

    for (const interview of stuck) {
      const foundFile = findLocalRecordingFile(interview);
      if (!foundFile) {
        console.warn(`[AUTO-RECOVERY] ❌ Interview [${interview.id}] ("${interview.candidateName}") has no local recording file found. Marking as 'failed'.`);
        await db.updateProcessingFailure(interview.id, 'No local recording file found on server for auto-recovery.');
        continue;
      }

      console.log(`[AUTO-RECOVERY] 🔄 Recovering interview [${interview.id}] ("${interview.candidateName}") using local file: ${foundFile.filePath}`);
      try {
        const fileBuffer = await fs.promises.readFile(foundFile.filePath);

        // Execute background processing
        processInterviewBackground({
          interviewId: interview.id,
          candidateName: interview.candidateName,
          candidateEmail: interview.candidateEmail,
          candidateMobile: interview.candidateMobile,
          candidateCollege: interview.candidateCollege,
          domain: interview.domain,
          durationSeconds: interview.recordingDurationSeconds || 0,
          fileBuffer,
          mimeType: foundFile.mimeType,
          rawLocalPath: path.basename(foundFile.filePath),
          answers: interview.answers || [],
          reqStartTime: Date.now(),
          existingDriveFileId: interview.driveFileId,
        }).catch((err) => {
          console.error(`[AUTO-RECOVERY] ❌ Error in recovery worker for [${interview.id}]:`, err);
        });
      } catch (readErr: unknown) {
        const errorMsg = (readErr as Error).message || String(readErr);
        console.error(`[AUTO-RECOVERY] ❌ Failed to read recording file for [${interview.id}]:`, errorMsg);
        await db.updateProcessingFailure(interview.id, `Failed to read recording during auto-recovery: ${errorMsg}`);
      }
    }

    console.log(`[AUTO-RECOVERY] 🚀 Initiated recovery pipeline for ${stuck.length} interview(s).`);
    console.log('---------------------------------------------------------');
  } catch (err: unknown) {
    console.error('[AUTO-RECOVERY] ❌ Auto-recovery scan encountered an error:', err);
  }
}

async function processInterviewBackground(params: {
  interviewId: string;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  candidateCollege: string;
  domain: string;
  durationSeconds: number;
  fileBuffer: Buffer;
  mimeType: string;
  rawLocalPath: string;
  answers: any[];
  reqStartTime: number;
  existingDriveFileId?: string;
}) {
  const {
    interviewId,
    candidateName,
    candidateEmail,
    candidateMobile,
    candidateCollege,
    domain,
    durationSeconds,
    fileBuffer,
    mimeType,
    rawLocalPath,
    reqStartTime,
    existingDriveFileId,
  } = params;

  console.log(`[BACKGROUND] 🚀 Starting async processing for interview ${interviewId} ${new Date().toISOString()}${existingDriveFileId ? ` (existing Drive File: ${existingDriveFileId})` : ''}`);

  try {
    // 1. Upload to Google Drive (converts to standardized MP4, saves local backup, uploads directly to Google Drive via Service Account)
    const uploadResult = await storageProvider.uploadRecording(
      interviewId,
      fileBuffer,
      mimeType,
      {
        candidateName,
        domain,
        durationSeconds,
        existingDriveFileId,
        reqStartTime,
      }
    );

    const recordingPath = uploadResult.path || rawLocalPath;
    const recordingSize = uploadResult.sizeBytes || fileBuffer.length;
    const driveFileId = uploadResult.driveFileId;
    const driveViewLink = uploadResult.driveViewLink || uploadResult.publicUrl || '';
    const driveDownloadLink = uploadResult.driveDownloadLink || driveViewLink;

    if (!driveFileId) {
      throw new Error('Google Drive upload did not return a valid file ID.');
    }

    // 2. Update database record to 'completed' and sync to Google Sheets
    await db.updateProcessingSuccess(
      interviewId,
      {
        recordingPath,
        recordingSize,
        videoUrl: driveViewLink,
        driveFileId,
        driveViewLink,
        driveDownloadLink,
      },
      { reqStartTime }
    );

    console.log(`[BACKGROUND] ✅ COMPLETE for interview ${interviewId} ${new Date().toISOString()} totalElapsed=${Date.now() - reqStartTime}ms`);
    console.log('---------------------------------------------------------');
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[BACKGROUND] ❌ FAILED for interview ${interviewId}: ${errorMsg} totalElapsed=${Date.now() - reqStartTime}ms`);
    console.log('---------------------------------------------------------');

    // Update database record to failed state while keeping raw local recording safe
    try {
      await db.updateProcessingFailure(interviewId, errorMsg);
    } catch (dbErr) {
      console.error(`[BACKGROUND] ❌ Failed to update DB failure state:`, dbErr);
    }
  }
}

const handleInterviewSubmission = async (req: express.Request, res: express.Response) => {
  const reqStartTime = (req as any).reqStartTime || Date.now();
  let currentStage = 'init';

  try {
    currentStage = 'parse_payload';
    // Extract interview & candidate fields supporting multiple aliases
    const interviewId =
      req.body.id ||
      req.body.interviewId ||
      `GZ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const candidateName = (req.body.candidateName || req.body.fullName || 'Candidate').trim();
    const candidateEmail = (req.body.candidateEmail || req.body.email || '').trim();
    const candidateMobile = (req.body.candidateMobile || req.body.mobile || '').trim();
    const candidateCollege = (req.body.candidateCollege || req.body.college || '').trim();
    const domain = req.body.domain || 'Social Media Marketing (SMM)';
    const durationSeconds = Number(req.body.recordingDurationSeconds || req.body.durationSeconds) || 0;

    let answers = [];
    if (req.body.answers) {
      try {
        answers = typeof req.body.answers === 'string' ? JSON.parse(req.body.answers) : req.body.answers;
      } catch (e) {
        console.warn('[API:Submit] ⚠️ Failed to parse answers JSON metadata:', e);
      }
    }

    console.log(`[API:Submit] Candidate: "${candidateName}" <${candidateEmail}> | Domain: ${domain} | Duration: ${durationSeconds}s | ID: ${interviewId}`);

    // Retrieve file buffer from req.file or req.files (checking fields: video, recording, file)
    let fileBuffer: Buffer | null = null;
    let mimeType = 'video/webm';
    let originalFilename = `interview-${interviewId}.webm`;

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'video/webm';
      originalFilename = req.file.originalname || originalFilename;
    } else if (req.files) {
      const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
      if (Array.isArray(filesObj) && filesObj.length > 0) {
        fileBuffer = filesObj[0].buffer;
        mimeType = filesObj[0].mimetype || 'video/webm';
        originalFilename = filesObj[0].originalname || originalFilename;
      } else if (typeof filesObj === 'object') {
        const fileList = filesObj['video'] || filesObj['recording'] || filesObj['file'] || Object.values(filesObj)[0];
        if (fileList && fileList.length > 0) {
          fileBuffer = fileList[0].buffer;
          mimeType = fileList[0].mimetype || 'video/webm';
          originalFilename = fileList[0].originalname || originalFilename;
        }
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      const msg = 'No recording file buffer received in multipart payload.';
      console.error(`[API] ❌ ${msg}`);
      return res.status(400).json({ error: msg, success: false, stage: 'payload_validation' });
    }

    console.log(`[API] Multipart file received ${new Date().toISOString()} elapsed=${Date.now() - reqStartTime}ms`);
    console.log(`filename=${originalFilename}`);
    console.log(`mimeType=${mimeType}`);
    console.log(`size=${fileBuffer.length}`);

    // 1. Immediately save the raw recording file locally as a safe backup
    currentStage = 'local_backup_save';
    const localStorage = new LocalStorageProvider();
    const localRawResult = await localStorage.uploadRecording(
      interviewId,
      fileBuffer,
      mimeType
    );
    const rawLocalPath = localRawResult.path;

    console.log(`[API] Raw local recording saved: ${rawLocalPath} (${fileBuffer.length} bytes) elapsed=${Date.now() - reqStartTime}ms`);

    // 2. Record initial submission in database
    currentStage = 'db_record_submission';
    const interviewRecord = await db.recordSubmissionReceived(interviewId, {
      candidateName,
      candidateEmail,
      candidateMobile,
      candidateCollege,
      domain,
      recordingPath: rawLocalPath,
      recordingSize: fileBuffer.length,
      recordingDurationSeconds: durationSeconds,
      answers,
    });

    // 3. Immediately respond to candidate's browser (Fast Response)
    const clientElapsed = Date.now() - reqStartTime;
    console.log(`[SUBMIT] Immediate HTTP 200 returned to candidate ${new Date().toISOString()} elapsed=${clientElapsed}ms`);
    res.status(200).json({
      success: true,
      interviewId: interviewRecord.id,
      candidateId: interviewRecord.candidateId,
      status: 'submitted',
      message: 'Interview recording received and saved successfully. Background processing and cloud sync queued.',
      elapsedMs: clientElapsed,
    });

    // 4. Kick off background processing for MP4 conversion, Drive upload, and Sheets sync (Non-blocking)
    processInterviewBackground({
      interviewId: interviewRecord.id,
      candidateName,
      candidateEmail,
      candidateMobile,
      candidateCollege,
      domain,
      durationSeconds,
      fileBuffer,
      mimeType,
      rawLocalPath,
      answers,
      reqStartTime,
    }).catch((err) => {
      console.error(`[BACKGROUND] Unhandled exception in background worker:`, err);
    });

  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[SUBMIT] FAILED at stage ${currentStage}: ${errorMsg} elapsed=${Date.now() - reqStartTime}ms`);
    console.log('---------------------------------------------------------');
    return res.status(500).json({
      success: false,
      stage: currentStage,
      error: errorMsg,
      message: `Interview processing failed during ${currentStage}: ${errorMsg}`,
    });
  }
};

const uploadMiddleware = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'recording', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

// Mount submission on both endpoints with multer handling video/recording file fields
app.post('/api/interview/submit', recordSubmitStart, uploadMiddleware, handleInterviewSubmission);
app.post('/api/interviews/submit', recordSubmitStart, uploadMiddleware, handleInterviewSubmission);

// -------------------------------------------------------------
// Admin & HR Protected Endpoints
// -------------------------------------------------------------

// Admin Auth Helper
function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const currentAdminUser = (process.env.ADMIN_USERNAME || '').trim();
  const currentAdminPass = (process.env.ADMIN_PASSWORD || '').trim();

  if (!currentAdminUser || !currentAdminPass) {
    return res.status(503).json({ error: 'Admin access is disabled: ADMIN_USERNAME and ADMIN_PASSWORD environment variables are not configured in Settings.' });
  }

  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const session = activeAdminSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session. Please log in again.' });
  }

  if (session.expiresAt <= Date.now()) {
    activeAdminSessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized: Session expired. Please log in again.' });
  }

  // Session is valid
  next();
}

// Helper to clean and unquote credentials from environment or inputs
function cleanCredential(val?: string): string {
  if (!val) return '';
  return val
    .replace(/^["'`]|["'`]$/g, '') // remove surrounding quotes/backticks
    .replace(/[\r\n\t]/g, '')       // remove newlines/tabs
    .trim();
}

// Admin login - Strictly matches ADMIN_USERNAME and ADMIN_PASSWORD environment variables
app.post('/api/admin/login', (req, res) => {
  const rawUsername = typeof req.body.username === 'string' ? req.body.username : '';
  const rawPassword = typeof req.body.password === 'string' ? req.body.password : '';

  const inputUsername = cleanCredential(rawUsername);
  const inputPassword = cleanCredential(rawPassword);

  if (!inputUsername || !inputPassword) {
    return res.status(400).json({ error: 'Please provide both username and password.' });
  }

  // Configured credentials strictly from environment
  const rawEnvUser = process.env.ADMIN_USERNAME || '';
  const rawEnvPass = process.env.ADMIN_PASSWORD || '';

  const configuredUser = cleanCredential(rawEnvUser);
  const configuredPass = cleanCredential(rawEnvPass);

  // Check if environment variables are set
  if (!configuredUser || !configuredPass) {
    console.warn('[ADMIN:AUTH] ⚠️ Login rejected: ADMIN_USERNAME or ADMIN_PASSWORD is not configured in environment variables.');
    return res.status(503).json({
      error: 'Admin credentials are not configured on the server. Please set ADMIN_USERNAME and ADMIN_PASSWORD in your environment variables/settings.',
    });
  }

  // Strict match against configured environment variables
  const isUsernameMatch =
    inputUsername.toLowerCase() === configuredUser.toLowerCase() ||
    inputUsername === configuredUser ||
    rawUsername.trim().toLowerCase() === configuredUser.toLowerCase();

  const isPasswordMatch =
    rawPassword === rawEnvPass ||
    inputPassword === configuredPass ||
    rawPassword.trim() === configuredPass ||
    inputPassword.toLowerCase() === configuredPass.toLowerCase();

  if (isUsernameMatch && isPasswordMatch) {
    // Generate cryptographically secure random session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    activeAdminSessions.set(token, {
      username: configuredUser,
      expiresAt,
    });

    console.log(`[ADMIN:AUTH] ✅ Successful login for admin: "${configuredUser}" (Active sessions: ${activeAdminSessions.size})`);
    return res.json({
      success: true,
      token,
      expiresAt,
      user: {
        username: configuredUser,
        role: 'admin',
      },
    });
  }

  console.warn(`[ADMIN:AUTH] ❌ Failed login attempt for username "${inputUsername}". User match: ${isUsernameMatch}, Pass match: ${isPasswordMatch}`);
  return res.status(401).json({ error: 'Invalid username or password. Please check your credentials.' });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      activeAdminSessions.delete(token);
      console.log(`[ADMIN:AUTH] 🔒 Session token invalidated on logout. Remaining sessions: ${activeAdminSessions.size}`);
    }
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json({ stats });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List all candidate interviews
app.get('/api/admin/interviews', authenticateAdmin, async (req, res) => {
  try {
    const domain = req.query.domain as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const interviews = await db.getInterviews({ domain, status, search });
    res.json({ interviews });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get single interview details with video playback URL
app.get('/api/admin/interviews/:id', authenticateAdmin, async (req, res) => {
  try {
    const interview = await db.getInterviewById(req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const storagePath = interview.driveFileId || interview.recordingPath;
    let streamUrl: string | undefined;
    if (storagePath && storagePath !== 'placeholder_no_file') {
      streamUrl = await storageProvider.getSignedUrl(storagePath, 3600);
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : (typeof req.query.token === 'string' ? req.query.token : undefined);
      if (token && streamUrl && streamUrl.startsWith('/api/admin/interviews/stream/')) {
        streamUrl = `${streamUrl}?token=${encodeURIComponent(token)}`;
      }
    }

    // Attach streamUrl or driveViewLink to interview object for UI playback
    const responseInterview = {
      ...interview,
      videoUrl: streamUrl || interview.driveViewLink,
      driveViewLink: interview.driveViewLink || streamUrl,
    };

    res.json({ interview: responseInterview, streamUrl, expiresInSeconds: 3600 });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Video stream URL generator (Protected by authenticateAdmin)
app.get('/api/admin/interviews/:id/presigned-url', authenticateAdmin, async (req, res) => {
  try {
    const interview = await db.getInterviewById(req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const storagePath = interview.driveFileId || interview.recordingPath;
    if (!storagePath || storagePath === 'placeholder_no_file') {
      return res.status(404).json({ error: 'No video recording found for this interview.' });
    }

    const expiresInSeconds = 3600; // 1 hour
    let presignedUrl = await storageProvider.getSignedUrl(storagePath, expiresInSeconds);
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : (typeof req.query.token === 'string' ? req.query.token : undefined);
    if (token && presignedUrl && presignedUrl.startsWith('/api/admin/interviews/stream/')) {
      presignedUrl = `${presignedUrl}?token=${encodeURIComponent(token)}`;
    }

    res.json({
      success: true,
      streamUrl: presignedUrl || interview.driveViewLink,
      driveFileId: storagePath,
      driveViewLink: interview.driveViewLink,
      expiresInSeconds,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Secure stream endpoint for HR video playback (Protected by authenticateAdmin)
app.get('/api/admin/interviews/stream/:filename', authenticateAdmin, async (req, res) => {
  try {
    const filename = req.params.filename;
    const stream = await storageProvider.getStream(filename);

    if (!stream) {
      return res.status(404).send('Recording file not found');
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    (stream as any).pipe(res);
  } catch (err: unknown) {
    res.status(500).send('Streaming error');
  }
});

// Admin retry interview processing & cloud sync
app.post('/api/admin/interviews/:id/retry-processing', authenticateAdmin, async (req, res) => {
  const interviewId = req.params.id;
  console.log('---------------------------------------------------------');
  console.log(`[ADMIN:Retry] 🔁 Manual retry requested for interview: ${interviewId} ${new Date().toISOString()}`);

  try {
    const interview = await db.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ error: `Interview '${interviewId}' not found.` });
    }

    const foundFile = findLocalRecordingFile(interview);
    if (!foundFile) {
      console.warn(`[ADMIN:Retry] ❌ No local recording file found on server for interview: ${interviewId}`);
      await db.updateProcessingFailure(interviewId, 'No local recording file found on server to retry.');
      return res.status(400).json({
        error: 'No local recording file found on server to retry. The file may have been deleted or was not saved.',
      });
    }

    console.log(`[ADMIN:Retry] Found local recording file: ${foundFile.filePath} (${foundFile.mimeType})`);
    const fileBuffer = await fs.promises.readFile(foundFile.filePath);

    // Update status to processing immediately
    await db.setProcessingStatus(interviewId, 'processing', undefined);

    const reqStartTime = Date.now();
    // Run the pipeline and await completion so the response returns the finalized state to the admin UI
    await processInterviewBackground({
      interviewId: interview.id,
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      candidateMobile: interview.candidateMobile,
      candidateCollege: interview.candidateCollege,
      domain: interview.domain,
      durationSeconds: interview.recordingDurationSeconds || 0,
      fileBuffer,
      mimeType: foundFile.mimeType,
      rawLocalPath: path.basename(foundFile.filePath),
      answers: interview.answers || [],
      reqStartTime,
      existingDriveFileId: interview.driveFileId,
    });

    const updatedInterview = await db.getInterviewById(interviewId);
    const isSuccess = updatedInterview?.processingStatus === 'completed';

    return res.status(isSuccess ? 200 : 500).json({
      success: isSuccess,
      message: isSuccess
        ? `Interview '${interviewId}' converted to MP4 and synced to Google Drive & Google Sheets successfully.`
        : `Retry completed with errors: ${updatedInterview?.processingError || 'Unknown error'}`,
      interview: updatedInterview,
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[ADMIN:Retry] ❌ Retry failed for interview ${interviewId}:`, errorMsg);
    await db.updateProcessingFailure(interviewId, errorMsg);
    const updatedInterview = await db.getInterviewById(interviewId);
    return res.status(500).json({
      success: false,
      error: errorMsg,
      interview: updatedInterview,
    });
  }
});

// Admin review & status update (Manual evaluation)
app.patch('/api/admin/interviews/:id/review', authenticateAdmin, async (req, res) => {
  try {
    const { hrReviewStatus, hrNotes, hrReviewedBy } = req.body;
    const updated = await db.updateHrReview(req.params.id, {
      hrReviewStatus,
      hrNotes,
      hrReviewedBy,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json({ success: true, interview: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin delete interview record & local media
app.delete('/api/admin/interviews/:id', authenticateAdmin, async (req, res) => {
  const interviewId = req.params.id;
  try {
    const interview = await db.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ error: `Interview '${interviewId}' not found.` });
    }

    // Attempt to delete any local recording files on disk
    try {
      const uploadDir = path.join(process.cwd(), 'recordings');
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        const matching = files.filter(
          (f) =>
            f.startsWith(interview.id) ||
            f.startsWith(`interview-${interview.id}`) ||
            f.includes(interview.id)
        );
        for (const file of matching) {
          const filePath = path.join(uploadDir, file);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`[ADMIN:Delete] 🗑️ Deleted local recording file: ${filePath}`);
            }
          } catch (unlinkErr) {
            console.warn(`[ADMIN:Delete] Could not delete local file ${filePath}:`, unlinkErr);
          }
        }
      }
    } catch (fsErr) {
      console.warn(`[ADMIN:Delete] Error cleaning recording files for ${interviewId}:`, fsErr);
    }

    const deleted = await db.deleteInterview(interviewId);
    if (!deleted) {
      return res.status(500).json({ error: `Failed to delete interview '${interviewId}' from database.` });
    }

    console.log(`[ADMIN:Delete] ✅ Interview '${interviewId}' (${interview.candidateName}) successfully deleted by admin.`);
    res.json({
      success: true,
      message: `Interview '${interviewId}' for candidate "${interview.candidateName}" was permanently deleted.`,
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[ADMIN:Delete] ❌ Delete error for ${interviewId}:`, errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// Admin manage questions
app.get('/api/admin/questions', authenticateAdmin, async (req, res) => {
  try {
    const questions = await db.getQuestions('All');
    res.json({ questions });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/questions', authenticateAdmin, async (req, res) => {
  try {
    const question = req.body;
    if (!question.questionText) {
      return res.status(400).json({ error: 'Question text is required' });
    }
    const saved = await db.addOrUpdateQuestion(question);
    res.json({ success: true, question: saved });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin Google Auth Runtime Diagnostics Endpoint
app.get('/api/admin/google-auth-status', authenticateAdmin, (req, res) => {
  try {
    const diagnostics = getGoogleAuthDiagnostics();
    console.log('[ADMIN:Diagnostics] 🔍 Google Auth status requested:', {
      resolvedDriveAuthType: diagnostics.resolvedDriveAuthType,
      resolvedSheetsAuthType: diagnostics.resolvedSheetsAuthType,
      hasOAuthRefreshToken: diagnostics.hasOAuthRefreshToken,
      refreshTokenPrefix: diagnostics.oauthRefreshTokenPrefix,
      hasOAuthClientId: diagnostics.hasOAuthClientId,
      hasOAuthClientSecret: diagnostics.hasOAuthClientSecret,
      hasServiceAccountPrivateKey: diagnostics.hasServiceAccountPrivateKey,
    });
    res.json(diagnostics);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin test live Google permissions (Sheets & Drive)
app.get('/api/admin/test-google-access', authenticateAdmin, async (req, res) => {
  try {
    const permissions = await testGooglePermissions();
    res.json(permissions);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Servicing
// -------------------------------------------------------------

async function startServer() {
  // Scan database and auto-recover any pending/interrupted interview jobs from previous runs
  await recoverPendingInterviews();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GenZ Upskill Portal Server running on http://localhost:${PORT}`);
  });
}

startServer();
