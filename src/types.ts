/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InternshipDomain =
  | 'Social Media Marketing (SMM)'
  | 'Content Writing'
  | 'Human Resources (HR)'
  | 'AI';

export interface CandidateFormData {
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  domain: InternshipDomain;
  agreedToConsent: boolean;
}

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  domain: InternshipDomain;
  createdAt: string;
}

export interface InterviewQuestion {
  id: string;
  domain: string; // 'All' or specific domain
  questionOrder: number;
  order?: number;
  questionText: string; // english text
  english: string;
  hindi: string;
  active: boolean;
}

export interface InterviewIntroStep {
  id: string;
  title: string;
  stepNumber: number;
  totalSteps: number;
  english: string;
  hindi: string;
}

export interface QuestionAnswerMetadata {
  questionId: string;
  questionText: string;
  questionOrder: number;
  startedAtSeconds: number;
  completedAtSeconds: number;
  durationSeconds: number;
}

export type InterviewStatus = 'pending' | 'in_progress' | 'completed' | 'submitted';

export type HRReviewStatus =
  | 'pending'
  | 'under_review'
  | 'shortlisted'
  | 'next_round'
  | 'not_selected';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface InterviewRecord {
  id: string; // e.g. INTERVIEW-2026-000001
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  candidateCollege: string;
  domain: InternshipDomain;
  status: InterviewStatus;
  processingStatus?: ProcessingStatus;
  processingError?: string;
  startedAt: string;
  completedAt?: string;
  recordingPath?: string;
  recordingSize?: number;
  recordingDurationSeconds?: number;
  driveFileId?: string;
  driveViewLink?: string;
  driveDownloadLink?: string;
  syncedToGoogleSheet?: boolean;
  sheetRowIndex?: number;
  answers: QuestionAnswerMetadata[];
  hrReviewStatus: HRReviewStatus;
  hrNotes?: string;
  hrReviewedBy?: string;
  hrReviewedAt?: string;
  createdAt: string;
}

export interface AdminStats {
  totalCandidates: number;
  totalInterviews: number;
  completedInterviews: number;
  pendingReviews: number;
  shortlistedCount: number;
}

export interface AdminSession {
  token: string;
  username: string;
  role: 'admin' | 'hr';
  expiresAt: number;
}

export type AppStep =
  | 'welcome'
  | 'form'
  | 'candidate_info'
  | 'consent'
  | 'device-check'
  | 'device_check'
  | 'interview'
  | 'submitting'
  | 'completed';
