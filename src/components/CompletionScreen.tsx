/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Logo } from './Logo';
import { CheckCircle2, UserCheck, MessageCircle, Instagram, Linkedin, Youtube, ExternalLink } from 'lucide-react';
import { CandidateFormData } from '../types';

interface CompletionScreenProps {
  candidateData: CandidateFormData;
  interviewId: string;
  onReturnHome: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  candidateData,
  interviewId,
  onReturnHome,
}) => {
  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-10 px-4 sm:px-6 text-center">
      {/* Official Brand Logo */}
      <div className="mb-6 flex justify-center">
        <Logo variant="hero" showTagline={false} />
      </div>

      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-[#EAF3EE] text-[#1B4D36] border border-[#2E7D56]/30 rounded-full flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        {/* Primary Completion Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A192F] tracking-tight">
            Interview Completed Successfully
          </h2>
          <p className="text-[#0A192F]/85 font-medium text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
            Thank you for completing your interview with GenZ Upskill Foundation. Your interview has been submitted successfully. Our team will review your interview and contact you if required.
          </p>
        </div>

        {/* Candidate Submission Receipt Card */}
        <div className="bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl p-5 text-left text-xs sm:text-sm space-y-2.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5DEC9]">
            <span className="font-bold text-[#0A192F]/70 uppercase text-[10px] tracking-wider">
              Submission Reference
            </span>
            <span className="font-mono font-bold text-[#0A192F] bg-white px-2.5 py-1 rounded-md border border-[#D8D0BA]">
              {interviewId}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-slate-700">
            <div>
              <span className="block text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">
                Candidate Name
              </span>
              <span className="font-bold text-[#0A192F]">{candidateData.fullName}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">
                Internship Domain
              </span>
              <span className="font-bold text-[#1B4D36]">{candidateData.domain}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">
                Email Address
              </span>
              <span className="text-[#0A192F] font-medium truncate">{candidateData.email}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-[#0A192F]/70 uppercase tracking-wider">
                Submission Date
              </span>
              <span className="text-[#0A192F] font-medium">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Manual Review Clarification */}
        <div className="p-4 rounded-xl bg-[#EAF3EE] border border-[#2E7D56]/30 text-slate-800 text-xs text-left flex items-start gap-3">
          <UserCheck className="w-5 h-5 text-[#1B4D36] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block uppercase tracking-wider text-[11px] text-[#0A192F]">
              Manual Human Review Process
            </span>
            <p className="text-[#0A192F]/85 font-medium mt-0.5 leading-relaxed">
              Your video and responses will be evaluated directly by our HR panel. We do not use automated algorithms to determine candidacy. Candidates will be contacted via email regarding next steps.
            </p>
          </div>
        </div>

        {/* ================================================== */}
        {/* STAY CONNECTED SECTION */}
        {/* ================================================== */}
        <div className="border-t border-[#E5DEC9] pt-6 space-y-5 text-left">
          <div className="text-center space-y-1">
            <span className="text-[#D4AF37] text-[11px] font-bold uppercase tracking-widest block">
              Official Channels
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-[#0A192F] tracking-tight">
              Stay Connected with GenZ Upskill Foundation
            </h3>
          </div>

          {/* WhatsApp for Selection Updates - Prominent */}
          <div className="bg-[#EAF3EE] border-2 border-[#1B4D36]/40 rounded-xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B4D36] text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-[#0A192F] uppercase tracking-wide">
                    For Selection Updates
                  </h4>
                  <span className="text-[10px] font-bold bg-[#1B4D36] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Official WhatsApp
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#0A192F]/85 font-medium leading-relaxed">
                  Please join our official WhatsApp Community to receive selection updates, important announcements and further communication from GenZ Upskill Foundation.
                </p>
              </div>
            </div>

            <div className="pt-1">
              <a
                href="https://chat.whatsapp.com/JfcsKP9lVmXBXc01LqySQn?s=cl&p=a&ilr=1"
                target="_blank"
                rel="noopener noreferrer"
                id="btn-join-whatsapp-community"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#1B4D36] hover:bg-[#143D2B] text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all uppercase tracking-wider cursor-pointer border border-[#143D2B]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Join WhatsApp Community →</span>
              </a>
            </div>
          </div>

          {/* Social Media - For Internship & Other Updates */}
          <div className="bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl p-4 sm:p-5 space-y-3">
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-[#0A192F] uppercase tracking-wide">
                For Internship & Other Updates
              </h4>
              <p className="text-xs sm:text-sm text-[#0A192F]/85 font-medium leading-relaxed">
                Follow our official social media platforms to stay updated about internships, opportunities, events and other announcements from GenZ Upskill Foundation.
              </p>
            </div>

            {/* Social Media Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/genz_upskill_foundation?igsh=MXIxem11N3lxZGM0aw=="
                target="_blank"
                rel="noopener noreferrer"
                id="btn-social-instagram"
                className="inline-flex items-center justify-center gap-2 bg-[#FFFDF9] hover:bg-[#FAF7F0] text-[#0A192F] hover:text-[#1B4D36] border border-[#D8D0BA] hover:border-[#1B4D36] px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer group"
              >
                <Instagram className="w-4 h-4 text-[#E1306C] shrink-0" />
                <span>Instagram</span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#1B4D36] ml-auto" />
              </a>

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/genz-upskill-foundation/"
                target="_blank"
                rel="noopener noreferrer"
                id="btn-social-linkedin"
                className="inline-flex items-center justify-center gap-2 bg-[#FFFDF9] hover:bg-[#FAF7F0] text-[#0A192F] hover:text-[#1B4D36] border border-[#D8D0BA] hover:border-[#1B4D36] px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer group"
              >
                <Linkedin className="w-4 h-4 text-[#0A66C2] shrink-0" />
                <span>LinkedIn</span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#1B4D36] ml-auto" />
              </a>

              {/* YouTube */}
              <a
                href="https://youtube.com/@genzupskillfoundation?si=XGc9FvIlm5LgYykg"
                target="_blank"
                rel="noopener noreferrer"
                id="btn-social-youtube"
                className="inline-flex items-center justify-center gap-2 bg-[#FFFDF9] hover:bg-[#FAF7F0] text-[#0A192F] hover:text-[#1B4D36] border border-[#D8D0BA] hover:border-[#1B4D36] px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer group"
              >
                <Youtube className="w-4 h-4 text-[#FF0000] shrink-0" />
                <span>YouTube</span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#1B4D36] ml-auto" />
              </a>
            </div>
          </div>
        </div>

        {/* Home / Finish CTA */}
        <div className="pt-2">
          <button
            type="button"
            id="btn-return-portal-home"
            onClick={onReturnHome}
            className="inline-flex items-center justify-center gap-2 bg-[#FAF7F0] hover:bg-[#E5DEC9] text-[#0A192F] hover:text-[#1B4D36] font-bold px-7 py-3 rounded-lg transition-all cursor-pointer text-xs sm:text-sm uppercase tracking-wider shadow-xs border border-[#D8D0BA]"
          >
            <span>Return to Portal Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
