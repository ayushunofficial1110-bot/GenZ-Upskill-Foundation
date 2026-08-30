/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InternshipDomain, CandidateFormData } from '../types';
import { DEFAULT_DOMAINS } from '../lib/questions';
import { User, Mail, Phone, GraduationCap, Briefcase, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';

interface CandidateFormProps {
  initialData: CandidateFormData;
  onSubmit: (data: CandidateFormData) => void;
  onBack: () => void;
}

export const CandidateForm: React.FC<CandidateFormProps> = ({
  initialData,
  onSubmit,
  onBack,
}) => {
  const [formData, setFormData] = useState<CandidateFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter a valid full name.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required.';
    } else if (formData.mobile.trim().replace(/\D/g, '').length < 8) {
      newErrors.mobile = 'Please enter a valid contact number (at least 8 digits).';
    }

    if (!formData.college.trim()) {
      newErrors.college = 'College or University name is required.';
    }

    if (!formData.domain) {
      newErrors.domain = 'Please select your internship domain.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6">
      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A192F] text-white px-6 sm:px-8 py-5 border-b border-[#D4AF37]/30">
          <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest block mb-1">
            Step 1 of 3
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Candidate Information</h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Please provide your details accurately as per your official documents.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="input-full-name" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-full-name"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Priya Sharma"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm text-[#0A192F] bg-[#FAF7F0]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4D36] transition-all ${
                  errors.fullName ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                }`}
              />
            </div>
            {errors.fullName && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label htmlFor="input-email" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="input-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. priya.sharma@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm text-[#0A192F] bg-[#FAF7F0]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4D36] transition-all ${
                  errors.email ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <label htmlFor="input-mobile" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1.5">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="input-mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="e.g. +91 9876543210"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm text-[#0A192F] bg-[#FAF7F0]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4D36] transition-all ${
                  errors.mobile ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                }`}
              />
            </div>
            {errors.mobile && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.mobile}
              </p>
            )}
          </div>

          {/* College / University */}
          <div>
            <label htmlFor="input-college" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1.5">
              College / University <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <GraduationCap className="w-4 h-4" />
              </div>
              <input
                id="input-college"
                type="text"
                value={formData.college}
                onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                placeholder="e.g. National Institute of Technology"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm text-[#0A192F] bg-[#FAF7F0]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4D36] transition-all ${
                  errors.college ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                }`}
              />
            </div>
            {errors.college && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.college}
              </p>
            )}
          </div>

          {/* Internship Domain Dropdown */}
          <div>
            <label htmlFor="select-domain" className="block text-[10px] font-bold text-[#0A192F] uppercase tracking-wider mb-1.5">
              Internship Domain <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <select
                id="select-domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value as InternshipDomain })}
                className={`w-full pl-10 pr-8 py-2.5 rounded-lg border text-sm text-[#0A192F] bg-[#FAF7F0]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4D36] transition-all appearance-none cursor-pointer ${
                  errors.domain ? 'border-red-400 bg-red-50/20' : 'border-[#D8D0BA]'
                }`}
              >
                {DEFAULT_DOMAINS.map((dom) => (
                  <option key={dom} value={dom}>
                    {dom}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                ▼
              </div>
            </div>
            {errors.domain && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.domain}
              </p>
            )}
          </div>

          {/* Navigation Controls */}
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
              type="submit"
              id="btn-submit-candidate-info"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold bg-[#1B4D36] hover:bg-[#143D2B] text-white px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider border border-[#143D2B]"
            >
              <span>Continue to Consent</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
