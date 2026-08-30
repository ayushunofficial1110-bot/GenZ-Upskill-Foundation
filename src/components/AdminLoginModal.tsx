/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid username or password');
      }

      localStorage.setItem('genz_admin_token', data.token);
      onLoginSuccess(data.token);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#0A192F] text-white p-6 flex items-center justify-between border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4D36] text-white flex items-center justify-center shadow-inner border border-[#D4AF37]/40">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-tight">HR & Admin Access</h3>
              <p className="text-xs text-slate-300 font-normal">Candidate Review Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              className="w-full border border-[#D8D0BA] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0] text-[#0A192F]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full border border-[#D8D0BA] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1B4D36] focus:outline-none bg-[#FAF7F0] text-[#0A192F]"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-[#D8D0BA] text-xs font-semibold text-[#0A192F] hover:bg-[#FAF7F0] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg bg-[#1B4D36] hover:bg-[#143D2B] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer disabled:opacity-50 border border-[#143D2B]"
            >
              {isLoading ? 'Verifying...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
