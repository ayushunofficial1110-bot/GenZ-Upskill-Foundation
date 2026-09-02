/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ShieldCheck, FileText, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

export type LegalDocType = 'privacy' | 'terms' | null;

interface LegalModalProps {
  type: LegalDocType;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFDF9] rounded-2xl max-w-2xl w-full border border-[#D8D0BA] shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A192F] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#D4AF37]/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1B4D36] flex items-center justify-center text-amber-200 border border-[#D4AF37]/40">
              {type === 'privacy' ? <ShieldCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {type === 'privacy' ? 'Privacy Policy & Candidate Data Notice' : 'Terms of Service & Candidate Agreement'}
              </h2>
              <p className="text-[10px] text-[#D4AF37] font-semibold tracking-wider uppercase">
                GenZ Upskill Foundation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Placeholder Advisory Banner */}
        <div className="bg-amber-50 border-b border-amber-200 p-3 px-4 sm:px-6 flex items-start gap-2.5 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-900 leading-snug">
            <strong className="font-bold">Demonstration / Placeholder Notice:</strong> This document reflects the standard operating procedures of the GenZ Upskill Foundation Interview Portal. Please review and finalize with legal counsel prior to formal public launch.
          </p>
        </div>

        {/* Scrollable Policy Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-[#0A192F] text-xs sm:text-sm leading-relaxed">
          {type === 'privacy' ? (
            <>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  1. Information We Collect
                </h3>
                <p className="text-slate-600 mb-2">
                  When you register and take an interview through this portal, GenZ Upskill Foundation collects the following information:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Candidate Profile:</strong> Full Name, Email Address, Verified Mobile Number (with Country Code), and Current College/University.</li>
                  <li><strong>Internship Domain:</strong> The specific track for which you are applying (Social Media Marketing, Content Writing, or Artificial Intelligence).</li>
                  <li><strong>Audio & Video Recording:</strong> Continuous video and audio feed recorded throughout your interview session from your local camera and microphone.</li>
                  <li><strong>Written Submissions:</strong> Any written assignments or typed responses submitted during domain-specific question phases.</li>
                  <li><strong>Session Metadata:</strong> Timestamps, response timing per question, device configuration status, and transmission logs.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  2. Purpose & How We Use Your Data
                </h3>
                <p className="text-slate-600 mb-2">
                  All collected data is utilized solely for internship candidate assessment and selection by GenZ Upskill Foundation:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li>To verify candidate identity and authenticity during the interview session.</li>
                  <li>To allow our HR evaluation panel to review communication skills, technical knowledge, and problem-solving aptitude.</li>
                  <li>To communicate selection outcomes, next interview rounds, or onboarding offers.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  3. Human-Only Manual Evaluation Guarantee
                </h3>
                <p className="text-slate-700">
                  We do <strong className="text-[#0A192F]">NOT</strong> use automated algorithmic scoring, biometric profiling, emotion recognition, or automated rejection systems. Every interview recording and response is evaluated manually by designated human HR reviewers.
                </p>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  4. Data Storage, Security & Retention
                </h3>
                <p className="text-slate-600 mb-2">
                  Your interview recordings and personal data are stored in access-controlled environments:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Access Control:</strong> Only authorized HR reviewers with authenticated credentials can view or stream candidate submissions.</li>
                  <li><strong>Retention Period:</strong> Candidate recordings are retained for up to 90 days following the conclusion of the recruitment batch, after which inactive recordings are systematically purged.</li>
                  <li><strong>Third-Party Sharing:</strong> We do not sell, license, or share candidate personal information or video recordings with third-party advertisers or recruitment brokers.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  5. Candidate Rights & Inquiries
                </h3>
                <p className="text-slate-700">
                  You may request the deletion of your interview recording or inquire regarding your submission status by contacting our HR department directly at <code className="text-[#1B4D36] font-mono font-bold bg-[#EAF3EE] px-1.5 py-0.5 rounded">genzupskillfoundation@gmail.com</code>.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  1. Candidate Participation Agreement
                </h3>
                <p className="text-slate-700 mb-2">
                  By starting this interview, you agree to:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li>Provide accurate, genuine personal and academic details.</li>
                  <li>Complete all interview questions independently in a quiet, undisturbed setting.</li>
                  <li>Grant browser permissions to access your camera and microphone for continuous recording.</li>
                  <li>Refrain from recording, screen-capturing, or publicly disclosing proprietary interview prompts and questions.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  2. Recording & Assessment Terms
                </h3>
                <p className="text-slate-700">
                  You acknowledge that video, audio, and written inputs submitted during this session will be recorded and transmitted to GenZ Upskill Foundation's recruitment management systems for evaluation purposes.
                </p>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  3. Non-Commercial & Educational Intent
                </h3>
                <p className="text-slate-700">
                  GenZ Upskill Foundation's internship programs are designed to foster experiential learning and skill development. Completion of an interview does not constitute a formal employment guarantee until an official offer letter has been executed by HR.
                </p>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0A192F] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-[#1B4D36] rounded-full inline-block"></span>
                  4. Modification of Portal Terms
                </h3>
                <p className="text-slate-700">
                  GenZ Upskill Foundation reserves the right to modify evaluation criteria or technical requirements as necessitated by recruitment guidelines.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#FAF7F0] border-t border-[#E5DEC9] p-4 px-6 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Last Updated: September 2026
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#1B4D36] hover:bg-[#143D2B] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
};
