/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export const DEFAULT_SERVICE_ACCOUNT_EMAIL =
  'genz-interview-storage@genz-upskill-foundation.iam.gserviceaccount.com';
export const DEFAULT_DRIVE_FOLDER_ID = '1kq1nFO4EDC9eXU2jS6oNoAKTr_qaOcCD';
export const DEFAULT_SPREADSHEET_ID = '1q7h2pDNtuF3t7FFsErDcmNURt7YDzKAwYTgLTe04O0k';
export const DEFAULT_SHEET_NAME = 'Candidate_Interviews';

let cachedServiceAccountAuthClient: InstanceType<typeof google.auth.JWT> | null = null;
let cachedDriveOAuth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;

// Read default OAuth Client ID from firebase-applet-config.json if available
let firebaseOAuthClientId = '';
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    firebaseOAuthClientId = parsed.oAuthClientId || '';
  }
} catch {
  // Ignored
}

export interface GoogleConfigStatus {
  serviceAccountEmail: string;
  hasPrivateKey: boolean;
  privateKeyLength: number;
  driveFolderId: string;
  spreadsheetId: string;
  sheetName: string;
  hasAdminUsername: boolean;
  hasAdminPassword: boolean;
  // Drive OAuth2 Status
  hasDriveOAuth: boolean;
  hasOAuthRefreshToken: boolean;
  hasOAuthClientSecret: boolean;
  oAuthClientId: string;
  driveAuthMethod: 'oauth2' | 'service_account' | 'none';
}

/**
 * Returns summary of runtime Google environment variables without exposing private secrets.
 */
export function getGoogleConfigStatus(): GoogleConfigStatus {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

  if (!privateKey && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
      if (parsed.client_email) email = parsed.client_email;
      if (parsed.private_key) privateKey = parsed.private_key;
    } catch {
      // Ignored
    }
  }

  const clientId =
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    firebaseOAuthClientId;
  const clientSecret =
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    '';
  const refreshToken =
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    '';

  const hasOAuthRefreshToken = Boolean(refreshToken && refreshToken.trim().length > 0);
  const hasOAuthClientSecret = Boolean(clientSecret && clientSecret.trim().length > 0);
  const hasDriveOAuth = hasOAuthRefreshToken && Boolean(clientId);

  let driveAuthMethod: 'oauth2' | 'service_account' | 'none' = 'none';
  if (hasDriveOAuth) {
    driveAuthMethod = 'oauth2';
  } else if (privateKey && privateKey.trim().length > 0) {
    driveAuthMethod = 'service_account';
  }

  return {
    serviceAccountEmail: email,
    hasPrivateKey: Boolean(privateKey && privateKey.trim().length > 0),
    privateKeyLength: privateKey ? privateKey.length : 0,
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || DEFAULT_SHEET_NAME,
    hasAdminUsername: Boolean(process.env.ADMIN_USERNAME),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
    hasDriveOAuth,
    hasOAuthRefreshToken,
    hasOAuthClientSecret,
    oAuthClientId: clientId ? `${clientId.substring(0, 16)}...` : '',
    driveAuthMethod,
  };
}

/**
 * Normalizes private key string from various environment variable formats.
 */
function cleanPrivateKey(rawKey: string): string {
  let key = rawKey.trim();

  // Strip wrapping single or double quotes if present
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Replace literal \n with real newline characters
  key = key.replace(/\\n/g, '\n');

  return key;
}

/**
 * Returns a JWT Google Auth client using service account credentials.
 * Used for Google Sheets synchronization and service-account operations.
 */
export function getGoogleAuthClient(): InstanceType<typeof google.auth.JWT> | null {
  if (cachedServiceAccountAuthClient) {
    return cachedServiceAccountAuthClient;
  }

  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  let rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!rawPrivateKey && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
      if (parsed.client_email) email = parsed.client_email;
      if (parsed.private_key) rawPrivateKey = parsed.private_key;
    } catch (e) {
      console.warn('[GoogleAuth] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY_JSON:', (e as Error).message);
    }
  }

  if (!rawPrivateKey || rawPrivateKey.trim() === '') {
    console.warn(
      '[GoogleAuth] ⚠️ GOOGLE_PRIVATE_KEY environment variable is not configured. Google Sheets integration requires GOOGLE_PRIVATE_KEY.'
    );
    return null;
  }

  try {
    const formattedKey = cleanPrivateKey(rawPrivateKey);

    const auth = new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    cachedServiceAccountAuthClient = auth;
    console.log(`[GoogleAuth] ✅ Service Account JWT Authenticated client initialized for: ${email}`);
    return cachedServiceAccountAuthClient;
  } catch (err) {
    console.error('[GoogleAuth] ❌ Failed to initialize Google Auth JWT client:', (err as Error).message);
    return null;
  }
}

/**
 * Returns a Google OAuth2 client configured with user/admin Google account credentials.
 * When uploading with this OAuth2 client, the file is created with the user account's
 * own Google Drive storage quota into the target folder.
 */
