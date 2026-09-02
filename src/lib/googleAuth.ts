/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';

export const DEFAULT_SERVICE_ACCOUNT_EMAIL =
  'genz-interview-storage@genz-upskill-foundation.iam.gserviceaccount.com';
export const DEFAULT_SPREADSHEET_ID = '1q7h2pDNtuF3t7FFsErDcmNURt7YDzKAwYTgLTe04O0k';
export const DEFAULT_SHEET_NAME = 'Candidate_Interviews';

// Dedicated cached clients to keep Google Sheets and Google Drive auth isolated
let cachedSheetsClient: InstanceType<typeof google.auth.JWT> | null = null;
let cachedDriveClient: InstanceType<typeof google.auth.OAuth2> | InstanceType<typeof google.auth.JWT> | null = null;
let cachedDriveAccessToken: { token: string; expiresAt: number } | null = null;

export interface GoogleConfigStatus {
  serviceAccountEmail: string;
  authType: 'oauth2' | 'service_account' | 'none';
  sheetsAuthType: 'service_account' | 'none';
  driveAuthType: 'oauth2' | 'service_account' | 'none';
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
  oauthClientIdMasked: string;
  hasOAuthClientSecret: boolean;
  oauthClientSecretLength: number;
  hasOAuthRefreshToken: boolean;
  oauthRefreshTokenLength: number;
  oauthRefreshTokenPrefix: string;
  resolvedDriveAuthType: 'oauth2' | 'service_account' | 'none';
  resolvedSheetsAuthType: 'service_account' | 'none';
  hasServiceAccountPrivateKey: boolean;
  serviceAccountEmail: string;
  spreadsheetId: string;
  sheetName: string;
  driveFolderId: string;
  hasDriveFolderId: boolean;
}

/**
 * Normalizes string values from environment variables by removing wrapping quotes, whitespace, and newlines.
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
 * Normalizes private key string from various environment variable formats.
 */
export function cleanPrivateKey(rawKey: string): string {
  if (!rawKey) return '';
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

  return key.trim();
}

/**
 * Returns OAuth2 credentials for Google Drive with strict priority to GOOGLE_DRIVE_OAUTH_* variables.
 */
export function getDriveOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} {
  const clientId = cleanEnvString(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.OAUTH_CLIENT_ID ||
    ''
  );

  const clientSecret = cleanEnvString(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.OAUTH_CLIENT_SECRET ||
    ''
  );

  const refreshToken = cleanEnvString(
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.OAUTH_REFRESH_TOKEN ||
    ''
  );

  return { clientId, clientSecret, refreshToken };
}

/**
 * Returns Service Account credentials for Google Sheets & backup Drive operations.
 */
export function getServiceAccountCredentials(): {
  email: string;
  privateKey: string;
} {
  let email = cleanEnvString(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL);
  let rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';

  if (!rawPrivateKey && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
      if (parsed.client_email) email = cleanEnvString(parsed.client_email);
      if (parsed.private_key) rawPrivateKey = parsed.private_key;
    } catch (e) {
      console.warn('[GoogleAuth] ⚠️ Could not parse GOOGLE_SERVICE_ACCOUNT_KEY_JSON:', (e as Error).message);
    }
  }

  return {
    email,
    privateKey: cleanPrivateKey(rawPrivateKey),
  };
}

/**
 * Returns an authenticated JWT client dedicated STRICTLY to Google Sheets (Service Account).
 * Google Sheets MUST NOT use Drive OAuth credentials.
 */
export function getGoogleSheetsAuthClient(forceRefresh: boolean = false): InstanceType<typeof google.auth.JWT> | null {
  if (cachedSheetsClient && !forceRefresh) {
    return cachedSheetsClient;
  }

  const { email, privateKey } = getServiceAccountCredentials();

  if (!privateKey || privateKey.trim() === '') {
    console.error(
      '[GoogleSheets:Auth] ❌ Missing GOOGLE_PRIVATE_KEY for Google Sheets. Service Account private key is required.'
    );
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    cachedSheetsClient = auth;
    console.log(`[GoogleSheets:Auth] ✅ Authenticated with Service Account: ${email}`);
    return cachedSheetsClient;
  } catch (err) {
    console.error('[GoogleSheets:Auth] ❌ Failed to initialize Google Sheets JWT client:', (err as Error).message);
    return null;
  }
}

