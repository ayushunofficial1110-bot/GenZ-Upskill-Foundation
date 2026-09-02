/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';

export const DEFAULT_SERVICE_ACCOUNT_EMAIL =
  'genz-interview-storage@genz-upskill-foundation.iam.gserviceaccount.com';
export const DEFAULT_SPREADSHEET_ID = '1q7h2pDNtuF3t7FFsErDcmNURt7YDzKAwYTgLTe04O0k';
export const DEFAULT_SHEET_NAME = 'Candidate_Interviews';

let cachedAuthClient: InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.OAuth2> | null = null;

export interface GoogleConfigStatus {
  serviceAccountEmail: string;
  authType: 'oauth2' | 'service_account' | 'none';
  hasPrivateKey: boolean;
  privateKeyLength: number;
  hasOAuthRefreshToken: boolean;
  spreadsheetId: string;
  sheetName: string;
  driveFolderId: string;
  hasDriveFolderId: boolean;
  hasAdminUsername: boolean;
  hasAdminPassword: boolean;
}

export interface GoogleAuthDiagnostics {
  hasOAuthClientId: boolean;
  oauthClientIdLength: number;
  hasOAuthClientSecret: boolean;
  oauthClientSecretLength: number;
  hasOAuthRefreshToken: boolean;
  oauthRefreshTokenLength: number;
  oauthRefreshTokenPrefix: string;
  resolvedAuthType: 'oauth2' | 'service_account' | 'none';
  hasServiceAccountPrivateKey: boolean;
  serviceAccountEmail: string;
  spreadsheetId: string;
  sheetName: string;
  driveFolderId: string;
  hasDriveFolderId: boolean;
}

/**
 * Normalizes string values from environment variables by removing wrapping quotes and whitespace.
 */
export function cleanEnvString(raw?: string): string {
  if (!raw) return '';
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'")) ||
    (val.startsWith('`') && val.endsWith('`'))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val.replace(/[\r\n\t]/g, '').trim();
}

/**
 * Returns summary of runtime Google Sheets & Google Drive environment variables without exposing private secrets.
 */
export function getGoogleConfigStatus(): GoogleConfigStatus {
  const oauthClientId = cleanEnvString(
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
    process.env.OAUTH_CLIENT_ID ||
    ''
  );
  const oauthClientSecret = cleanEnvString(
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
    process.env.OAUTH_CLIENT_SECRET ||
    ''
  );
  const oauthRefreshToken = cleanEnvString(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ||
    process.env.OAUTH_REFRESH_TOKEN ||
    ''
  );

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

  const driveFolderId = cleanEnvString(process.env.GOOGLE_DRIVE_FOLDER_ID || '');

  let authType: 'oauth2' | 'service_account' | 'none' = 'none';
  if (oauthRefreshToken.length > 0 && oauthClientId.length > 0 && oauthClientSecret.length > 0) {
    authType = 'oauth2';
  } else if (privateKey.trim().length > 0) {
    authType = 'service_account';
  }

  return {
    serviceAccountEmail: email,
    authType,
    hasPrivateKey: Boolean(privateKey && privateKey.trim().length > 0),
    privateKeyLength: privateKey ? privateKey.length : 0,
    hasOAuthRefreshToken: Boolean(oauthRefreshToken.length > 0),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || DEFAULT_SHEET_NAME,
    driveFolderId,
    hasDriveFolderId: Boolean(driveFolderId.length > 0),
    hasAdminUsername: Boolean(process.env.ADMIN_USERNAME),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
  };
}

/**
 * Returns exact Google Auth runtime diagnostics for admin verification without exposing secrets.
 */
