/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

class SpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer calm, natural, smooth English voices
    // Examples: Google UK English Female, Google US English, Samantha, Victoria, Daniel, Microsoft Zira/David Natural
    const preferredVoiceNames = [
      'Google US English',
      'Google UK English Female',
      'Microsoft Jenny Online (Natural)',
      'Microsoft Guy Online (Natural)',
      'Samantha',
      'Victoria',
      'Karen',
      'Daniel',
      'Serena',
      'Moira',
    ];

    let found: SpeechSynthesisVoice | undefined;
    for (const pref of preferredVoiceNames) {
      found = voices.find((v) => v.name.toLowerCase().includes(pref.toLowerCase()));
      if (found) break;
    }

    if (!found) {
      // Find any English voice with natural / default flag
      found = voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Compact')) ||
              voices.find((v) => v.lang.startsWith('en')) ||
              voices[0];
    }

    this.selectedVoice = found || null;
    this.isInitialized = true;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices().filter((v) => v.lang.startsWith('en'));
  }

  public setVoice(voice: SpeechSynthesisVoice): void {
    this.selectedVoice = voice;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public isSupported(): boolean {
    return !!this.synth;
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public speak(text: string, options?: SpeechOptions): void {
    if (!this.synth || this.isMuted) {
      options?.onStart?.();
      // Simulate quick completion if speech is muted or unsupported
      setTimeout(() => {
        options?.onEnd?.();
      }, 500);
      return;
    }

    // Cancel any previous speech
    this.synth.cancel();

    // Clean text for natural cadence (e.g. replace question marks with slight pause)
    const cleanedText = text.trim();
    const utterance = new SpeechSynthesisUtterance(cleanedText);

    if (!this.selectedVoice) {
      this.initVoices();
    }

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    // Warm, calm, human pacing (0.92 - 0.96 rate prevents rushing)
    utterance.rate = options?.rate ?? 0.94;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      // Synthesis error (e.g. user navigation or cancel) shouldn't block the interview
      options?.onEnd?.();
      options?.onError?.(e);
    };

    // Trigger synthesis
    try {
      this.synth.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      options?.onEnd?.();
    }
  }
}

export const speechEngine = new SpeechEngine();
