/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';
import {
  getGoogleSheetsAuthClient,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SHEET_NAME,
  DEFAULT_SERVICE_ACCOUNT_EMAIL,
} from './googleAuth';
import { InterviewRecord, Candidate } from '../types';

export const SHEET_COLUMNS = [
  'Candidate ID',
  'Interview ID',
  'Full Name',
  'Email',
  'Mobile Number',
  'College / University',
  'Internship Domain',
  'Registration Date/Time',
  'Interview Status',
  'Completion Date/Time',
  'Recording Duration',
  'Google Drive Video Link',
  'Google Drive File ID',
  'Questions Answered',
  'HR Review Status',
  'HR Evaluation Notes',
  'HR Evaluated By',
  'HR Evaluation Date',
];

let isHeaderVerified = false;
let cachedSheetTitle: string | null = null;

export class GoogleSheetsService {
  private spreadsheetId: string;
  private targetSheetName: string;

  constructor(spreadsheetId?: string, sheetName?: string) {
    this.spreadsheetId =
      spreadsheetId ||
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
      process.env.GOOGLE_SHEET_ID ||
      DEFAULT_SPREADSHEET_ID;
    this.targetSheetName =
      sheetName ||
      process.env.GOOGLE_SHEETS_SHEET_NAME ||
      process.env.GOOGLE_SHEET_NAME ||
      DEFAULT_SHEET_NAME;
  }

  /**
   * Ensures the sheet tab exists and the header row is present in the target sheet.
   * Caches verified state in memory so subsequent submissions avoid redundant metadata API calls.
   */
  private async ensureHeaders(sheets: ReturnType<typeof google.sheets>): Promise<string> {
    if (isHeaderVerified && cachedSheetTitle) {
      return cachedSheetTitle;
    }

    try {
      console.log(`[GoogleSheets] 🔍 Verifying spreadsheet structure for ID: ${this.spreadsheetId}...`);

      const meta = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheetList = meta.data.sheets || [];
      const titles = sheetList.map((s) => s.properties?.title || '').filter(Boolean);
      console.log(`[GoogleSheets] 📋 Available sheet tabs in spreadsheet: [${titles.map((t) => `"${t}"`).join(', ')}]`);

      let selectedSheetTitle = this.targetSheetName;
      let targetSheet = sheetList.find(
        (s) => s.properties?.title?.trim().toLowerCase() === this.targetSheetName.trim().toLowerCase()
      );

      // If specified sheet tab doesn't exist, use the exact first tab title
      if (!targetSheet && sheetList.length > 0) {
        selectedSheetTitle = sheetList[0].properties?.title || 'Candidate Interviews';
        console.log(
          `[GoogleSheets] ℹ️ Specified tab "${this.targetSheetName}" not found. Using active tab: "${selectedSheetTitle}".`
        );
      } else if (targetSheet && targetSheet.properties?.title) {
        selectedSheetTitle = targetSheet.properties.title;
      }

      // Check row 1
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${selectedSheetTitle}'!A1:R1`,
      });