export function getGoogleDriveOAuthClient(): InstanceType<typeof google.auth.OAuth2> | null {
  if (cachedDriveOAuth2Client) {
    return cachedDriveOAuth2Client;
  }

  const clientId =
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    firebaseOAuthClientId;

  const clientSecret =
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    '';

  const refreshToken =
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    '';

  const accessToken =
    process.env.GOOGLE_DRIVE_OAUTH_ACCESS_TOKEN ||
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN ||
    '';

  if (!clientId) {
    return null;
  }

  if (!refreshToken && !accessToken) {
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken || undefined,
      access_token: accessToken || undefined,
    });

    cachedDriveOAuth2Client = oauth2Client;
    console.log('[GoogleAuth] ✅ Google Drive OAuth2 Client initialized successfully.');
    return cachedDriveOAuth2Client;
  } catch (err) {
    console.error('[GoogleAuth] ❌ Failed to initialize Google Drive OAuth2 client:', (err as Error).message);
    return null;
  }
}

/**
 * Returns the best authentication client for Google Drive:
 * 1. OAuth2 client (uses user's personal Google account Drive storage quota)
 * 2. Service Account JWT (fallback)
 */
export function getGoogleDriveAuthClient():
  | InstanceType<typeof google.auth.OAuth2>
  | InstanceType<typeof google.auth.JWT>
  | null {
  const oauthClient = getGoogleDriveOAuthClient();
  if (oauthClient) {
    return oauthClient;
  }
  return getGoogleAuthClient();
}

/**
 * Diagnostics helper to verify real Google permissions on Drive folder & Spreadsheet.
 */
export async function testGooglePermissions(): Promise<{
  authOk: boolean;
  driveFolderOk: boolean;
  driveFolderName?: string;
  driveAuthMethod: 'oauth2' | 'service_account' | 'none';
  driveError?: string;
  sheetsOk: boolean;
  spreadsheetTitle?: string;
  sheetTabs?: string[];
  sheetsError?: string;
  serviceAccountEmail: string;
}> {
  const driveAuth = getGoogleDriveAuthClient();
  const sheetsAuth = getGoogleAuthClient();
  const config = getGoogleConfigStatus();

  let driveFolderOk = false;
  let driveFolderName: string | undefined;
  let driveError: string | undefined;

  let sheetsOk = false;
  let spreadsheetTitle: string | undefined;
  let sheetTabs: string[] | undefined;
  let sheetsError: string | undefined;

  // 1. Test Drive Folder Access
  if (driveAuth) {
    try {
      const drive = google.drive({ version: 'v3', auth: driveAuth as any });
      const res = await drive.files.get({
        fileId: config.driveFolderId,
        fields: 'id, name, mimeType, capabilities',
        supportsAllDrives: true,
      });
      driveFolderOk = true;
      driveFolderName = res.data.name || config.driveFolderId;
      console.log(
        `[GoogleAuth:Diagnostics] ✅ Google Drive Folder accessible via ${config.driveAuthMethod}: "${driveFolderName}" (${config.driveFolderId})`
      );
    } catch (err) {
      driveError = (err as Error).message || String(err);
      console.error(
        `[GoogleAuth:Diagnostics] ❌ Google Drive Folder NOT accessible (${config.driveFolderId}):`,
        driveError
      );
      if (driveError.includes('404') || driveError.includes('File not found')) {
        driveError += ` -> Please ensure the Google Drive folder '${config.driveFolderId}' exists and is accessible.`;
      }
    }
  } else {
    driveError =
      'Neither Google Drive OAuth2 nor Service Account credentials are fully configured.';
  }

  // 2. Test Google Sheets Access (via Service Account JWT)
  if (sheetsAuth) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });
      const res = await sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });
      sheetsOk = true;
      spreadsheetTitle = res.data.properties?.title || config.spreadsheetId;
      sheetTabs = (res.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
      console.log(
        `[GoogleAuth:Diagnostics] ✅ Google Spreadsheet accessible: "${spreadsheetTitle}" (Tabs: ${sheetTabs.join(', ')})`
      );
    } catch (err) {
      sheetsError = (err as Error).message || String(err);
      console.error(
        `[GoogleAuth:Diagnostics] ❌ Google Spreadsheet NOT accessible (${config.spreadsheetId}):`,
        sheetsError
      );
      if (sheetsError.includes('404') || sheetsError.includes('Requested entity was not found')) {
        sheetsError += ` -> Please ensure the Google Spreadsheet '${config.spreadsheetId}' is shared with Editor permission to: ${config.serviceAccountEmail}`;
      }
    }
  } else {
    sheetsError =
      'Google Sheets Service Account Auth client could not be initialized (missing or invalid GOOGLE_PRIVATE_KEY).';
  }

  return {
    authOk: Boolean(driveFolderOk || sheetsOk),
    driveFolderOk,
    driveFolderName,
    driveAuthMethod: config.driveAuthMethod,
    driveError,
    sheetsOk,
    spreadsheetTitle,
    sheetTabs,
    sheetsError,
    serviceAccountEmail: config.serviceAccountEmail,
  };
}
