/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CandidateFormData } from '../types';
import { ShieldCheck, Video, Mic, Lock, UserCheck, AlertTriangle, ArrowRight, ArrowLeft, CheckSquare, Square } from 'lucide-react';

interface ConsentScreenProps {
  candidateData: CandidateFormData;
  onConsentGiven: () => void;
  onBack: () => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  candidateData,
  onConsentGiven,
  onBack,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [attemptedWithoutConsent, setAttemptedWithoutConsent] = useState(false);

  const handleContinue = () => {
    if (!agreed) {
      setAttemptedWithoutConsent(true);
      return;
    }
    onConsentGiven();
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A192F] text-white px-6 sm:px-8 py-5 border-b border-[#D4AF37]/30">
          <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest block mb-1">
            Step 2 of 3
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Interview Consent & Terms
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Candidate: <span className="text-white font-semibold">{candidateData.fullName}</span> ({candidateData.domain})
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-[#EAF3EE] border border-[#2E7D56]/30 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#1B4D36] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-[#0A192F] leading-relaxed font-medium">
              GenZ Upskill Foundation is committed to fair, transparent, and dignified internship evaluations. Please review our recording, privacy, and manual review policies below before starting.
            </p>
          </div>

          {/* Key Consent Points */}
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#FFFDF9] border border-[#D8D0BA] text-[#1B4D36] shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0A192F] uppercase">Camera Access Required</h4>
                <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">
                  Camera access is required to capture video during the structured interview for candidate identity verification.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#FFFDF9] border border-[#D8D0BA] text-[#1B4D36] shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0A192F] uppercase">Microphone Audio Recording</h4>
                <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">
                  Microphone access is required to record your spoken answers to each interview question.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#FFFDF9] border border-[#D8D0BA] text-[#1B4D36] shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0A192F] uppercase">Secure Storage & No Candidate Downloads</h4>
                <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">
                  Interview recordings are securely encrypted and stored in private foundation storage. To safeguard candidate privacy, recordings are not downloadable or publicly accessible.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#EAF3EE]/70 border border-[#2E7D56]/30 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#EAF3EE] border border-[#2E7D56]/30 text-[#1B4D36] shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0A192F] uppercase">
                  100% Manual HR Evaluation (No AI Decision Making)
                </h4>
                <p className="text-xs text-[#0A192F]/85 font-medium mt-0.5">
                  Every candidate interview is reviewed and assessed manually by our foundation HR and recruitment team. AI systems never score, rank, select, or reject candidates.
                </p>
              </div>
            </div>
          </div>

          {/* Mandatory Consent Checkbox */}
          <div
            onClick={() => {
              setAgreed(!agreed);
              setAttemptedWithoutConsent(false);
            }}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex items-start gap-3.5 ${
              agreed
                ? 'bg-[#EAF3EE] border-[#1B4D36]'
                : attemptedWithoutConsent
                ? 'bg-red-50/50 border-red-400'
                : 'bg-[#FFFDF9] border-[#D8D0BA] hover:border-[#1B4D36]/50'
            }`}
          >
            <div className="mt-0.5 text-[#1B4D36] shrink-0">
              {agreed ? (
                <CheckSquare className="w-5 h-5 text-[#1B4D36]" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#0A192F]">
                I understand and agree to the recording and interview process.
              </p>
              <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">
                By ticking this box, you confirm that you have read and consented to the recorded interview session.
              </p>
            </div>
          </div>

          {attemptedWithoutConsent && !agreed && (
            <p className="text-xs text-red-600 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              You must agree to the recording and interview process before proceeding.
            </p>
          )}

          {/* Navigation Buttons */}
          <div className="pt-4 border-t border-[#E5DEC9] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0A192F] hover:text-[#1B4D36] px-4 py-2.5 rounded-lg border border-[#D8D0BA] hover:bg-[#FAF7F0] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              id="btn-confirm-consent"
              onClick={handleContinue}
              className={`inline-flex items-center gap-2 text-xs sm:text-sm font-bold px-6 py-2.5 rounded-lg shadow-md transition-all uppercase tracking-wider cursor-pointer border ${
                agreed
                  ? 'bg-[#1B4D36] hover:bg-[#143D2B] text-white hover:shadow-lg border-[#143D2B]'
                  : 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed'
              }`}
            >
              <span>Verify Camera & Mic</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
