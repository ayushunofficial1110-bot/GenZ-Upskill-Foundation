/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ALL_COUNTRIES, CountryInfo, DEFAULT_COUNTRY } from '../lib/countries';
import { ChevronDown, Search, Check, X } from 'lucide-react';

interface CountrySelectProps {
  value: string; // e.g. "+91"
  onChange: (dialCode: string, country: CountryInfo) => void;
  className?: string;
  disabled?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find the active selected country object matching the dialCode or default
  const selectedCountry =
    ALL_COUNTRIES.find((c) => c.dialCode === value) ||
    DEFAULT_COUNTRY;

  // Filter countries by query (name, code, or dialCode)
  const filteredCountries = ALL_COUNTRIES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const cleanDial = c.dialCode.replace('+', '');
    const cleanQ = q.replace('+', '');
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      cleanDial.includes(cleanQ)
    );
  });

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (country: CountryInfo) => {
    onChange(country.dialCode, country);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 bg-[#FAF7F0]/90 hover:bg-[#FAF7F0] border border-[#D8D0BA] rounded-lg text-xs font-bold text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#1B4D36] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
          isOpen ? 'ring-2 ring-[#1B4D36] border-[#1B4D36]' : ''
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-base leading-none select-none">{selectedCountry.flag}</span>
          <span className="font-mono text-xs">{selectedCountry.dialCode}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Searchable Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-[#FFFDF9] border border-[#D8D0BA] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80 animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-[#E5DEC9] bg-[#FAF7F0] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code (e.g., Nigeria, 234)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-[#D8D0BA] bg-white text-[#0A192F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1B4D36]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Countries List */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#F0EAE1]">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                No countries found matching "{searchQuery}"
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.dialCode === value && country.code === selectedCountry.code;
                return (
                  <button
                    key={`${country.code}-${country.dialCode}`}
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EAF3EE] text-[#1B4D36] font-bold'
                        : 'hover:bg-[#FAF7F0] text-[#0A192F]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <span className="text-base select-none">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({country.code})</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-slate-600 font-semibold">{country.dialCode}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1B4D36]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Footer */}
          <div className="p-2 bg-[#FAF7F0] border-t border-[#E5DEC9] text-[10px] text-slate-500 text-center font-medium shrink-0">
            {filteredCountries.length} countries & territories available
          </div>
        </div>
      )}
    </div>
  );
};
