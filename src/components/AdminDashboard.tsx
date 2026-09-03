/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { InterviewRecord, AdminStats, HRReviewStatus } from '../types';
import { DEFAULT_DOMAINS } from '../lib/questions';
import {
  Users,
  Video,
  CheckCircle2,
  Clock,
  Search,
  LogOut,
  RefreshCw,
  UserCheck,
  Mail,
  Phone,
  GraduationCap,
  X,
  Save,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  PenTool,
  Link as LinkIcon,
  ShieldCheck,
  Key,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Radio,
  FileSpreadsheet,
  HardDrive,
  Info,
} from 'lucide-react';

interface B2DiagnosticsResponse {
  isConfigured: boolean;
  hasKeyId: boolean;
  keyIdLength: number;
  keyIdMasked: string;
  hasApplicationKey: boolean;
  hasBucketName: boolean;
  bucketName: string;
  hasEndpoint: boolean;
  endpoint: string;
  region: string;
}

interface B2TestResult {
  success: boolean;
  bucketName: string;
  endpoint: string;
  region: string;
  canReadBucket: boolean;
  canPresign: boolean;
  samplePresignedUrl?: string;
  message?: string;
  error?: string;
}

interface GoogleAuthDiagnosticsResponse {
  hasOAuthClientId: boolean;
  oauthClientIdLength: number;
  oauthClientIdMasked?: string;
  hasOAuthClientSecret: boolean;
  oauthClientSecretLength: number;
  hasOAuthRefreshToken: boolean;
  oauthRefreshTokenLength: number;
  oauthRefreshTokenPrefix: string;
  resolvedDriveAuthType?: 'oauth2' | 'service_account' | 'none';
  resolvedSheetsAuthType?: 'service_account' | 'none';
  resolvedAuthType?: 'oauth2' | 'service_account' | 'none';
  hasServiceAccountPrivateKey: boolean;
  serviceAccountEmail?: string;
  spreadsheetId?: string;
  sheetName?: string;
  driveFolderId?: string;
  hasDriveFolderId?: boolean;
}

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  onLogout,
  onClose,
}) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<InterviewRecord | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Filters
  const [domainFilter, setDomainFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Auto-Polling & Live Refresh State
  const [isPolling, setIsPolling] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());
  const [newInterviewBanner, setNewInterviewBanner] = useState<{ count: number; name: string; domain: string } | null>(null);
  const knownInterviewIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Backblaze B2 Diagnostics State
  const [b2Status, setB2Status] = useState<B2DiagnosticsResponse | null>(null);
  const [isLoadingB2Status, setIsLoadingB2Status] = useState(false);
  const [b2TestResult, setB2TestResult] = useState<B2TestResult | null>(null);
  const [isTestingB2, setIsTestingB2] = useState(false);

  // Google Sheets Auth Diagnostics State
  const [googleAuthStatus, setGoogleAuthStatus] = useState<GoogleAuthDiagnosticsResponse | null>(null);
  const [isLoadingAuthStatus, setIsLoadingAuthStatus] = useState(false);
  const [testPermissionsResult, setTestPermissionsResult] = useState<any>(null);
  const [isTestingPermissions, setIsTestingPermissions] = useState(false);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);

  // Retry Sync State
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  const [retryNotice, setRetryNotice] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Review Form
  const [reviewStatus, setReviewStatus] = useState<HRReviewStatus>('under_review');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Deletion Modal / State
  const [interviewToDelete, setInterviewToDelete] = useState<InterviewRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Copy link feedback state & base URL
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [isRefreshingStream, setIsRefreshingStream] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const fetchB2Status = async () => {
    setIsLoadingB2Status(true);
    try {
      const res = await fetch('/api/admin/b2-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setB2Status(data);
      }
    } catch (err) {
      console.error('Failed to fetch Backblaze B2 diagnostics:', err);
    } finally {
      setIsLoadingB2Status(false);
    }
  };

  const handleTestB2Access = async () => {
    setIsTestingB2(true);
    setB2TestResult(null);
    try {
      const res = await fetch('/api/admin/test-b2-access', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setB2TestResult(data);
    } catch (err: unknown) {
      setB2TestResult({
        success: false,
        bucketName: b2Status?.bucketName || 'Unknown',
        endpoint: b2Status?.endpoint || '',
        region: b2Status?.region || '',
        canReadBucket: false,
        canPresign: false,
        error: (err as Error).message || 'Failed to contact Backblaze B2 test endpoint',
      });
    } finally {
      setIsTestingB2(false);
    }
  };

  const fetchGoogleAuthStatus = async () => {
    setIsLoadingAuthStatus(true);
    try {
      const res = await fetch('/api/admin/google-auth-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleAuthStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch Google Auth diagnostics:', err);
    } finally {
      setIsLoadingAuthStatus(false);
    }
  };

  const handleTestGooglePermissions = async () => {
    setIsTestingPermissions(true);
    setTestPermissionsResult(null);
    try {
      const res = await fetch('/api/admin/test-google-access', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestPermissionsResult(data);
    } catch (err: unknown) {
      setTestPermissionsResult({
        success: false,
        error: (err as Error).message || 'Failed to contact test endpoint',
      });
    } finally {
      setIsTestingPermissions(false);
    }
  };

  const fetchDashboardData = async (isBackground: boolean = false) => {
    if (!isBackground) {
      setIsManualRefreshing(true);
      if (interviews.length === 0) {
        setIsLoading(true);
      }
    }

    try {
      // 1. Fetch stats
      const statsRes = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      // 2. Fetch interviews
      const query = new URLSearchParams();
      if (domainFilter !== 'All') query.append('domain', domainFilter);
      if (statusFilter !== 'All') query.append('status', statusFilter);
      if (searchQuery.trim()) query.append('search', searchQuery.trim());

      const interviewsRes = await fetch(`/api/admin/interviews?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (interviewsRes.ok) {
        const data = await interviewsRes.json();
        const freshList: InterviewRecord[] = data.interviews || [];

        // Check for newly arrived interviews if this is a background poll
        if (!isInitialLoadRef.current && isBackground && knownInterviewIdsRef.current.size > 0) {
          const newlyFound = freshList.filter((i) => !knownInterviewIdsRef.current.has(i.id));
          if (newlyFound.length > 0) {
            console.log(
              `[AdminDashboard] ⚡ Detected ${newlyFound.length} new interview(s):`,
              newlyFound.map((i) => i.candidateName)
            );
            setNewlyArrivedIds((prev) => {
              const next = new Set(prev);
              newlyFound.forEach((i) => next.add(i.id));
              return next;
            });
            setNewInterviewBanner({
              count: newlyFound.length,
              name: newlyFound[0].candidateName,
              domain: newlyFound[0].domain,
            });
          }
        }

        // Register all current IDs as known
        freshList.forEach((i) => knownInterviewIdsRef.current.add(i.id));
        isInitialLoadRef.current = false;

        setInterviews(freshList);
        setLastRefreshedAt(new Date());

        // Update currently selected interview without interrupting review notes
        setSelectedInterview((currentSelected) => {
          if (!currentSelected) return null;
          const freshItem = freshList.find((i) => i.id === currentSelected.id);
          return freshItem ? { ...currentSelected, ...freshItem } : currentSelected;
        });
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setIsLoading(false);
      setIsManualRefreshing(false);
    }
  };

  // Initial load and filter change trigger
  useEffect(() => {
    fetchDashboardData(false);
    fetchB2Status();
    fetchGoogleAuthStatus();
  }, [domainFilter, statusFilter]);

  // Background Auto-Polling every 15-20 seconds (15s)
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [domainFilter, statusFilter, searchQuery, isPolling, token]);

  const handleRefreshVideoUrl = async (interviewId?: string) => {
    const targetId = interviewId || selectedInterview?.id;
    if (!targetId) return;

    setIsRefreshingStream(true);
    try {
      const res = await fetch(`/api/admin/interviews/${targetId}/presigned-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.streamUrl) {
          setStreamUrl(data.streamUrl);
          setSelectedInterview((prev) =>
            prev && prev.id === targetId
              ? { ...prev, videoUrl: data.streamUrl, driveViewLink: data.streamUrl }
              : prev
          );
        }
      }
    } catch (err) {
      console.error('Failed to refresh presigned video URL:', err);
    } finally {
      setIsRefreshingStream(false);
    }
  };

  const copyDomainLink = (domainKey: string) => {
    const origin = baseUrl || window.location.origin;
    const url = `${origin}/?domain=${domainKey}`;
    navigator.clipboard.writeText(url);
    setCopiedDomain(domainKey);
    setTimeout(() => {
      setCopiedDomain(null);
    }, 2500);
  };

  const handleRetryProcessing = async (interviewId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRetryingIds((prev) => ({ ...prev, [interviewId]: true }));
    setRetryNotice(null);

    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/retry-processing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRetryNotice({
          id: interviewId,
          success: true,
          message: data.message || 'Interview video converted and synced to Drive & Sheets successfully.',
        });
        if (data.interview) {
          setInterviews((prev) =>
            prev.map((i) => (i.id === interviewId ? data.interview : i))
          );
          if (selectedInterview?.id === interviewId) {
            setSelectedInterview(data.interview);
          }
        }
        fetchDashboardData();
      } else {
        setRetryNotice({
          id: interviewId,
          success: false,
          message: data.error || data.message || 'Retry processing failed.',
        });
        if (data.interview) {
          setInterviews((prev) =>
            prev.map((i) => (i.id === interviewId ? data.interview : i))
          );
          if (selectedInterview?.id === interviewId) {
            setSelectedInterview(data.interview);
          }
        }
      }
    } catch (err: unknown) {
      setRetryNotice({
        id: interviewId,
        success: false,
        message: (err as Error).message || 'Failed to trigger retry.',
      });
    } finally {
      setRetryingIds((prev) => ({ ...prev, [interviewId]: false }));
    }
  };

  const handleDeleteInterview = async () => {
    if (!interviewToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/interviews/${interviewToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteNotice(`Successfully deleted interview for ${interviewToDelete.candidateName}.`);
        setInterviews((prev) => prev.filter((i) => i.id !== interviewToDelete.id));
        if (selectedInterview?.id === interviewToDelete.id) {
          setSelectedInterview(null);
          setStreamUrl(null);
        }
        fetchDashboardData();
      } else {
        alert(data.error || 'Failed to delete interview.');
      }
    } catch (e: unknown) {
      alert((e as Error).message || 'Error deleting interview.');
    } finally {
      setIsDeleting(false);
      setInterviewToDelete(null);
    }
  };

  const handleSelectInterview = async (item: InterviewRecord) => {
    // Clear new candidate badge on click
    if (newlyArrivedIds.has(item.id)) {
      setNewlyArrivedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }

    setSelectedInterview(item);
    setReviewStatus(item.hrReviewStatus || 'under_review');
    setReviewNotes(item.hrNotes || '');
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/interviews/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedInterview(data.interview);
        setStreamUrl(data.streamUrl || null);
      }
    } catch (e) {
      console.error('Failed to load interview details:', e);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedInterview) return;
    setIsSavingReview(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/interviews/${selectedInterview.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hrReviewStatus: reviewStatus,
          hrNotes: reviewNotes,
          hrReviewedBy: 'HR Reviewer',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedInterview(data.interview);
        setSaveSuccess(true);
        // Refresh list in place
        setInterviews((prev) =>
          prev.map((item) => (item.id === data.interview.id ? data.interview : item))
        );
        fetchDashboardData(true);
      }
    } catch (e) {
      console.error('Failed to save review:', e);
    } finally {
      setIsSavingReview(false);
    }
  };

  const getStatusBadge = (status: HRReviewStatus) => {
    switch (status) {
      case 'shortlisted':
        return 'bg-[#EAF3EE] text-[#1B4D36] border-[#2E7D56]/40';
      case 'next_round':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'under_review':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'not_selected':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      default:
        return 'bg-[#FAF7F0] text-slate-700 border-[#E5DEC9]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F0] flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Top Professional Header */}
      <header className="bg-[#0A192F] text-white py-3.5 px-6 sm:px-10 flex justify-between items-center shadow-md shrink-0 border-b border-[#D4AF37]/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FAF7F0] rounded-md flex items-center justify-center p-1 overflow-hidden border border-[#D4AF37]/40">
            <img src="https://i.postimg.cc/ZKgzktH4/official-logo.jpg" alt="GenZ Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight uppercase">GenZ Upskill Foundation</h1>
            <p className="text-[10px] text-[#D4AF37] tracking-[0.2em] font-medium">
              HR EVALUATION DESK & CANDIDATE REVIEWS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Auto-Polling Indicator */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#1B4D36]/40 text-emerald-300 rounded-full text-xs font-medium border border-emerald-500/30"
            title={`Auto-sync polls every 15s. Last updated: ${lastRefreshedAt.toLocaleTimeString()}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Auto-Sync (15s)</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-slate-200 border border-[#D4AF37]/30">
            <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Manual Review Panel</span>
          </div>

          {/* Full Server Re-Fetch Manual Refresh Button */}
          <button
            onClick={() => {
              fetchDashboardData(false);
              fetchB2Status();
              fetchGoogleAuthStatus();
            }}
            disabled={isManualRefreshing}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            title="Force Full Re-fetch from Server"
          >
            <RefreshCw className={`w-4 h-4 ${isManualRefreshing || isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-700/50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close Dashboard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {/* Domain-Locked Registration Links Card (3 Distinct Rows for HR) */}
        <div className="max-w-7xl mx-auto bg-[#FFFDF9] border border-[#D8D0BA] rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DEC9] gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[#1B4D36]" />
                <span>Domain-Locked Candidate Registration Links</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Share these specialized URLs with candidates. The registration portal will pre-select and lock their interview domain.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#1B4D36] bg-[#EAF3EE] px-2.5 py-1 rounded-full border border-[#2E7D56]/30 self-start sm:self-auto">
              3 Active Domains
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {[
              {
                key: 'smm',
                name: 'Social Media Marketing',
                badge: 'SMM',
                badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              },
              {
                key: 'cw',
                name: 'Content Writing',
                badge: 'CW',
                badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
              },
              {
                key: 'ai',
                name: 'AI (Artificial Intelligence)',
                badge: 'AI',
                badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
              },
            ].map((domain) => {
              const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
              const fullUrl = `${origin}/?domain=${domain.key}`;
              const isCopied = copiedDomain === domain.key;

              return (
                <div
                  key={domain.key}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 sm:p-3.5 bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl hover:border-[#1B4D36]/40 transition-colors gap-3"
                >
                  <div className="flex items-center gap-2.5 md:w-64 shrink-0">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${domain.badgeColor}`}
                    >
                      {domain.badge}
                    </span>
                    <span className="text-xs font-bold text-[#0A192F]">{domain.name}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center bg-white border border-[#D8D0BA] rounded-lg px-3 py-1.5 text-xs text-slate-700 font-mono select-all overflow-x-auto whitespace-nowrap shadow-inner">
                      <span className="text-slate-400 select-none mr-1.5">URL:</span>
                      <span className="text-[#0A192F] font-medium">{fullUrl}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => copyDomainLink(domain.key)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-xs ${
                        isCopied
                          ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400/40'
                          : 'bg-[#1B4D36] hover:bg-[#153e2b] text-white border-[#153e2b]'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-500 hover:text-[#0A192F] hover:bg-white rounded-lg border border-transparent hover:border-[#D8D0BA] transition-colors"
                      title={`Open ${domain.name} registration link in new tab`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Backblaze B2 & Google Sheets Storage Diagnostics Panel */}
        <div className="max-w-7xl mx-auto bg-[#FFFDF9] border border-[#D8D0BA] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FAF7F0] rounded-xl border border-[#D8D0BA] text-[#1B4D36]">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                  <span>Storage & Integration Runtime Diagnostics</span>
                </h3>
                <p className="text-xs text-slate-600">
                  Real-time server configuration status for Backblaze B2 video storage (S3-compatible) & Google Sheets candidate records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
              {/* Backblaze B2 Status Pill */}
              {b2Status ? (
                b2Status.isConfigured ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>B2: S3 Storage Active (Private)</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>B2: Not Configured (Local Fallback)</span>
                  </span>
                )
              ) : (
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Checking B2...
                </span>
              )}

              {/* Google Sheets Status Pill */}
              {googleAuthStatus ? (
                googleAuthStatus.hasServiceAccountPrivateKey ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sheets: Service Account Active</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1 shadow-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Sheets: Key Missing</span>
                  </span>
                )
              ) : null}

              <button
                type="button"
                onClick={() => setShowDiagnosticsPanel(!showDiagnosticsPanel)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-[#FAF7F0] hover:bg-[#F2ECE1] text-[#0A192F] border border-[#D8D0BA] transition-colors cursor-pointer"
              >
                <span>{showDiagnosticsPanel ? 'Hide Details' : 'View Diagnostics'}</span>
                {showDiagnosticsPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expanded Diagnostics Details */}
          {showDiagnosticsPanel && (
            <div className="pt-3 border-t border-[#E5DEC9] space-y-4 animate-in fade-in-50 duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* B2 Key ID */}
                <div className="p-3 bg-[#FAF7F0] rounded-xl border border-[#E5DEC9] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase">
                    <span className="flex items-center gap-1"><Key className="w-3 h-3 text-[#1B4D36]" /> B2 Key ID</span>
                    <span className={b2Status?.hasKeyId ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                      {b2Status?.hasKeyId ? 'PRESENT' : 'MISSING'}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[#0A192F] font-semibold truncate">
                    {b2Status?.hasKeyId ? (b2Status.keyIdMasked || `Set (${b2Status.keyIdLength} chars)`) : 'B2_KEY_ID not set'}
                  </p>
                </div>

                {/* B2 Application Key */}
                <div className="p-3 bg-[#FAF7F0] rounded-xl border border-[#E5DEC9] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#1B4D36]" /> B2 Application Key</span>
                    <span className={b2Status?.hasApplicationKey ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                      {b2Status?.hasApplicationKey ? 'PRESENT' : 'MISSING'}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[#0A192F] font-semibold">
                    {b2Status?.hasApplicationKey ? 'Configured in Environment' : 'B2_APPLICATION_KEY not set'}
                  </p>
                </div>

                {/* B2 Bucket Name */}
                <div className="p-3 bg-[#FAF7F0] rounded-xl border border-[#E5DEC9] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase">
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-[#1B4D36]" /> B2 Bucket</span>
                    <span className={b2Status?.hasBucketName ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                      {b2Status?.hasBucketName ? 'CONFIGURED' : 'MISSING'}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[#0A192F] font-semibold truncate">
                    {b2Status?.bucketName || 'B2_BUCKET_NAME not set'}
                  </p>
                </div>

                {/* B2 S3 Endpoint & Region */}
                <div className="p-3 bg-[#FAF7F0] rounded-xl border border-[#E5DEC9] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#1B4D36]" /> Endpoint & Region</span>
                    <span className="text-emerald-700 font-bold uppercase">{b2Status?.region || 'us-west-004'}</span>
                  </div>
                  <p className="font-mono text-[11px] text-[#0A192F] font-semibold truncate" title={b2Status?.endpoint}>
                    {b2Status?.endpoint || 'https://s3.us-west-004.backblazeb2.com'}
                  </p>
                </div>
              </div>

              {/* Target Resources Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#FAF7F0] p-3 rounded-xl border border-[#E5DEC9]">
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-[#1B4D36] shrink-0" />
                  <span className="font-semibold text-slate-500">Video Storage:</span>
                  <span className="font-mono text-[#0A192F] font-bold truncate">
                    Backblaze B2 (Private Bucket, 1-Hour Presigned URLs)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-[#1B4D36] shrink-0" />
                  <span className="font-semibold text-slate-500">Google Sheets:</span>
                  <span className="font-mono text-[#0A192F] font-bold truncate">
                    {googleAuthStatus?.spreadsheetId || 'Default Spreadsheet'} ({googleAuthStatus?.sheetName || 'Candidate_Interviews'})
                  </span>
                </div>
              </div>

              {/* Actions & Live Connection Test Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Test B2 Access Button */}
                  <button
                    type="button"
                    onClick={handleTestB2Access}
                    disabled={isTestingB2}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1B4D36] hover:bg-[#143D2B] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingB2 ? 'animate-spin' : ''}`} />
                    <span>{isTestingB2 ? 'Testing B2 Access...' : 'Test B2 Access'}</span>
                  </button>

                  {/* Test Sheets Access Button */}
                  <button
                    type="button"
                    onClick={handleTestGooglePermissions}
                    disabled={isTestingPermissions}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#FAF7F0] text-[#0A192F] border border-[#D8D0BA] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingPermissions ? 'animate-spin' : ''}`} />
                    <span>{isTestingPermissions ? 'Testing Sheets...' : 'Test Sheets Access'}</span>
                  </button>

                  {/* Re-check Config Button */}
                  <button
                    type="button"
                    onClick={() => {
                      fetchB2Status();
                      fetchGoogleAuthStatus();
                    }}
                    disabled={isLoadingB2Status || isLoadingAuthStatus}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#FAF7F0] text-[#0A192F] border border-[#D8D0BA] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingB2Status || isLoadingAuthStatus ? 'animate-spin' : ''}`} />
                    <span>Re-check Config</span>
                  </button>
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  Storage: Backblaze B2 (S3) | Records: Google Sheets (Service Account)
                </span>
              </div>

              {/* Backblaze B2 Live Connection Test Result Banner */}
              {b2TestResult && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  b2TestResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {b2TestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      Backblaze B2 Live Connection Test: {b2TestResult.success ? 'Connected & Verified' : 'Connection Failed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setB2TestResult(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {b2TestResult.success ? (
                    <div className="space-y-1 text-[11px]">
                      <p>
                        ✅ <strong>Bucket Access:</strong> Successfully reached bucket <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-emerald-800">{b2TestResult.bucketName}</code> on endpoint <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-emerald-800">{b2TestResult.endpoint}</code> (Region: {b2TestResult.region}).
                      </p>
                      <p>
                        🔐 <strong>Presigning Capability:</strong> Verified! S3-compatible time-limited presigned URLs generate correctly with 1-hour expiration.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] font-mono">
                      ❌ {b2TestResult.error}
                    </p>
                  )}
                </div>
              )}

              {/* Google Sheets Test Result Banner */}
              {testPermissionsResult && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  testPermissionsResult.sheetsOk || testPermissionsResult.sheets?.canAppend
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {testPermissionsResult.sheetsOk || testPermissionsResult.sheets?.canAppend ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      Google Sheets Connection Test: {testPermissionsResult.sheetsOk || testPermissionsResult.sheets?.canAppend ? 'Reachable' : 'Attention Needed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTestPermissionsResult(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px]">
                    {testPermissionsResult.sheetsOk || testPermissionsResult.sheets?.canAppend
                      ? `✅ Google Sheets Service Account active: "${testPermissionsResult.spreadsheetTitle || 'Spreadsheet OK'}"`
                      : `❌ ${testPermissionsResult.sheetsError || testPermissionsResult.sheets?.error || 'Unavailable'}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Delete / Notification Banner */}
        {deleteNotice && (
          <div className="max-w-7xl mx-auto p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{deleteNotice}</span>
            </div>
            <button onClick={() => setDeleteNotice(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* KPI Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-7xl mx-auto">
          <div className="bg-[#FFFDF9] p-4 rounded-xl border border-[#E5DEC9] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-[#FAF7F0] text-[#0A192F] rounded-lg border border-[#E5DEC9]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">Total Candidates</p>
              <h3 className="text-xl font-bold text-[#0A192F]">{stats?.totalCandidates ?? 0}</h3>
            </div>
          </div>

          <div className="bg-[#FFFDF9] p-4 rounded-xl border border-[#E5DEC9] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-[#EAF3EE] text-[#1B4D36] rounded-lg border border-[#2E7D56]/30">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">Completed Interviews</p>
              <h3 className="text-xl font-bold text-[#0A192F]">{stats?.completedInterviews ?? 0}</h3>
            </div>
          </div>

          <div className="bg-[#FFFDF9] p-4 rounded-xl border border-[#E5DEC9] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">Pending HR Review</p>
              <h3 className="text-xl font-bold text-[#0A192F]">{stats?.pendingReviews ?? 0}</h3>
            </div>
          </div>

          <div className="bg-[#FFFDF9] p-4 rounded-xl border border-[#E5DEC9] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-[#EAF3EE] text-[#1B4D36] rounded-lg border border-[#2E7D56]/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">Shortlisted</p>
              <h3 className="text-xl font-bold text-[#0A192F]">{stats?.shortlistedCount ?? 0}</h3>
            </div>
          </div>
        </div>

        {/* Master Details Split View */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Table / List (7 cols) */}
          <div className="lg:col-span-7 bg-[#FFFDF9] rounded-2xl border border-[#E5DEC9] shadow-sm overflow-hidden flex flex-col">
            {/* Table Filters Toolbar */}
            <div className="p-4 border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 bg-[#FAF7F0]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, email, college..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchDashboardData()}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[#D8D0BA] bg-white text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#1B4D36]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="text-xs border border-[#D8D0BA] rounded-lg px-3 py-2 bg-white text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#1B4D36]"
                >
                  <option value="All">All Domains</option>
                  {DEFAULT_DOMAINS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs border border-[#D8D0BA] rounded-lg px-3 py-2 bg-white text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#1B4D36]"
                >
                  <option value="All">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="next_round">Next Round</option>
                  <option value="not_selected">Not Selected</option>
                </select>
              </div>
            </div>

            {/* New Interview Live Notification Banner */}
            {newInterviewBanner && (
              <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
                  <div className="p-1 bg-emerald-600 text-white rounded-md">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span>
                    <strong>{newInterviewBanner.count} new interview{newInterviewBanner.count > 1 ? 's' : ''}</strong> received from <strong>{newInterviewBanner.name}</strong> ({newInterviewBanner.domain}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewInterviewBanner(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2 py-1 rounded-md hover:bg-emerald-100 cursor-pointer transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Candidate Interview List */}
            <div className="divide-y divide-[#E5DEC9] overflow-y-auto max-h-[560px]">
              {interviews.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No interview recordings match the selected filters.
                </div>
              ) : (
                interviews.map((item) => {
                  const isSelected = selectedInterview?.id === item.id;
                  const isNew = newlyArrivedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectInterview(item)}
                      className={`p-4 transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-[#EAF3EE] border-l-4 border-[#1B4D36]'
                          : isNew
                          ? 'bg-emerald-50/70 border-l-4 border-emerald-500 hover:bg-emerald-50'
                          : 'hover:bg-[#FAF7F0]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#0A192F] truncate">
                            {item.candidateName}
                          </span>
                          {isNew && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs flex items-center gap-1 animate-pulse">
                              <Sparkles className="w-2.5 h-2.5" />
                              NEW
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadge(item.hrReviewStatus)}`}>
                            {item.hrReviewStatus.replace('_', ' ')}
                          </span>
                          {item.processingStatus === 'processing' && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Syncing...
                            </span>
                          )}
                          {item.processingStatus === 'failed' && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                              Sync Failed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="font-bold text-[#1B4D36]">{item.domain}</span>
                          <span>•</span>
                          <span className="truncate">{item.candidateCollege}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">{item.id}</span>
                        </div>
                        {(item.processingStatus === 'failed' || item.processingStatus === 'processing') && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleRetryProcessing(item.id, e)}
                              disabled={retryingIds[item.id]}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                              title="Retry video conversion, Google Drive upload, and Google Sheets sync"
                            >
                              <RotateCcw className={`w-2.5 h-2.5 ${retryingIds[item.id] ? 'animate-spin text-amber-700' : ''}`} />
                              <span>{retryingIds[item.id] ? 'Retrying...' : 'Retry Sync'}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {item.recordingDurationSeconds ? (
                            <span className="text-[11px] font-bold text-[#1B4D36]">
                              {Math.floor(item.recordingDurationSeconds / 60)}m {item.recordingDurationSeconds % 60}s
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">In progress</span>
                          )}
                        </div>

                        {/* Direct row delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInterviewToDelete(item);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Interview"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Detailed Review Panel (5 cols) */}
          <div className="lg:col-span-5 bg-[#FFFDF9] rounded-2xl border border-[#E5DEC9] shadow-sm p-6 space-y-6">
            {selectedInterview ? (
              <>
                <div className="border-b border-[#E5DEC9] pb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-[#0A192F] bg-[#FAF7F0] border border-[#D8D0BA] px-2 py-0.5 rounded">
                        {selectedInterview.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadge(selectedInterview.hrReviewStatus)}`}>
                        {selectedInterview.hrReviewStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-[#0A192F]">{selectedInterview.candidateName}</h3>
                    <p className="text-xs text-[#1B4D36] font-bold">{selectedInterview.domain} Specialization</p>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => setInterviewToDelete(selectedInterview)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                    title="Delete Interview Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Retry Status / Notice Alert Banner */}
                {retryNotice && retryNotice.id === selectedInterview.id && (
                  <div className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 ${
                    retryNotice.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {retryNotice.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>{retryNotice.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRetryNotice(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Candidate Info Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF7F0] p-3.5 rounded-xl border border-[#E5DEC9]">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-[#1B4D36]" />
                    <span className="truncate">{selectedInterview.candidateEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-[#1B4D36]" />
                    <span>{selectedInterview.candidateMobile}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 col-span-2">
                    <GraduationCap className="w-3.5 h-3.5 text-[#1B4D36]" />
                    <span className="truncate">{selectedInterview.candidateCollege}</span>
                  </div>
                </div>

                {/* Video Playback Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold text-[#0A192F] uppercase tracking-wider flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[#1B4D36]" />
                      <span>Interview Video Recording</span>
                    </h4>
                    {streamUrl && (
                      <button
                        type="button"
                        onClick={() => handleRefreshVideoUrl(selectedInterview.id)}
                        disabled={isRefreshingStream}
                        className="text-[10px] text-[#1B4D36] hover:text-[#0A192F] flex items-center gap-1 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        title="Generate a fresh 1-hour presigned playback URL"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isRefreshingStream ? 'animate-spin' : ''}`} />
                        <span>{isRefreshingStream ? 'Refreshing...' : 'Refresh URL'}</span>
                      </button>
                    )}
                  </div>

                  {streamUrl ? (
                    <div className="rounded-xl overflow-hidden bg-slate-950 border border-[#E5DEC9] aspect-video flex items-center justify-center relative group">
                      <video
                        key={streamUrl}
                        src={streamUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] text-center text-xs text-[#0A192F]/70 font-medium">
                      No recording video stream available for this candidate.
                    </div>
                  )}

                  {selectedInterview.processingStatus === 'processing' && (
                    <div className="mt-2 flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        <span className="text-[11px] text-amber-800 font-medium">
                          MP4 conversion & Cloud sync in progress (local file saved)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRetryProcessing(selectedInterview.id)}
                        disabled={retryingIds[selectedInterview.id]}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 border border-amber-400/50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3 h-3 ${retryingIds[selectedInterview.id] ? 'animate-spin' : ''}`} />
                        <span>{retryingIds[selectedInterview.id] ? 'Retrying...' : 'Re-run Sync'}</span>
                      </button>
                    </div>
                  )}

                  {selectedInterview.processingStatus === 'failed' && (
                    <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-[11px] text-red-800 font-bold block">
                            Sync Status: {selectedInterview.processingError ? (
                              selectedInterview.processingError.length > 140
                                ? `${selectedInterview.processingError.slice(0, 140)}...`
                                : selectedInterview.processingError
                            ) : 'Recording file was incomplete/corrupted'}
                          </span>
                          <span className="text-[10px] text-red-600 block mt-0.5">
                            Local raw recording is safely preserved in server storage. You can attempt a re-sync.
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleRetryProcessing(selectedInterview.id)}
                          disabled={retryingIds[selectedInterview.id]}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-700 hover:bg-red-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${retryingIds[selectedInterview.id] ? 'animate-spin' : ''}`} />
                          <span>{retryingIds[selectedInterview.id] ? 'Retrying Sync...' : 'Retry Sync to Drive & Sheets'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {(streamUrl || selectedInterview.driveFileId || selectedInterview.driveViewLink) && (
                    <div className="mt-2 flex items-center justify-between p-2.5 rounded-lg bg-[#FAF7F0] border border-[#E5DEC9]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[11px] text-[#0A192F] font-medium">
                          Google Drive Video Storage
                        </span>
                      </div>
                      {(selectedInterview.driveViewLink || streamUrl) && (
                        <a
                          href={selectedInterview.driveViewLink || streamUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1B4D36] hover:underline"
                        >
                          <span>Open in Google Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Question Breakdown Timeline */}
                {selectedInterview.answers && selectedInterview.answers.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-2">
                      Questions Answered ({selectedInterview.answers.length})
                    </h4>
                    <div className="space-y-2.5 max-h-56 overflow-y-auto">
                      {selectedInterview.answers.map((ans, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-[#FAF7F0] border border-[#E5DEC9] text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-[#0A192F]">Q{ans.questionOrder}: {ans.questionText}</p>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {ans.durationSeconds}s
                            </span>
                          </div>
                          {ans.writtenAnswer && (
                            <div className="p-2.5 rounded-md bg-amber-50/80 border border-amber-200 text-slate-800">
                              <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1 mb-1">
                                <PenTool className="w-3 h-3 text-amber-700" />
                                <span>Candidate Written Assignment Response:</span>
                              </p>
                              <p className="font-sans leading-relaxed whitespace-pre-wrap text-xs font-medium text-slate-900">
                                {ans.writtenAnswer}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HR Decision & Evaluation */}
                <div className="border-t border-[#E5DEC9] pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-[#0A192F] uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#1B4D36]" />
                    <span>Manual HR Evaluation Form</span>
                  </h4>

                  <div>
                    <label className="block text-[10px] font-bold text-[#0A192F] uppercase mb-1">
                      Review Status Decision
                    </label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value as HRReviewStatus)}
                      className="w-full text-xs border border-[#D8D0BA] rounded-lg p-2.5 bg-[#FAF7F0] text-[#0A192F] focus:bg-white focus:ring-2 focus:ring-[#1B4D36] font-bold"
                    >
                      <option value="under_review">Under Review</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="next_round">Next Round Interview</option>
                      <option value="not_selected">Not Selected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#0A192F] uppercase mb-1">
                      HR Evaluation Notes & Feedback
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add candidate strengths, communication observations, domain fit..."
                      className="w-full text-xs border border-[#D8D0BA] rounded-lg p-2.5 bg-[#FAF7F0] text-[#0A192F] focus:bg-white focus:ring-2 focus:ring-[#1B4D36]"
                    />
                  </div>

                  {saveSuccess && (
                    <div className="p-2.5 rounded-lg bg-[#EAF3EE] text-[#1B4D36] border border-[#2E7D56]/30 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Evaluation saved successfully.
                    </div>
                  )}

                  <button
                    onClick={handleSaveReview}
                    disabled={isSavingReview}
                    className="w-full py-2.5 rounded-lg bg-[#1B4D36] hover:bg-[#143D2B] text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs border border-[#143D2B]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingReview ? 'Saving Decision...' : 'Save Evaluation'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Select a candidate from the left list to review their interview recording and enter evaluation.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {interviewToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0A192F]">Delete Interview Record?</h3>
                <p className="text-xs text-slate-600">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-[#FAF7F0] p-3 rounded-xl border border-[#E5DEC9]">
              Are you sure you want to permanently delete the interview record for <strong>{interviewToDelete.candidateName}</strong> ({interviewToDelete.id})? All local recording files will be removed from storage.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setInterviewToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-[#FAF7F0] rounded-lg border border-[#D8D0BA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteInterview}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-sm cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
