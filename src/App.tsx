/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppStep, CandidateFormData, InterviewQuestion, QuestionAnswerMetadata } from './types';
import { getQuestionsForDomain, DEFAULT_DOMAINS } from './lib/questions';
import { InterviewMediaManager } from './lib/recorder';
import { Navbar } from './components/Navbar';
import { WelcomeHero } from './components/WelcomeHero';
import { CandidateForm } from './components/CandidateForm';
import { ConsentScreen } from './components/ConsentScreen';
import { DeviceCheck } from './components/DeviceCheck';
import { InterviewRoom } from './components/InterviewRoom';
import { CompletionScreen } from './components/CompletionScreen';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { ShieldCheck, Video, Mic, CheckCircle2, ArrowRight, Lock, UserCheck } from 'lucide-react';

const INITIAL_FORM: CandidateFormData = {
  fullName: '',
  email: '',
  mobile: '',
  college: '',
  domain: 'Social Media Marketing (SMM)',
  agreedToConsent: false,
};

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('welcome');
  const [candidateData, setCandidateData] = useState<CandidateFormData>(INITIAL_FORM);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [submittedInterviewId, setSubmittedInterviewId] = useState<string>('');

  // Admin state
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Persistent media manager instance across steps
  const mediaManagerRef = useRef<InterviewMediaManager | null>(null);
  if (!mediaManagerRef.current) {
    mediaManagerRef.current = new InterviewMediaManager();
  }

  // Load admin token from localStorage if available
  useEffect(() => {
    const token = localStorage.getItem('genz_admin_token');
    if (token) {
      setAdminToken(token);
    }
  }, []);

  const handleCandidateFormSubmit = (data: CandidateFormData) => {
    setCandidateData(data);
    const domainQuestions = getQuestionsForDomain(data.domain);
    setQuestions(domainQuestions);
    setCurrentStep('consent');
  };

  const handleConsentGiven = () => {
    setCurrentStep('device-check');
  };

  const handleDevicesReady = () => {
    setCurrentStep('interview');
  };

  const handleFinishInterview = async ({
    durationSeconds,
    recordedBlob,
    answers,
    chunksCount = 1,
    sizeBytes,
    submitStartTime = Date.now(),
  }: {
    durationSeconds: number;
    recordedBlob: Blob;
    answers: QuestionAnswerMetadata[];
    chunksCount?: number;
    sizeBytes?: number;
    submitStartTime?: number;
  }) => {
    try {
      const interviewId = `GZ-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;

      const actualSize = sizeBytes || recordedBlob.size || 0;
      const isMp4 = recordedBlob.type.includes('mp4');
      const fileExt = isMp4 ? 'mp4' : 'webm';
      const cleanMime = isMp4 ? 'video/mp4' : 'video/webm';
      const fileName = `interview-${interviewId}.${fileExt}`;

      // Upload interview payload and video multipart to backend
      const formData = new FormData();
      formData.append('id', interviewId);
      formData.append('candidateName', candidateData.fullName);
      formData.append('candidateEmail', candidateData.email);
      formData.append('candidateMobile', candidateData.mobile);
      formData.append('candidateCollege', candidateData.college);
      formData.append('domain', candidateData.domain);
      formData.append('recordingDurationSeconds', String(durationSeconds));
      formData.append('answers', JSON.stringify(answers));

      if (!recordedBlob || recordedBlob.size === 0) {
        throw new Error('Recorded video is empty. Please check your camera/microphone and retry.');
      }

      if (durationSeconds <= 0) {
        throw new Error('Invalid recording duration detected.');
      }

      // Client-side sanity check on recording size vs. duration
      const minAcceptableBytes = Math.min(30000, Math.max(4096, durationSeconds * 2000));
      if (actualSize < minAcceptableBytes && durationSeconds > 5) {
        console.warn(
          `[Portal:Submission] ⚠️ Recording size (${actualSize} bytes) appears very small for ${durationSeconds}s duration. Expected at least ${minAcceptableBytes} bytes.`
        );
      }

      const videoFile = new File([recordedBlob], fileName, {
        type: cleanMime,
      });
      formData.append('video', videoFile, fileName);

      console.log(
        `[UPLOAD] FormData created ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
      );
      console.log('fileField=video');
      console.log(`filename=${fileName}`);
      console.log(`size=${actualSize}`);
      console.log(`duration=${durationSeconds}`);
      console.log(`chunkCount=${chunksCount}`);

      const targetUrl = `${window.location.origin}/api/interview/submit`;
      console.log(
        `[UPLOAD] POST started ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
      );
      console.log(`[UPLOAD] POST URL=${targetUrl}`);

      // Safe timeout on fetch (90 seconds)
      const abortController = new AbortController();
      const fetchTimeout = setTimeout(() => abortController.abort(), 90000);

      const res = await fetch('/api/interview/submit', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      }).finally(() => clearTimeout(fetchTimeout));

      console.log(
        `[UPLOAD] HTTP response received ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
      );
      const responseText = await res.text();
      console.log(
        `[UPLOAD] Response body received ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
      );
      console.log(`[UPLOAD] HTTP status=${res.status}`);
      console.log(`[UPLOAD] Response body=${responseText}`);

      let result: any = null;
      try {
        result = JSON.parse(responseText);
      } catch {
        // Non-JSON response
      }

      if (!res.ok || !result?.success) {
        const errorMessage =
          result?.message ||
          result?.error ||
          `Upload failed with status HTTP ${res.status}: ${responseText.slice(0, 100)}`;
        console.error('[Portal:Submission] ❌ Backend rejected interview submission:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('[Portal:Submission] ✅ Server processed submission successfully:', result);
      setSubmittedInterviewId(result.interviewId || interviewId);
      setCurrentStep('completed');
    } catch (err: unknown) {
      const error = err as Error;
      let msg = error?.message || 'Failed to submit interview recording.';
      if (error.name === 'AbortError') {
        msg = 'The submission timed out. Please check your network connection and retry.';
      }
      console.error('[Portal:Submission] ❌ Failed to submit interview recording:', msg);
      throw new Error(msg);
    }
  };

  const handleResetToHome = () => {
    if (mediaManagerRef.current) {
      mediaManagerRef.current.cleanup();
    }
    setCandidateData(INITIAL_FORM);
    setCurrentStep('welcome');
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] font-sans text-[#0A192F] flex flex-col selection:bg-[#1B4D36] selection:text-white">
      {/* Top Header - Branded Dark Navy with Gold Accents */}
      <header className="bg-[#0A192F] text-white py-3.5 px-4 sm:px-12 flex justify-between items-center shadow-md border-b border-[#D4AF37]/30 sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#FAF7F0] rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden border border-[#D4AF37]/40">
            <img
              src="/official-logo.png"
              alt="GenZ Upskill Foundation Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight uppercase leading-none text-white">
              GenZ Upskill Foundation
            </h1>
            <p className="text-[10px] text-[#D4AF37] tracking-[0.2em] font-semibold mt-1">
              SKILLS FOR A BETTER TOMORROW
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-300 block">System Status</span>
            <span className="text-xs font-semibold flex items-center justify-end gap-1.5 text-emerald-400">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Portal Ready
            </span>
          </div>

          <button
            onClick={() => {
              if (adminToken) {
                setIsAdminDashboardOpen(true);
              } else {
                setIsAdminModalOpen(true);
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-100 hover:text-white bg-[#1B4D36] hover:bg-[#143D2B] px-3.5 py-2 rounded-lg transition-colors border border-[#D4AF37]/40 hover:border-[#D4AF37] cursor-pointer shadow-xs"
          >
            {adminToken ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>HR Desk</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>HR Login</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Flow Content */}
      <main className="flex-1 flex flex-col justify-center py-6">
        {currentStep === 'welcome' && (
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 my-auto">
            <div className="bg-[#FFFDF9] rounded-2xl shadow-xl border border-[#E6DEC9] flex flex-col md:flex-row overflow-hidden min-h-[580px]">
              {/* Left Column: Dark Navy Portal Briefing with Gold & Green Highlights */}
              <div className="w-full md:w-2/5 bg-[#0A192F] p-8 sm:p-10 text-white flex flex-col justify-between border-r border-[#D4AF37]/20">
                <section>
                  <div>
                    <span className="inline-block px-3 py-1 bg-[#1B4D36] text-[10px] font-bold rounded-full mb-4 uppercase tracking-wider text-amber-100 border border-[#D4AF37]/30">
                      Official Candidate Portal
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-light leading-tight mb-4">
                      Welcome to your <br />
                      <span className="font-bold text-[#D4AF37]">Internship Interview</span>
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
                      We are excited to learn more about your skills and aspirations. Please ensure you are in a quiet environment with camera and microphone ready before proceeding.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full border border-[#D4AF37] bg-[#D4AF37]/10 flex items-center justify-center text-[10px] text-[#D4AF37] font-bold shrink-0">
                        1
                      </div>
                      <p className="text-xs text-slate-300">
                        Provide your academic and contact information.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full border border-[#D4AF37] bg-[#D4AF37]/10 flex items-center justify-center text-[10px] text-[#D4AF37] font-bold shrink-0">
                        2
                      </div>
                      <p className="text-xs text-slate-300">
                        Grant camera and microphone access for continuous video recording.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full border border-[#D4AF37] bg-[#D4AF37]/10 flex items-center justify-center text-[10px] text-[#D4AF37] font-bold shrink-0">
                        3
                      </div>
                      <p className="text-xs text-slate-300">
                        Respond to 6 pre-selected domain questions asked via natural voice.
                      </p>
                    </div>
                  </div>
                </section>

                <footer className="border-t border-white/10 pt-4 mt-6">
                  <p className="text-[10px] text-slate-400 italic leading-snug">
                    Note: Interviews are reviewed manually by our HR department. No automated AI decisions or rankings are made.
                  </p>
                </footer>
              </div>

              {/* Right Column: Registration Form with Warm Cream Card Styling */}
              <div className="w-full md:w-3/5 p-8 sm:p-10 flex flex-col justify-center bg-[#FFFDF9]">
                <h3 className="text-lg sm:text-xl font-bold mb-6 text-[#0A192F] border-l-4 border-[#1B4D36] pl-3.5">
                  Candidate Registration
                </h3>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!candidateData.fullName.trim()) {
                      alert('Please enter your full name');
                      return;
                    }
                    if (!candidateData.email.trim()) {
                      alert('Please enter your email address');
                      return;
                    }
                    if (!candidateData.mobile.trim()) {
                      alert('Please enter your mobile number');
                      return;
                    }
                    handleCandidateFormSubmit(candidateData);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={candidateData.fullName}
                        onChange={(e) =>
                          setCandidateData({ ...candidateData, fullName: e.target.value })
                        }
                        placeholder="e.g. John Doe"
                        className="w-full border border-[#D8D0BA] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={candidateData.email}
                        onChange={(e) =>
                          setCandidateData({ ...candidateData, email: e.target.value })
                        }
                        placeholder="e.g. john@university.edu"
                        className="w-full border border-[#D8D0BA] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={candidateData.mobile}
                        onChange={(e) =>
                          setCandidateData({ ...candidateData, mobile: e.target.value })
                        }
                        placeholder="e.g. +91 98765 43210"
                        className="w-full border border-[#D8D0BA] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                        College / University <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={candidateData.college}
                        onChange={(e) =>
                          setCandidateData({ ...candidateData, college: e.target.value })
                        }
                        placeholder="e.g. Institute of Technology"
                        className="w-full border border-[#D8D0BA] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                      Internship Domain <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={candidateData.domain}
                      onChange={(e) =>
                        setCandidateData({
                          ...candidateData,
                          domain: e.target.value as CandidateFormData['domain'],
                        })
                      }
                      className="w-full border border-[#D8D0BA] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F] cursor-pointer"
                    >
                      {DEFAULT_DOMAINS.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-[#EAF3EE]/80 p-3.5 rounded-lg border border-[#2E7D56]/30 mt-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        className="mt-0.5 w-4 h-4 rounded text-[#1B4D36] border-[#D8D0BA] focus:ring-[#1B4D36] cursor-pointer"
                      />
                      <span className="text-[11px] text-[#0A192F] leading-tight">
                        I understand that this interview will be recorded for evaluation by GenZ Upskill Foundation. I agree to share my camera and microphone for this process.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    id="btn-start-interview-submit"
                    className="w-full bg-[#1B4D36] hover:bg-[#143D2B] text-white font-bold py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-4 uppercase text-xs tracking-widest cursor-pointer border border-[#143D2B]"
                  >
                    <span>Start Interview</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'form' && (
          <CandidateForm
            initialData={candidateData}
            onSubmit={handleCandidateFormSubmit}
            onBack={() => setCurrentStep('welcome')}
          />
        )}

        {currentStep === 'consent' && (
          <ConsentScreen
            candidateData={candidateData}
            onConsentGiven={handleConsentGiven}
            onBack={() => setCurrentStep('welcome')}
          />
        )}

        {currentStep === 'device-check' && mediaManagerRef.current && (
          <DeviceCheck
            mediaManager={mediaManagerRef.current}
            onDevicesReady={handleDevicesReady}
            onBack={() => setCurrentStep('consent')}
          />
        )}

        {currentStep === 'interview' && mediaManagerRef.current && (
          <InterviewRoom
            candidateData={candidateData}
            questions={questions}
            mediaManager={mediaManagerRef.current}
            onFinishInterview={handleFinishInterview}
          />
        )}

        {currentStep === 'completed' && (
          <CompletionScreen
            candidateData={candidateData}
            interviewId={submittedInterviewId}
            onReturnHome={handleResetToHome}
          />
        )}
      </main>

      {/* Official Footer with Warm Navy & Gold Styling */}
      <footer className="bg-[#0A192F] border-t border-[#D4AF37]/30 text-slate-300 py-4 px-4 sm:px-12 flex flex-col sm:flex-row justify-between items-center text-[10px] font-medium uppercase tracking-widest gap-2">
        <div className="text-slate-300">&copy; 2026 GenZ Upskill Foundation. All Rights Reserved.</div>
        <div className="flex gap-6 text-[#D4AF37]">
          <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
          <span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span>
          <span className="hover:text-white transition-colors cursor-pointer">HR Evaluation Desk</span>
        </div>
      </footer>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={(token) => {
          setAdminToken(token);
          setIsAdminDashboardOpen(true);
        }}
      />

      {/* Admin Dashboard */}
      {isAdminDashboardOpen && adminToken && (
        <AdminDashboard
          token={adminToken}
          onLogout={async () => {
            try {
              if (adminToken) {
                await fetch('/api/admin/logout', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${adminToken}`,
                  },
                });
              }
            } catch (err) {
              console.warn('[Admin:Logout] Error calling logout endpoint:', err);
            }
            localStorage.removeItem('genz_admin_token');
            setAdminToken(null);
            setIsAdminDashboardOpen(false);
          }}
          onClose={() => setIsAdminDashboardOpen(false)}
        />
      )}
    </div>
  );
}