/**
 * Returns an authenticated client dedicated for Google Drive.
 * Prioritizes OAuth2 (GOOGLE_DRIVE_OAUTH_*) with fallback to Service Account JWT.
 */
export function getGoogleDriveAuthClient(
  forceRefresh: boolean = false
): InstanceType<typeof google.auth.OAuth2> | InstanceType<typeof google.auth.JWT> | null {
  if (cachedDriveClient && !forceRefresh) {
    return cachedDriveClient;
  }

  // 1. Prioritize Google Drive OAuth2
  const { clientId, clientSecret, refreshToken } = getDriveOAuthCredentials();

  if (clientId && clientSecret && refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret
      );
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      cachedDriveClient = oauth2Client;
      console.log(
        `[GoogleDrive:Auth] ✅ Authenticated with OAuth2 (Client: ${clientId.slice(0, 15)}..., RefreshToken: ${refreshToken.slice(0, 6)}...)`
      );
      return cachedDriveClient;
    } catch (oauthErr) {
      console.error('[GoogleDrive:Auth] ❌ Failed to initialize Google Drive OAuth2 client:', (oauthErr as Error).message);
    }
  } else {
    console.warn('[GoogleDrive:Auth] ℹ️ Drive OAuth2 credentials incomplete:', {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasRefreshToken: Boolean(refreshToken),
    });
  }

  // 2. Fallback to Service Account for Drive
  const { email, privateKey } = getServiceAccountCredentials();
  if (privateKey) {
    try {
      const auth = new google.auth.JWT({
        email,
        key: privateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      cachedDriveClient = auth;
      console.log(`[GoogleDrive:Auth] ℹ️ Using Service Account fallback for Drive (${email})`);
      return cachedDriveClient;
    } catch (err) {
      console.error('[GoogleDrive:Auth] ❌ Failed to initialize Drive Service Account fallback:', (err as Error).message);
      return null;
    }
  }

  console.warn('[GoogleDrive:Auth] ⚠️ No valid Google Drive credentials (neither OAuth2 nor Service Account).');
  return null;
}

/**
 * Legacy general auth client accessor.
 * Returns Drive auth client if requested, or Sheets auth client.
 */
export function getGoogleAuthClient(forceRefresh: boolean = false): InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.OAuth2> | null {
  return getGoogleDriveAuthClient(forceRefresh) || getGoogleSheetsAuthClient(forceRefresh);
}

/**
 * Fetches an access token for Google Drive using OAuth2 refresh token or Service Account.
 * Includes precise HTTP diagnostics to catch and explain 'unauthorized_client' errors.
 */
export async function getGoogleDriveAccessToken(forceRefresh: boolean = false): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedDriveAccessToken && cachedDriveAccessToken.expiresAt > now + 60000) {
    return cachedDriveAccessToken.token;
  }

  const { clientId, clientSecret, refreshToken } = getDriveOAuthCredentials();

  // Try OAuth2 token refresh via direct HTTP call first for granular diagnostics
  if (clientId && clientSecret && refreshToken) {
    try {
      console.log('[GoogleDrive:Auth] 🔄 Requesting fresh access token from Google OAuth2 token endpoint...');
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('refresh_token', refreshToken);
      params.append('grant_type', 'refresh_token');

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const responseText = await response.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        // Non-JSON response
      }

      if (response.ok && responseData.access_token) {
        const expiresIn = responseData.expires_in || 3600;
        cachedDriveAccessToken = {
          token: responseData.access_token,
          expiresAt: now + (expiresIn * 1000),
        };
        console.log(`[GoogleDrive:Auth] ✅ Successfully refreshed Google Drive OAuth2 access token (expires in ${expiresIn}s).`);
        return responseData.access_token;
      } else {
        const errorCode = responseData.error || `HTTP_${response.status}`;
        const errorDesc = responseData.error_description || responseText || 'Unknown error';
        console.error(`[GoogleDrive:Auth] ❌ Google OAuth2 token refresh FAILED: [${errorCode}] - ${errorDesc}`);

        if (errorCode === 'unauthorized_client') {
          console.error(
            `[GoogleDrive:Auth] 🛑 CRITICAL 'unauthorized_client' DIAGNOSIS:
The provided GOOGLE_DRIVE_OAUTH_CLIENT_ID and GOOGLE_DRIVE_OAUTH_CLIENT_SECRET do NOT match the OAuth client that generated GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN.
Please ensure all 3 variables originate from the exact same Google Cloud OAuth client ("GenZ Interview Drive").`
          );
        }
      }
    } catch (fetchErr) {
      console.error('[GoogleDrive:Auth] ❌ Exception while refreshing Drive OAuth2 access token:', (fetchErr as Error).message);
    }
  }

  // Fallback to client getAccessToken() (e.g. for Service Account or standard OAuth2 client)
  const auth = getGoogleDriveAuthClient(forceRefresh);
  if (!auth) return null;

  try {
    const tokenResponse = await auth.getAccessToken();
    const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    if (token) {
      cachedDriveAccessToken = {
        token,
        expiresAt: now + 3000000,
      };
      return token;
    }
    return null;
  } catch (err) {
    console.error('[GoogleDrive:Auth] ❌ Error acquiring Google Drive access token from client:', (err as Error).message);
    return null;
  }
}

