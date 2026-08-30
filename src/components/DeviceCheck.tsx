/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { InterviewMediaManager } from '../lib/recorder';
import { Camera, Mic, CheckCircle2, XCircle, RefreshCw, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface DeviceCheckProps {
  mediaManager: InterviewMediaManager;
  onDevicesReady: () => void;
  onBack: () => void;
}

export const DeviceCheck: React.FC<DeviceCheckProps> = ({
  mediaManager,
  onDevicesReady,
  onBack,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initDevices = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const stream = await mediaManager.requestPermissions();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Video play prevented:', e));
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      setHasCamera(videoTracks.length > 0 && videoTracks[0].readyState === 'live');
      setHasMic(audioTracks.length > 0 && audioTracks[0].readyState === 'live');
      setIsLoading(false);
    } catch (err: unknown) {
      setIsLoading(false);
      setHasCamera(false);
      setHasMic(false);
      setErrorMessage((err as Error).message || 'Failed to access camera and microphone.');
    }
  };

  useEffect(() => {
    initDevices();

    // Audio level meter polling
    const interval = setInterval(() => {
      if (hasMic) {
        const level = mediaManager.getAudioLevel();
        setAudioLevel(level);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [hasMic]);

  const readyToStart = hasCamera && hasMic && !isLoading;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A192F] text-white px-6 sm:px-8 py-5 border-b border-[#D4AF37]/30">
          <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest block mb-1">
            Step 3 of 3
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Camera & Microphone Setup
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Ensure your video is clearly framed and your microphone responds when you speak.
          </p>
        </div>

        {/* Setup Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Live Preview Container */}
          <div className="relative aspect-video max-h-[340px] w-full rounded-2xl bg-slate-950 overflow-hidden border border-[#E5DEC9] flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                hasCamera ? 'block' : 'hidden'
              }`}
            />

            {isLoading && (
              <div className="flex flex-col items-center text-white gap-3 p-6 text-center">
                <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
                <p className="text-sm font-medium">Requesting camera & microphone access...</p>
                <p className="text-xs text-slate-400">Please click "Allow" on your browser permission prompt.</p>
              </div>
            )}

            {!isLoading && !hasCamera && (
              <div className="flex flex-col items-center text-slate-400 gap-3 p-6 text-center">
                <Camera className="w-12 h-12 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">Camera preview unavailable</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Please enable camera permission in your browser address bar.
                </p>
              </div>
            )}

            {/* Overlaid status badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#0A192F]/90 text-white backdrop-blur-sm border border-[#D4AF37]/40 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${hasCamera ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                Live Preview
              </span>
            </div>
          </div>

          {/* Device Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Camera Status */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              hasCamera ? 'bg-[#EAF3EE] border-[#2E7D56]/30' : 'bg-red-50/70 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hasCamera ? 'bg-[#1B4D36] text-white' : 'bg-red-100 text-red-800'}`}>
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0A192F] uppercase">Camera</h4>
                  <p className="text-xs text-[#0A192F]/80 font-medium">
                    {hasCamera ? 'Connected (Video Live)' : 'Not Connected'}
                  </p>
                </div>
              </div>
              <div>
                {hasCamera ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1B4D36]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            {/* Microphone Status */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              hasMic ? 'bg-[#EAF3EE] border-[#2E7D56]/30' : 'bg-red-50/70 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hasMic ? 'bg-[#1B4D36] text-white' : 'bg-red-100 text-red-800'}`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0A192F] uppercase">Microphone</h4>
                  <p className="text-xs text-[#0A192F]/80 font-medium">
                    {hasMic ? 'Connected (Audio Ready)' : 'Not Connected'}
                  </p>
                </div>
              </div>
              <div>
                {hasMic ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1B4D36]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          </div>

          {/* Live Audio Level Meter */}
          {hasMic && (
            <div className="bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-[#1B4D36]" />
                  Microphone Test (Speak to test level)
                </span>
                <span className="text-xs font-semibold text-[#0A192F]">
                  {audioLevel > 5 ? 'Active Sound Detected' : 'Speak to test...'}
                </span>
              </div>
              <div className="w-full bg-[#E5DEC9] rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-[#1B4D36] h-full rounded-full transition-all duration-75"
                  style={{ width: `${Math.max(4, Math.min(100, audioLevel * 1.5))}%` }}
                />
              </div>
            </div>
          )}

          {/* Permission Error & Troubleshooting */}
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-950 text-xs sm:text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Permission Assistance:</span>
              </div>
              <p>{errorMessage}</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-amber-900">
                <li>Look for the camera/lock icon in your browser URL address bar and select "Allow".</li>
                <li>Ensure no other app (like Zoom, Teams, or Google Meet) is actively locking your camera.</li>
              </ul>
              <button
                type="button"
                onClick={initDevices}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 font-semibold text-xs text-amber-950 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Device Permission
              </button>
            </div>
          )}

          {/* Controls */}
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
              id="btn-begin-recorded-interview"
              disabled={!readyToStart}
              onClick={onDevicesReady}
              className={`inline-flex items-center gap-2 text-xs sm:text-sm font-bold px-7 py-3 rounded-lg shadow-md transition-all uppercase tracking-wider cursor-pointer border ${
                readyToStart
                  ? 'bg-[#1B4D36] hover:bg-[#143D2B] text-white hover:shadow-lg border-[#143D2B]'
                  : 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed'
              }`}
            >
              <span>Begin Interview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
