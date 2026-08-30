/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Candidate, InterviewRecord, InterviewQuestion, AdminStats, InternshipDomain, HRReviewStatus, ProcessingStatus } from '../types';
import { FIXED_INTERVIEW_QUESTIONS } from './questions';
import { googleSheetsService } from './googleSheets';

interface DatabaseSchema {
  candidates: Candidate[];
  interviews: InterviewRecord[];
  questions: InterviewQuestion[];
  sequenceCounter: number;
}

class DatabaseService {
  private dbPath: string;
  private data: DatabaseSchema;
  private isSupabaseEnabled: boolean = false;
  private supabaseUrl?: string;
  private supabaseKey?: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'db.json');

    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    this.isSupabaseEnabled = Boolean(this.supabaseUrl && this.supabaseKey);

    this.data = this.loadInitialData();
  }

  private loadInitialData(): DatabaseSchema {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        console.warn('Failed to parse existing db.json, re-initializing:', err);
      }
    }

    // Initialize with fixed 24 questions
    const allQuestions: InterviewQuestion[] = [];
    Object.values(FIXED_INTERVIEW_QUESTIONS).forEach((qList) => {
      qList.forEach((q) => {
        if (!allQuestions.some((item) => item.id === q.id)) {
          allQuestions.push(q);
        }
      });
    });

    const initial: DatabaseSchema = {
      candidates: [],
      interviews: [],
      questions: allQuestions,
      sequenceCounter: 1,
    };

    this.saveData(initial);
    return initial;
  }

  private saveData(data: DatabaseSchema): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write db.json:', e);
    }
  }

  /**
   * Generates formatted Interview ID e.g. INTERVIEW-2026-000001
   */
  private generateInterviewId(): string {
    const currentYear = new Date().getFullYear();
    const count = this.data.sequenceCounter++;
    const padded = String(count).padStart(6, '0');
    return `INTERVIEW-${currentYear}-${padded}`;
  }

  public async createCandidate(candidateData: Omit<Candidate, 'id' | 'createdAt'>): Promise<Candidate> {
    const candidate: Candidate = {
      ...candidateData,
      id: `CAND-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    this.data.candidates.push(candidate);
    this.saveData(this.data);
    return candidate;
  }

  public async startInterview(candidate: Candidate): Promise<InterviewRecord> {
    const interviewId = this.generateInterviewId();
    const interview: InterviewRecord = {
      id: interviewId,
      candidateId: candidate.id,
      candidateName: candidate.fullName,
      candidateEmail: candidate.email,
      candidateMobile: candidate.mobile,
      candidateCollege: candidate.college,
      domain: candidate.domain,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      answers: [],
      hrReviewStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.data.interviews.push(interview);
    this.saveData(this.data);

    // Asynchronously sync candidate registration to Google Sheets (non-blocking)
    googleSheetsService.syncCandidateInterview(interview, candidate).catch((err) => {
      console.warn('[DB] Google Sheets start sync failed non-blockingly:', err);
    });

    return interview;
  }

  public async recordSubmissionReceived(
    interviewId: string,
    submissionData: {
      candidateName?: string;
      candidateEmail?: string;
      candidateMobile?: string;
      candidateCollege?: string;
      domain?: string;
      recordingPath: string;
      recordingSize: number;
      recordingDurationSeconds: number;
      answers: any[];
    }
  ): Promise<InterviewRecord> {
    let interview = this.data.interviews.find((i) => i.id === interviewId);

    if (!interview) {
      // If interview was not pre-registered, create a new record
      interview = {
        id: interviewId,
        candidateId: `CAND-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        candidateName: submissionData.candidateName || 'Candidate',
        candidateEmail: submissionData.candidateEmail || 'candidate@example.com',
        candidateMobile: submissionData.candidateMobile || '',
        candidateCollege: submissionData.candidateCollege || '',
        domain: (submissionData.domain as any) || 'Social Media Marketing (SMM)',
        status: 'submitted',
        processingStatus: 'processing',
        startedAt: new Date(Date.now() - (submissionData.recordingDurationSeconds || 0) * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        recordingPath: submissionData.recordingPath,
        recordingSize: submissionData.recordingSize,
        recordingDurationSeconds: submissionData.recordingDurationSeconds,
        answers: submissionData.answers || [],
        hrReviewStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      this.data.interviews.push(interview);

      // Ensure candidate is registered in candidates array
      const existingCandidate = this.data.candidates.find(
        (c) => c.email.toLowerCase() === (submissionData.candidateEmail || '').toLowerCase()
      );
      if (!existingCandidate) {
        this.data.candidates.push({
          id: interview.candidateId,
          fullName: interview.candidateName,
          email: interview.candidateEmail,
          mobile: interview.candidateMobile,
          college: interview.candidateCollege,
          domain: interview.domain,
          createdAt: interview.createdAt,
        });
      }
    } else {
      interview.status = 'submitted';
      interview.processingStatus = 'processing';
      interview.completedAt = new Date().toISOString();
      if (submissionData.candidateName) interview.candidateName = submissionData.candidateName;
      if (submissionData.candidateEmail) interview.candidateEmail = submissionData.candidateEmail;
      if (submissionData.candidateMobile) interview.candidateMobile = submissionData.candidateMobile;
      if (submissionData.candidateCollege) interview.candidateCollege = submissionData.candidateCollege;
      if (submissionData.domain) interview.domain = submissionData.domain as any;
      interview.recordingPath = submissionData.recordingPath;
      interview.recordingSize = submissionData.recordingSize;
      interview.recordingDurationSeconds = submissionData.recordingDurationSeconds;
      interview.answers = submissionData.answers || [];
    }

    this.saveData(this.data);
    return interview;
  }

  public async getStuckInterviews(): Promise<InterviewRecord[]> {
    return this.data.interviews.filter(
      (i) => i.processingStatus === 'processing'
    );
  }

  public async setProcessingStatus(
    interviewId: string,
    status: ProcessingStatus,
    errorMsg?: string
  ): Promise<InterviewRecord | null> {
    const interview = this.data.interviews.find((i) => i.id === interviewId);
    if (!interview) return null;
    interview.processingStatus = status;
    if (errorMsg !== undefined) {
      interview.processingError = errorMsg;
    } else if (status === 'processing' || status === 'completed') {
      interview.processingError = undefined;
    }
    this.saveData(this.data);
    return interview;
  }

  public async updateProcessingSuccess(
    interviewId: string,
    data: {
      recordingPath?: string;
      recordingSize?: number;
      driveFileId: string;
      driveViewLink: string;
      driveDownloadLink?: string;
    },
    options?: { reqStartTime?: number }
  ): Promise<InterviewRecord | null> {
    const interview = this.data.interviews.find((i) => i.id === interviewId);
    if (!interview) return null;

    interview.processingStatus = 'completed';
    interview.driveFileId = data.driveFileId;
    interview.driveViewLink = data.driveViewLink;
    if (data.driveDownloadLink) interview.driveDownloadLink = data.driveDownloadLink;
    if (data.recordingPath) interview.recordingPath = data.recordingPath;
    if (data.recordingSize) interview.recordingSize = data.recordingSize;
    interview.syncedToGoogleSheet = true;

    this.saveData(this.data);

    // Sync completed interview & Google Drive links to Google Sheets
    try {
      await googleSheetsService.syncCandidateInterview(interview, undefined, options);
    } catch (err) {
      console.warn('[DB] Google Sheets submit sync error in background update:', (err as Error).message);
    }

    return interview;
  }

  public async updateProcessingFailure(
    interviewId: string,
    errorMessage: string
  ): Promise<InterviewRecord | null> {
    const interview = this.data.interviews.find((i) => i.id === interviewId);
    if (!interview) return null;

    interview.processingStatus = 'failed';
    interview.processingError = errorMessage;

    this.saveData(this.data);

    // Attempt to sync candidate registration with note to Google Sheets so candidate record is not lost
    try {
      await googleSheetsService.syncCandidateInterview(interview);
    } catch (err) {
      console.warn('[DB] Google Sheets fallback sync error:', (err as Error).message);
    }

    return interview;
  }

  public async submitInterview(
    interviewId: string,
    submissionData: {
      candidateName?: string;
      candidateEmail?: string;
      candidateMobile?: string;
      candidateCollege?: string;
      domain?: string;
      recordingPath: string;
      recordingSize: number;
      recordingDurationSeconds: number;
      driveFileId?: string;
      driveViewLink?: string;
      driveDownloadLink?: string;
      answers: any[];
    },
    options?: { reqStartTime?: number }
  ): Promise<InterviewRecord> {
    let interview = this.data.interviews.find((i) => i.id === interviewId);

    if (!interview) {
      // If interview was not pre-registered, create a new record
      interview = {
        id: interviewId,
        candidateId: `CAND-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        candidateName: submissionData.candidateName || 'Candidate',
        candidateEmail: submissionData.candidateEmail || 'candidate@example.com',
        candidateMobile: submissionData.candidateMobile || '',
        candidateCollege: submissionData.candidateCollege || '',
        domain: (submissionData.domain as any) || 'Social Media Marketing (SMM)',
        status: 'submitted',
        processingStatus: submissionData.driveFileId ? 'completed' : 'processing',
        startedAt: new Date(Date.now() - (submissionData.recordingDurationSeconds || 0) * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        recordingPath: submissionData.recordingPath,
        recordingSize: submissionData.recordingSize,
        recordingDurationSeconds: submissionData.recordingDurationSeconds,
        driveFileId: submissionData.driveFileId,
        driveViewLink: submissionData.driveViewLink,
        driveDownloadLink: submissionData.driveDownloadLink,
        answers: submissionData.answers || [],
        hrReviewStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      this.data.interviews.push(interview);

      // Also ensure candidate is registered in candidates array
      const existingCandidate = this.data.candidates.find(
        (c) => c.email.toLowerCase() === (submissionData.candidateEmail || '').toLowerCase()
      );
      if (!existingCandidate) {
        this.data.candidates.push({
          id: interview.candidateId,
          fullName: interview.candidateName,
          email: interview.candidateEmail,
          mobile: interview.candidateMobile,
          college: interview.candidateCollege,
          domain: interview.domain,
          createdAt: interview.createdAt,
        });
      }
    } else {
      interview.status = 'submitted';
      interview.processingStatus = submissionData.driveFileId ? 'completed' : 'processing';
      interview.completedAt = new Date().toISOString();
      if (submissionData.candidateName) interview.candidateName = submissionData.candidateName;
      if (submissionData.candidateEmail) interview.candidateEmail = submissionData.candidateEmail;
      if (submissionData.candidateMobile) interview.candidateMobile = submissionData.candidateMobile;
      if (submissionData.candidateCollege) interview.candidateCollege = submissionData.candidateCollege;
      if (submissionData.domain) interview.domain = submissionData.domain as any;
      interview.recordingPath = submissionData.recordingPath;
      interview.recordingSize = submissionData.recordingSize;
      interview.recordingDurationSeconds = submissionData.recordingDurationSeconds;
      if (submissionData.driveFileId) interview.driveFileId = submissionData.driveFileId;
      if (submissionData.driveViewLink) interview.driveViewLink = submissionData.driveViewLink;
      if (submissionData.driveDownloadLink) interview.driveDownloadLink = submissionData.driveDownloadLink;
      interview.answers = submissionData.answers || [];
    }

    this.saveData(this.data);

    // Sync completed interview & Google Drive links to Google Sheets
    try {
      await googleSheetsService.syncCandidateInterview(interview, undefined, options);
    } catch (err) {
      console.warn('[DB] Google Sheets submit sync error:', (err as Error).message);
    }

    return interview;
  }

  public async getInterviews(filter?: {
    domain?: string;
    status?: string;
    search?: string;
  }): Promise<InterviewRecord[]> {
    let list = [...this.data.interviews];

    if (filter?.domain && filter.domain !== 'All') {
      list = list.filter((i) => i.domain === filter.domain);
    }

    if (filter?.status && filter.status !== 'All') {
      list = list.filter((i) => i.hrReviewStatus === filter.status || i.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.candidateName.toLowerCase().includes(q) ||
          i.candidateEmail.toLowerCase().includes(q) ||
          i.candidateCollege.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getInterviewById(id: string): Promise<InterviewRecord | null> {
    const found = this.data.interviews.find((i) => i.id === id);
    return found || null;
  }

  public async updateHrReview(
    id: string,
    update: {
      hrReviewStatus: HRReviewStatus;
      hrNotes?: string;
      hrReviewedBy?: string;
    }
  ): Promise<InterviewRecord | null> {
    const interview = this.data.interviews.find((i) => i.id === id);
    if (!interview) return null;

    interview.hrReviewStatus = update.hrReviewStatus;
    if (update.hrNotes !== undefined) interview.hrNotes = update.hrNotes;
    interview.hrReviewedBy = update.hrReviewedBy || 'HR Reviewer';
    interview.hrReviewedAt = new Date().toISOString();

    this.saveData(this.data);

    // Asynchronously update Google Sheets with new HR review status
    googleSheetsService.syncCandidateInterview(interview).catch((err) => {
      console.warn('[DB] Google Sheets HR review sync failed non-blockingly:', err);
    });

    return interview;
  }

  public async getAdminStats(): Promise<AdminStats> {
    const totalCandidates = this.data.candidates.length;
    const totalInterviews = this.data.interviews.length;
    const completedInterviews = this.data.interviews.filter(
      (i) => i.status === 'submitted' || i.status === 'completed'
    ).length;
    const pendingReviews = this.data.interviews.filter(
      (i) => i.hrReviewStatus === 'pending' || i.hrReviewStatus === 'under_review'
    ).length;
    const shortlistedCount = this.data.interviews.filter(
      (i) => i.hrReviewStatus === 'shortlisted'
    ).length;

    return {
      totalCandidates,
      totalInterviews,
      completedInterviews,
      pendingReviews,
      shortlistedCount,
    };
  }

  public async getQuestions(domain?: string): Promise<InterviewQuestion[]> {
    let list = this.data.questions.filter((q) => q.active);
    if (domain && domain !== 'All') {
      const specific = list.filter((q) => q.domain === domain);
      if (specific.length > 0) {
        return specific.sort((a, b) => a.questionOrder - b.questionOrder);
      }
    }
    return list.filter((q) => q.domain === 'All').sort((a, b) => a.questionOrder - b.questionOrder);
  }

  public async addOrUpdateQuestion(q: InterviewQuestion): Promise<InterviewQuestion> {
    const idx = this.data.questions.findIndex((item) => item.id === q.id);
    if (idx >= 0) {
      this.data.questions[idx] = q;
    } else {
      this.data.questions.push(q);
    }
    this.saveData(this.data);
    return q;
  }
}

export const db = new DatabaseService();
