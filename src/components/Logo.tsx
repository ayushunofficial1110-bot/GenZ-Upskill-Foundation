/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoProps {
  variant?: 'full' | 'compact' | 'symbol-only' | 'hero';
  className?: string;
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  className = '',
  showTagline = true,
}) => {
  if (variant === 'symbol-only') {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <img
          src="https://i.postimg.cc/ZKgzktH4/official-logo.jpg"
          alt="GenZ Upskill Foundation Logo"
          referrerPolicy="no-referrer"
          className="w-12 h-12 object-contain"
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <div className="w-10 h-10 rounded-lg bg-[#FAF7F0] border border-[#D4AF37]/40 flex items-center justify-center p-1 shadow-xs overflow-hidden">
          <img
            src="https://i.postimg.cc/ZKgzktH4/official-logo.jpg"
            alt="GenZ Upskill Foundation Emblem"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1 font-black text-[#0A192F] tracking-wider text-base leading-none">
            <span>GEN</span>
            <span className="text-[#1B4D36]">Z</span>
            <span>UPSKILL</span>
          </div>
          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest leading-tight">
            Foundation
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 mb-4 drop-shadow-md bg-[#FAF7F0] rounded-2xl p-2 border border-[#E5DEC9] flex items-center justify-center">
          <img
            src="https://i.postimg.cc/ZKgzktH4/official-logo.jpg"
            alt="GenZ Upskill Foundation Official Logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#0A192F] uppercase">
            <span>GEN</span>
            <span className="text-[#1B4D36]">Z</span>
            <span> UPSKILL </span>
            <span className="text-[#0A192F] font-semibold text-xl sm:text-2xl block sm:inline">
              FOUNDATION
            </span>
          </h1>
          {showTagline && (
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[#1B4D36] bg-[#EAF3EE] px-4 py-1.5 rounded-full inline-block border border-[#2E7D56]/30">
              Skills for a Better Tomorrow
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default 'full' variant
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#FAF7F0] border border-[#D4AF37]/40 p-1.5 shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
        <img
          src="https://i.postimg.cc/ZKgzktH4/official-logo.jpg"
          alt="GenZ Upskill Foundation Logo"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex flex-col text-left">
        <div className="font-extrabold text-[#0A192F] tracking-wider text-lg sm:text-xl leading-tight">
          <span>GEN</span>
          <span className="text-[#1B4D36]">Z</span>
          <span> UPSKILL FOUNDATION</span>
        </div>
        {showTagline && (
          <div className="text-[11px] sm:text-xs font-semibold text-[#1B4D36] tracking-wider uppercase">
            Skills for a Better Tomorrow
          </div>
        )}
      </div>
    </div>
  );
};
