/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Logo } from './Logo';
import { Video, Mic, CheckCircle2, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

interface WelcomeHeroProps {
  onStart: () => void;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onStart }) => {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 text-center">
      {/* Official Logo Banner */}
      <div className="mb-6 flex justify-center">
        <Logo variant="hero" />
      </div>

      {/* Main headings */}
      <div className="mt-4 mb-8 space-y-3">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0A192F] tracking-tight">
          Candidate Interview Portal
        </h2>
        <p className="text-lg sm:text-xl font-semibold text-[#1B4D36]">
          Welcome to your internship interview.
        </p>
        <p className="text-[#0A192F]/85 font-medium max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Please complete the following information before starting your interview. Make sure your camera and microphone are working properly.
        </p>
      </div>

      {/* Pre-interview Guidelines Card with Warm Cream styling */}
      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-6 sm:p-8 text-left shadow-sm mb-8">
        <h3 className="text-base font-bold text-[#0A192F] uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#1B4D36]" />
          Interview Overview & Guidelines
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-[#EAF3EE] text-[#1B4D36] border border-[#2E7D56]/30 rounded-lg shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#0A192F] uppercase tracking-wide">Format</h4>
              <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">6 questions asked one by one with natural voice</p>
            </div>
          </div>

          <div className="bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-[#EAF3EE] text-[#1B4D36] border border-[#2E7D56]/30 rounded-lg shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#0A192F] uppercase tracking-wide">Recording</h4>
              <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">Continuous camera & mic capture for HR review</p>
            </div>
          </div>

          <div className="bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-[#EAF3EE] text-[#1B4D36] border border-[#2E7D56]/30 rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#0A192F] uppercase tracking-wide">Evaluation</h4>
              <p className="text-xs text-[#0A192F]/80 font-medium mt-0.5">Manual assessment strictly performed by HR</p>
            </div>
          </div>
        </div>

        <ul className="space-y-2.5 text-xs sm:text-sm text-[#0A192F]/85 font-medium">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D36]" />
            Find a quiet, well-lit environment free of background disruptions.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D36]" />
            Answer questions naturally at your own pace through your microphone.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D36]" />
            No AI scoring, ranking, or automated selection decisions are used.
          </li>
        </ul>
      </div>

      {/* Main Start Action Button */}
      <button
        id="btn-start-interview-main"
        onClick={onStart}
        className="inline-flex items-center justify-center gap-3 bg-[#1B4D36] hover:bg-[#143D2B] text-white text-base sm:text-lg font-bold px-8 py-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer w-full sm:w-auto uppercase tracking-wider border border-[#143D2B]"
      >
        <span>START INTERVIEW</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};