      const rows = res.data.values;
      if (!rows || rows.length === 0 || rows[0].length === 0) {
        console.log(`[GoogleSheets] 📝 Initializing 18-column header row in tab "${selectedSheetTitle}"...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${selectedSheetTitle}'!A1:R1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [SHEET_COLUMNS],
          },
        });
        console.log(`[GoogleSheets] ✅ Headers written successfully!`);
      }

      isHeaderVerified = true;
      cachedSheetTitle = selectedSheetTitle;
      return selectedSheetTitle;
    } catch (err: unknown) {
      const msg = (err as Error).message || String(err);
      console.warn(`[GoogleSheets] ⚠️ Header check notice on sheet (${this.spreadsheetId}):`, msg);
      return this.targetSheetName;
    }
  }

  /**
   * Syncs candidate & interview data to Google Sheets.
   * Updates row if interview ID already exists, or appends a new row.
   */
  public async syncCandidateInterview(
    interview: InterviewRecord,
    candidate?: Candidate,
    options?: { reqStartTime?: number }
  ): Promise<{ success: boolean; rowIndex?: number; range?: string }> {
    const startTime = options?.reqStartTime || Date.now();
    const auth = getGoogleSheetsAuthClient();
    if (!auth) {
      const msg = 'Google Sheets Service Account Auth client unavailable. Check GOOGLE_PRIVATE_KEY and GOOGLE_SERVICE_ACCOUNT_EMAIL.';
      console.error(`[SHEETS] ❌ ${msg}`);
      throw new Error(msg);
    }

    try {
      console.log(`[SHEETS] Append started ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
      const sheets = google.sheets({ version: 'v4', auth: auth as any });
      const actualSheetName = await this.ensureHeaders(sheets);

      // Build row data array matching SHEET_COLUMNS exactly
      const candidateId = interview.candidateId || candidate?.id || '';
      const interviewId = interview.id;
      const fullName = interview.candidateName || candidate?.fullName || '';
      const email = interview.candidateEmail || candidate?.email || '';
      const mobile = interview.candidateMobile || candidate?.mobile || '';
      const college = interview.candidateCollege || candidate?.college || '';
      const domain = interview.domain || candidate?.domain || '';
      const regDate = interview.createdAt || candidate?.createdAt || new Date().toISOString();
      const status = interview.status;
      const completedAt = interview.completedAt || '';

      const durationFormatted = interview.recordingDurationSeconds
        ? `${Math.floor(interview.recordingDurationSeconds / 60)}m ${interview.recordingDurationSeconds % 60}s (${interview.recordingDurationSeconds}s)`
        : '';

      const driveLink = interview.driveViewLink || '';
      const driveId = interview.driveFileId || '';

      const questionsAnswered =
        interview.answers && interview.answers.length > 0
          ? `${interview.answers.length} answered: ` +
            interview.answers
              .map((a) => `Q${a.questionOrder} (${a.durationSeconds || 0}s)`)
              .join(' | ')
          : 'None recorded';

      const hrStatus = interview.hrReviewStatus || 'pending';
      const hrNotes = interview.hrNotes || '';
      const hrReviewedBy = interview.hrReviewedBy || '';
      const hrReviewedAt = interview.hrReviewedAt || '';

      const rowValues = [
        candidateId,
        interviewId,
        fullName,
        email,
        mobile,
        college,
        domain,
        regDate,
        status,
        completedAt,
        durationFormatted,
        driveLink,
        driveId,
        questionsAnswered,
        hrStatus,
        hrNotes,
        hrReviewedBy,
        hrReviewedAt,
      ];

      // Check if this interview already has a row in the sheet
      let existingRowIndex = -1;
      try {
        const idColumnRes = await sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `'${actualSheetName}'!B:B`,
        });

        const idValues = idColumnRes.data.values || [];
        for (let i = 0; i < idValues.length; i++) {
          if (idValues[i] && idValues[i][0] === interviewId) {
            existingRowIndex = i + 1; // 1-indexed row number
            break;
          }
        }
      } catch (checkErr) {
        console.warn('[SHEETS] ⚠️ Notice while searching for existing interview row index:', (checkErr as Error).message);
      }

      if (existingRowIndex > 1) {
        // Update existing row
        console.log(
          `[SHEETS] ✏️ Updating existing row ${existingRowIndex} for interview [${interviewId}] in tab "${actualSheetName}"...`
        );
        const updateRes = await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${actualSheetName}'!A${existingRowIndex}:R${existingRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [rowValues],
          },
        });
        const updatedRange = updateRes.data.updatedRange || `'${actualSheetName}'!A${existingRowIndex}:R${existingRowIndex}`;
        console.log(`[SHEETS] Append completed ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
        console.log(`spreadsheet=${this.spreadsheetId}`);
        console.log(`sheet=${actualSheetName}`);
        console.log(`range=${updatedRange}`);
        console.log(`updatedRows=1`);

        return { success: true, rowIndex: existingRowIndex, range: updatedRange };
      } else {
        // Append new row
        console.log(
          `[SHEETS] ➕ Appending new candidate row for "${fullName}" (${interviewId}) into tab "${actualSheetName}"...`
        );
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `'${actualSheetName}'!A:R`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [rowValues],
          },
        });
        const updatedRange = appendRes.data.updates?.updatedRange || `'${actualSheetName}'!A:R`;
        console.log(`[SHEETS] Append completed ${new Date().toISOString()} elapsed=${Date.now() - startTime}ms`);
        console.log(`spreadsheet=${this.spreadsheetId}`);
        console.log(`sheet=${actualSheetName}`);
        console.log(`range=${updatedRange}`);
        console.log(`updatedRows=1`);

        return { success: true, range: updatedRange };
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || String(err);
      console.error(
        `[SHEETS] ❌ Google Sheets sync FAILED for interview [${interview.id}]:`,
        errorMsg
      );

      if (errorMsg.includes('404') || errorMsg.includes('Requested entity was not found')) {
        console.error(
          `[SHEETS] 💡 PERMISSION HINT: Please ensure Google Spreadsheet '${this.spreadsheetId}' is shared with Editor permissions to: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL}`
        );
      }

      throw new Error(`Google Sheets sync failed: ${errorMsg}`);
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
