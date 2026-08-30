/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Logo } from './Logo';
import { ShieldCheck, Lock, UserCheck } from 'lucide-react';

interface NavbarProps {
  onOpenAdmin: () => void;
  isAdminLoggedIn?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAdmin, isAdminLoggedIn }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-b border-[#E5DEC9] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <Logo variant="compact" />
          <div className="hidden md:block h-6 w-px bg-[#D8D0BA] ml-2" />
          <span className="hidden md:inline-block text-xs font-semibold text-[#0A192F] bg-[#EAF3EE] border border-[#2E7D56]/30 px-2.5 py-1 rounded-md">
            Candidate Portal
          </span>
        </div>

        {/* Security & HR manual review badge + Admin Access button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#1B4D36] bg-[#EAF3EE] border border-[#2E7D56]/30 px-3 py-1.5 rounded-full font-medium">
            <UserCheck className="w-3.5 h-3.5 text-[#1B4D36]" />
            <span>Manual HR Evaluation</span>
          </div>

          <button
            id="btn-admin-access"
            onClick={onOpenAdmin}
            className="flex items-center gap-2 text-xs font-semibold text-[#0A192F] hover:text-white bg-[#FAF7F0] hover:bg-[#1B4D36] px-3.5 py-2 rounded-lg transition-colors border border-[#D8D0BA] hover:border-[#1B4D36] cursor-pointer shadow-xs"
            title="HR & Admin Portal Access"
          >
            {isAdminLoggedIn ? (
              <>
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span>HR Dashboard</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>HR Login</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