/**
 * Access token for Google Drive operations.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  return getGoogleDriveAccessToken();
}

/**
 * Access token for Google Sheets operations (Service Account).
 */
export async function getGoogleSheetsAccessToken(): Promise<string | null> {
  const auth = getGoogleSheetsAuthClient();
  if (!auth) return null;

  try {
    const tokenResponse = await auth.getAccessToken();
    const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    return token || null;
  } catch (err) {
    console.error('[GoogleSheets:Auth] ❌ Error acquiring Sheets access token:', (err as Error).message);
    return null;
  }
}

/**
 * Returns summary of runtime Google Sheets & Google Drive environment variables without exposing private secrets.
 */
export function getGoogleConfigStatus(): GoogleConfigStatus {
  const { clientId, clientSecret, refreshToken } = getDriveOAuthCredentials();
  const { email, privateKey } = getServiceAccountCredentials();
  const driveFolderId = cleanEnvString(process.env.GOOGLE_DRIVE_FOLDER_ID || '');

  const sheetsAuthType: 'service_account' | 'none' = privateKey.length > 0 ? 'service_account' : 'none';
  const driveAuthType: 'oauth2' | 'service_account' | 'none' =
    refreshToken.length > 0 && clientId.length > 0 && clientSecret.length > 0
      ? 'oauth2'
      : privateKey.length > 0
      ? 'service_account'
      : 'none';

  return {
    serviceAccountEmail: email,
    authType: driveAuthType,
    sheetsAuthType,
    driveAuthType,
    hasPrivateKey: Boolean(privateKey.length > 0),
    privateKeyLength: privateKey.length,
    hasOAuthRefreshToken: Boolean(refreshToken.length > 0),
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
  const { clientId, clientSecret, refreshToken } = getDriveOAuthCredentials();
  const { email, privateKey } = getServiceAccountCredentials();
  const driveFolderId = cleanEnvString(process.env.GOOGLE_DRIVE_FOLDER_ID || '');

  const resolvedSheetsAuthType: 'service_account' | 'none' = privateKey.length > 0 ? 'service_account' : 'none';
  let resolvedDriveAuthType: 'oauth2' | 'service_account' | 'none' = 'none';
  if (refreshToken.length > 0 && clientId.length > 0 && clientSecret.length > 0) {
    resolvedDriveAuthType = 'oauth2';
  } else if (privateKey.length > 0) {
    resolvedDriveAuthType = 'service_account';
  }

  const maskedClientId = clientId.length > 12 ? `${clientId.slice(0, 8)}...${clientId.slice(-4)}` : clientId ? 'Set' : '';

  return {
    hasOAuthClientId: Boolean(clientId.length > 0),
    oauthClientIdLength: clientId.length,
    oauthClientIdMasked: maskedClientId,
    hasOAuthClientSecret: Boolean(clientSecret.length > 0),
    oauthClientSecretLength: clientSecret.length,
    hasOAuthRefreshToken: Boolean(refreshToken.length > 0),
    oauthRefreshTokenLength: refreshToken.length,
    oauthRefreshTokenPrefix: refreshToken.length > 0 ? refreshToken.slice(0, 6) : '',
    resolvedDriveAuthType,
    resolvedSheetsAuthType,
    hasServiceAccountPrivateKey: Boolean(privateKey.length > 0),
    serviceAccountEmail: email,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || DEFAULT_SHEET_NAME,
    driveFolderId,
    hasDriveFolderId: Boolean(driveFolderId.length > 0),
  };
}

/**
 * Diagnostics helper to verify real Google permissions on Spreadsheet & Drive independently.
 */
export async function testGooglePermissions(): Promise<{
  authOk: boolean;
  sheetsOk: boolean;
  driveOk: boolean;
  sheetsAuthType: string;
  driveAuthType: string;
  spreadsheetTitle?: string;
  sheetTabs?: string[];
  sheetsError?: string;
  driveFolderName?: string;
  driveError?: string;
  serviceAccountEmail: string;
}> {
  const config = getGoogleConfigStatus();
  const sheetsAuth = getGoogleSheetsAuthClient();
  const driveAuth = getGoogleDriveAuthClient();

  let sheetsOk = false;
  let driveOk = false;
  let spreadsheetTitle: string | undefined;
  let sheetTabs: string[] | undefined;
  let sheetsError: string | undefined;
  let driveFolderName: string | undefined;
  let driveError: string | undefined;

  // 1. Test Google Sheets Access (STRICTLY via Service Account JWT)
  if (sheetsAuth) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: sheetsAuth as any });
      const res = await sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });
      sheetsOk = true;
      spreadsheetTitle = res.data.properties?.title || config.spreadsheetId;
      sheetTabs = (res.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
      console.log(
        `[GoogleAuth:Diagnostics] ✅ Google Sheets accessible via Service Account: "${spreadsheetTitle}" (Tabs: ${sheetTabs.join(', ')})`
      );
    } catch (err) {
      sheetsError = (err as Error).message || String(err);
      console.error(
        `[GoogleAuth:Diagnostics] ❌ Google Sheets NOT accessible (${config.spreadsheetId}):`,
        sheetsError
      );
      if (sheetsError.includes('404') || sheetsError.includes('Requested entity was not found')) {
        sheetsError += ` -> Please ensure the Google Spreadsheet '${config.spreadsheetId}' is shared with Editor permission to: ${config.serviceAccountEmail}`;
      }
    }
  } else {
    sheetsError =
      'Google Sheets Service Account Auth client could not be initialized (missing GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL).';
  }

  // 2. Test Google Drive Access (via OAuth2 or Service Account)
  if (driveAuth) {
    try {
      const drive = google.drive({ version: 'v3', auth: driveAuth as any });
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
        const aboutRes = await drive.about.get({ fields: 'user, storageQuota' });
        driveOk = true;
        driveFolderName = `Root Drive (${aboutRes.data.user?.emailAddress || 'User'})`;
        console.log(`[GoogleAuth:Diagnostics] ✅ Google Drive accessible for: ${aboutRes.data.user?.emailAddress || 'Authenticated User'}`);
      }
    } catch (err) {
      driveError = (err as Error).message || String(err);
      console.error(
        `[GoogleAuth:Diagnostics] ❌ Google Drive NOT accessible (${config.driveFolderId || 'root'}):`,
        driveError
      );
      if (driveError.includes('unauthorized_client')) {
        driveError += ` -> OAuth2 unauthorized_client: Please verify that GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, and GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN are from the same OAuth Client ("GenZ Interview Drive").`;
      }
    }
  } else {
    driveError =
      'Google Drive Auth client could not be initialized (missing GOOGLE_DRIVE_OAUTH_* and GOOGLE_PRIVATE_KEY).';
  }

  return {
    authOk: Boolean(sheetsOk || driveOk),
    sheetsOk,
    driveOk,
    sheetsAuthType: config.sheetsAuthType,
    driveAuthType: config.driveAuthType,
    spreadsheetTitle,
    sheetTabs,
    sheetsError,
    driveFolderName,
    driveError,
    serviceAccountEmail: config.serviceAccountEmail,
  };
}