export function getGoogleAuthDiagnostics(): GoogleAuthDiagnostics {
  const oauthClientId = cleanEnvString(
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
    process.env.OAUTH_CLIENT_ID ||
    ''
  );
  const oauthClientSecret = cleanEnvString(
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
    process.env.OAUTH_CLIENT_SECRET ||
    ''
  );
  const oauthRefreshToken = cleanEnvString(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ||
    process.env.OAUTH_REFRESH_TOKEN ||
    ''
  );

  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  let rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  if (!rawPrivateKey && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
      if (parsed.client_email) email = parsed.client_email;
      if (parsed.private_key) rawPrivateKey = parsed.private_key;
    } catch {}
  }
  const cleanKey = cleanPrivateKey(rawPrivateKey);

  let resolvedAuthType: 'oauth2' | 'service_account' | 'none' = 'none';
  if (oauthRefreshToken.length > 0 && oauthClientId.length > 0 && oauthClientSecret.length > 0) {
    resolvedAuthType = 'oauth2';
  } else if (cleanKey.length > 0) {
    resolvedAuthType = 'service_account';
  }

  const driveFolderId = cleanEnvString(process.env.GOOGLE_DRIVE_FOLDER_ID || '');

  return {
    hasOAuthClientId: Boolean(oauthClientId.length > 0),
    oauthClientIdLength: oauthClientId.length,
    hasOAuthClientSecret: Boolean(oauthClientSecret.length > 0),
    oauthClientSecretLength: oauthClientSecret.length,
    hasOAuthRefreshToken: Boolean(oauthRefreshToken.length > 0),
    oauthRefreshTokenLength: oauthRefreshToken.length,
    oauthRefreshTokenPrefix: oauthRefreshToken.length > 0 ? oauthRefreshToken.slice(0, 6) : '',
    resolvedAuthType,
    hasServiceAccountPrivateKey: Boolean(cleanKey.length > 0),
    serviceAccountEmail: email,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || DEFAULT_SHEET_NAME,
    driveFolderId,
    hasDriveFolderId: Boolean(driveFolderId.length > 0),
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
 * Returns an authenticated Google Auth client (OAuth2 or Service Account JWT).
 * Used for Google Sheets and Google Drive storage operations.
 */
export function getGoogleAuthClient(forceRefresh: boolean = false): InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.OAuth2> | null {
  if (cachedAuthClient && !forceRefresh) {
    return cachedAuthClient;
  }

  // 1. Check for OAuth2 Refresh Token credentials
  const oauthClientId = cleanEnvString(
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
    process.env.OAUTH_CLIENT_ID ||
    ''
  );
  const oauthClientSecret = cleanEnvString(
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
    process.env.OAUTH_CLIENT_SECRET ||
    ''
  );
  const oauthRefreshToken = cleanEnvString(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ||
    process.env.OAUTH_REFRESH_TOKEN ||
    ''
  );

  if (oauthRefreshToken && oauthClientId && oauthClientSecret) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        oauthClientId,
        oauthClientSecret
      );
      oauth2Client.setCredentials({
        refresh_token: oauthRefreshToken,
      });
      cachedAuthClient = oauth2Client;
      console.log(`[GoogleAuth] ✅ Google OAuth2 authenticated with refresh token (client: ${oauthClientId.slice(0, 12)}...).`);
      return cachedAuthClient;
    } catch (oauthErr) {
      console.error('[GoogleAuth] ❌ Failed to initialize Google OAuth2 client:', (oauthErr as Error).message);
    }
  }

  // 2. Check for Service Account JWT credentials
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

  if (rawPrivateKey && rawPrivateKey.trim() !== '') {
    try {
      const formattedKey = cleanPrivateKey(rawPrivateKey);

      const auth = new google.auth.JWT({
        email,
        key: formattedKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      cachedAuthClient = auth;
      console.log(`[GoogleAuth] ✅ Google Service Account authenticated for: ${email}`);
      return cachedAuthClient;
    } catch (err) {
      console.error('[GoogleAuth] ❌ Failed to initialize Google JWT client:', (err as Error).message);
      return null;
    }
  }

  console.warn(
    '[GoogleAuth] ⚠️ No Google credentials configured (neither OAuth2 refresh token nor Service Account private key).'
  );
  return null;
}

/**
 * Safely fetches a valid Bearer Access Token without throwing JSON parse errors.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const auth = getGoogleAuthClient();
  if (!auth) {
    return null;
  }

  try {
    const tokenResponse = await auth.getAccessToken();
    const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    return token || null;
  } catch (err) {
    console.error('[GoogleAuth] ❌ Error acquiring Google access token:', (err as Error).message);
    return null;
  }
}

/**
 * Diagnostics helper to verify real Google permissions on Spreadsheet & Drive.
 */
export async function testGooglePermissions(): Promise<{
  authOk: boolean;
  sheetsOk: boolean;
  driveOk: boolean;
  spreadsheetTitle?: string;
  sheetTabs?: string[];
  sheetsError?: string;
  driveFolderName?: string;
  driveError?: string;
  serviceAccountEmail: string;
}> {
  const auth = getGoogleAuthClient();
  const config = getGoogleConfigStatus();

  let sheetsOk = false;
  let driveOk = false;
  let spreadsheetTitle: string | undefined;
  let sheetTabs: string[] | undefined;
  let sheetsError: string | undefined;
  let driveFolderName: string | undefined;
  let driveError: string | undefined;

  // Test Google Sheets Access (via Service Account JWT)
  if (auth) {
    try {
      const sheets = google.sheets({ version: 'v4', auth });
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

    // Test Google Drive Access (via Service Account JWT)
    try {
      const drive = google.drive({ version: 'v3', auth });
      if (config.driveFolderId) {
        const folderRes = await drive.files.get({
          fileId: config.driveFolderId,
          fields: 'id, name, mimeType',
          supportsAllDrives: true,
        });
        driveOk = true;
        driveFolderName = folderRes.data.name || config.driveFolderId;
        console.log(`[GoogleAuth:Diagnostics] ✅ Google Drive target folder accessible: "${driveFolderName}"`);
      } else {
        const aboutRes = await drive.about.get({ fields: 'user' });
        driveOk = true;
        driveFolderName = 'Root Drive (No specific folder configured)';
        console.log(`[GoogleAuth:Diagnostics] ✅ Google Drive accessible for user: ${aboutRes.data.user?.emailAddress || config.serviceAccountEmail}`);
      }
    } catch (err) {
      driveError = (err as Error).message || String(err);
      console.error(
        `[GoogleAuth:Diagnostics] ❌ Google Drive NOT accessible (${config.driveFolderId || 'root'}):`,
        driveError
      );
      if (driveError.includes('404') || driveError.includes('File not found')) {
        driveError += ` -> Please ensure the Google Drive folder '${config.driveFolderId}' is shared with Editor permission to: ${config.serviceAccountEmail}`;
      }
    }
  } else {
    sheetsError =
      'Google Service Account Auth client could not be initialized (missing or invalid GOOGLE_PRIVATE_KEY).';
    driveError =
      'Google Service Account Auth client could not be initialized (missing or invalid GOOGLE_PRIVATE_KEY).';
  }

  return {
    authOk: Boolean(sheetsOk || driveOk),
    sheetsOk,
    driveOk,
    spreadsheetTitle,
    sheetTabs,
    sheetsError,
    driveFolderName,
    driveError,
    serviceAccountEmail: config.serviceAccountEmail,
  };
}
