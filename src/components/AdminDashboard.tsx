/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

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

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      // Fetch interviews
      const query = new URLSearchParams();
      if (domainFilter !== 'All') query.append('domain', domainFilter);
      if (statusFilter !== 'All') query.append('status', statusFilter);
      if (searchQuery) query.append('search', searchQuery);

      const interviewsRes = await fetch(`/api/admin/interviews?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (interviewsRes.ok) {
        const data = await interviewsRes.json();
        setInterviews(data.interviews || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [domainFilter, statusFilter]);

  const handleSelectInterview = async (item: InterviewRecord) => {
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
        fetchDashboardData();
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
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-slate-200 border border-[#D4AF37]/30">
            <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Manual Review Panel</span>
          </div>

          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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

            {/* Candidate Interview List */}
            <div className="divide-y divide-[#E5DEC9] overflow-y-auto max-h-[560px]">
              {interviews.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No interview recordings match the selected filters.
                </div>
              ) : (
                interviews.map((item) => {
                  const isSelected = selectedInterview?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectInterview(item)}
                      className={`p-4 transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected ? 'bg-[#EAF3EE] border-l-4 border-[#1B4D36]' : 'hover:bg-[#FAF7F0]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#0A192F] truncate">
                            {item.candidateName}
                          </span>
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
