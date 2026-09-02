/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppStep, CandidateFormData, InterviewQuestion, QuestionAnswerMetadata, InternshipDomain } from './types';
import { getQuestionsForDomain, DEFAULT_DOMAINS } from './lib/questions';
import { InterviewMediaManager } from './lib/recorder';
import { CandidateForm } from './components/CandidateForm';
import { CountrySelect } from './components/CountrySelect';
import { LegalModal, LegalDocType } from './components/LegalModal';
import { ConsentScreen } from './components/ConsentScreen';
import { DeviceCheck } from './components/DeviceCheck';
import { InterviewRoom } from './components/InterviewRoom';
import { CompletionScreen } from './components/CompletionScreen';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { ShieldCheck, ArrowRight, Lock, AlertCircle, Phone, Mail, User, GraduationCap, Briefcase } from 'lucide-react';

const INITIAL_FORM: CandidateFormData = {
  fullName: '',
  email: '',
  mobile: '',
  countryCode: '+91',
  college: '',
  domain: 'Social Media Marketing (SMM)',
  agreedToConsent: false,
};

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('welcome');
  const [candidateData, setCandidateData] = useState<CandidateFormData>(INITIAL_FORM);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('+91');
  const [isDomainLocked, setIsDomainLocked] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [submittedInterviewId, setSubmittedInterviewId] = useState<string>('');

  // Admin state
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Legal Modal State (Privacy Policy / Terms of Service)
  const [legalModalType, setLegalModalType] = useState<LegalDocType>(null);

  // Persistent media manager instance across steps
  const mediaManagerRef = useRef<InterviewMediaManager | null>(null);
  if (!mediaManagerRef.current) {
    mediaManagerRef.current = new InterviewMediaManager();
  }

  // Load admin token from localStorage & parse domain param from URL on startup
  useEffect(() => {
    const token = localStorage.getItem('genz_admin_token');
    if (token) {
      setAdminToken(token);
    }

    try {
      // Check search params and hash query params
      const searchStr = window.location.search || '';
      const hashStr = window.location.hash.includes('?') ? window.location.hash.substring(window.location.hash.indexOf('?')) : '';
      const combinedParams = new URLSearchParams(searchStr || hashStr);

      const domainParam =
        combinedParams.get('domain') ||
        combinedParams.get('d') ||
        combinedParams.get('track') ||
        combinedParams.get('assigned_domain') ||
        combinedParams.get('internship_domain');

      if (domainParam) {
        const dClean = decodeURIComponent(domainParam).toLowerCase().trim();
        let matchedDomain: InternshipDomain | null = null;

        if (
          dClean === 'smm' ||
          dClean.includes('social') ||
          dClean.includes('marketing') ||
          dClean === 'social-media-marketing' ||
          dClean === 'social_media_marketing'
        ) {
          matchedDomain = 'Social Media Marketing (SMM)';
        } else if (
          dClean === 'cw' ||
          dClean.includes('content') ||
          dClean.includes('writing') ||
          dClean === 'content-writing' ||
          dClean === 'content_writing'
        ) {
          matchedDomain = 'Content Writing (CW)';
        } else if (
          dClean === 'ai' ||
          dClean.includes('artificial') ||
          dClean.includes('intelligence') ||
          dClean.includes('machine-learning') ||
          dClean === 'genai'
        ) {
          matchedDomain = 'AI';
        }

        if (matchedDomain) {
          console.log(`[Domain-Lock] Pre-locked domain from URL parameter: "${domainParam}" -> "${matchedDomain}"`);
          setCandidateData((prev) => ({ ...prev, domain: matchedDomain! }));
          setIsDomainLocked(true);
        }
      }
    } catch (e) {
      console.warn('Could not parse URL query parameters:', e);
    }
  }, []);

  const validateWelcomeForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!candidateData.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    } else if (candidateData.fullName.trim().length < 2) {
      errors.fullName = 'Please enter a valid full name.';
    }

    const emailTrimmed = candidateData.email.trim();
    if (!emailTrimmed) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = 'Please enter a valid email (e.g. name@university.edu).';
    }

    const digitsOnly = candidateData.mobile.replace(/\D/g, '');
    if (!digitsOnly) {
      errors.mobile = 'Mobile number is required.';
    } else if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      errors.mobile = 'Enter a valid mobile number (8-15 digits).';
    }

    if (!candidateData.college.trim()) {
      errors.college = 'College or University name is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleWelcomeFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateWelcomeForm()) return;

    const digitsOnly = candidateData.mobile.replace(/\D/g, '');
    const fullMobile = `${selectedCountryCode} ${digitsOnly}`;
    const preparedData: CandidateFormData = {
      ...candidateData,
      countryCode: selectedCountryCode,
      mobile: fullMobile,
    };

    handleCandidateFormSubmit(preparedData);
  };

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
    setCandidateData({
      ...INITIAL_FORM,
      domain: isDomainLocked ? candidateData.domain : INITIAL_FORM.domain,
    });
    setFormErrors({});
    setCurrentStep('welcome');
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] font-sans text-[#0A192F] flex flex-col selection:bg-[#1B4D36] selection:text-white">
      {/* Top Header - Branded Dark Navy with Gold Accents */}
      <header className="bg-[#0A192F] text-white py-3.5 px-4 sm:px-12 flex justify-between items-center shadow-md border-b border-[#D4AF37]/30 sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#FAF7F0] rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden border border-[#D4AF37]/40">
            <img
              src="https://i.postimg.cc/ZKgzktH4/official-logo.jpg"
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
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg sm:text-xl font-bold text-[#0A192F] border-l-4 border-[#1B4D36] pl-3.5">
                    Candidate Registration
                  </h3>
                  {isDomainLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1B4D36] bg-[#EAF3EE] px-2.5 py-1 rounded-md border border-[#2E7D56]/30">
                      <Lock className="w-3 h-3" />
                      Domain Locked via Invitation
                    </span>
                  )}
                </div>

                <form onSubmit={handleWelcomeFormSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="reg-fullname" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="reg-fullname"
                        type="text"
                        value={candidateData.fullName}
                        onChange={(e) => {
                          setCandidateData({ ...candidateData, fullName: e.target.value });
                          if (formErrors.fullName) setFormErrors((prev) => ({ ...prev, fullName: '' }));
                        }}
                        placeholder="e.g. Priya Sharma"
                        className={`w-full border rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F] ${
                          formErrors.fullName ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                        }`}
                      />
                    </div>
                    {formErrors.fullName && (
                      <p className="text-red-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.fullName}
                      </p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label htmlFor="reg-email" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="reg-email"
                        type="email"
                        value={candidateData.email}
                        onChange={(e) => {
                          setCandidateData({ ...candidateData, email: e.target.value });
                          if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        placeholder="e.g. priya.sharma@example.com"
                        className={`w-full border rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F] ${
                          formErrors.email ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                        }`}
                      />
                    </div>
                    {formErrors.email && (
                      <p className="text-red-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Mobile Number with Country Code Dropdown */}
                  <div>
                    <label htmlFor="reg-mobile" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                      Mobile Number (Digits Only) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="w-28 sm:w-32 shrink-0">
                        <CountrySelect
                          value={selectedCountryCode}
                          onChange={(dialCode) => setSelectedCountryCode(dialCode)}
                        />
                      </div>

                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          id="reg-mobile"
                          type="tel"
                          inputMode="numeric"
                          value={candidateData.mobile}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 15);
                            setCandidateData({ ...candidateData, mobile: digitsOnly });
                            if (formErrors.mobile) setFormErrors((prev) => ({ ...prev, mobile: '' }));
                          }}
                          placeholder="9876543210"
                          className={`w-full border rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F] ${
                            formErrors.mobile ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                          }`}
                        />
                      </div>
                    </div>
                    {formErrors.mobile && (
                      <p className="text-red-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.mobile}
                      </p>
                    )}
                  </div>

                  {/* College / University */}
                  <div>
                    <label htmlFor="reg-college" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
                      College / University <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <input
                        id="reg-college"
                        type="text"
                        value={candidateData.college}
                        onChange={(e) => {
                          setCandidateData({ ...candidateData, college: e.target.value });
                          if (formErrors.college) setFormErrors((prev) => ({ ...prev, college: '' }));
                        }}
                        placeholder="e.g. National Institute of Technology"
                        className={`w-full border rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F] ${
                          formErrors.college ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                        }`}
                      />
                    </div>
                    {formErrors.college && (
                      <p className="text-red-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.college}
                      </p>
                    )}
                  </div>

                  {/* Internship Domain */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="reg-domain" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider">
                        Internship Domain <span className="text-red-500">*</span>
                      </label>
                      {isDomainLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1B4D36] bg-[#EAF3EE] px-2 py-0.5 rounded border border-[#2E7D56]/30">
                          <Lock className="w-3 h-3 text-[#1B4D36]" />
                          Locked via Invitation Link
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      {isDomainLocked ? (
                        <div className="w-full border border-[#D4AF37]/50 rounded-lg pl-9 pr-8 py-2.5 text-xs sm:text-sm font-semibold bg-[#FAF7F0] text-[#0A192F] flex items-center justify-between shadow-xs">
                          <span>{candidateData.domain}</span>
                          <Lock className="w-3.5 h-3.5 text-[#1B4D36]" />
                        </div>
                      ) : (
                        <select
                          id="reg-domain"
                          value={candidateData.domain}
                          onChange={(e) =>
                            setCandidateData({
                              ...candidateData,
                              domain: e.target.value as CandidateFormData['domain'],
                            })
                          }
                          className="w-full border border-[#D8D0BA] rounded-lg pl-9 pr-8 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0]/60 text-[#0A192F] cursor-pointer"
                        >
                          {DEFAULT_DOMAINS.map((domain) => (
                            <option key={domain} value={domain}>
                              {domain}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
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
            isDomainLocked={isDomainLocked}
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
          <button
            type="button"
            id="footer-link-privacy"
            onClick={() => setLegalModalType('privacy')}
            className="hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-[10px] uppercase font-semibold text-[#D4AF37]"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            id="footer-link-terms"
            onClick={() => setLegalModalType('terms')}
            className="hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-[10px] uppercase font-semibold text-[#D4AF37]"
          >
            Terms of Service
          </button>
          <button
            type="button"
            id="footer-link-hr-desk"
            onClick={() => {
              if (adminToken) {
                setIsAdminDashboardOpen(true);
              } else {
                setIsAdminModalOpen(true);
              }
            }}
            className="hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-[10px] uppercase font-semibold text-[#D4AF37]"
          >
            HR Evaluation Desk
          </button>
        </div>
      </footer>

      {/* Legal & Policy Modals (Privacy Policy / Terms of Service) */}
      <LegalModal
        type={legalModalType}
        onClose={() => setLegalModalType(null)}
      />

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
