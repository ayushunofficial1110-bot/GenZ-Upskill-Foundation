/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CandidateFormData, InterviewQuestion, QuestionAnswerMetadata } from '../types';
import { InterviewMediaManager } from '../lib/recorder';
import { speechEngine } from '../lib/speech';
import { getIntroStepsForDomain } from '../lib/questions';
import { Logo } from './Logo';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Mic,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Radio,
  Clock,
  Briefcase,
  User,
  Languages,
  BookOpen,
  Loader2,
  AlertCircle,
  AlertTriangle,
  PenTool,
} from 'lucide-react';

interface InterviewRoomProps {
  candidateData: CandidateFormData;
  questions: InterviewQuestion[];
  mediaManager: InterviewMediaManager;
  onFinishInterview: (payload: {
    durationSeconds: number;
    recordedBlob: Blob;
    answers: QuestionAnswerMetadata[];
    chunksCount?: number;
    sizeBytes?: number;
  }) => Promise<void> | void;
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({
  candidateData,
  questions,
  mediaManager,
  onFinishInterview,
}) => {
  // Phase: 'intro' for step-by-step introduction, 'questions' for questions 1 to 6
  const [phase, setPhase] = useState<'intro' | 'questions'>('intro');
  const [currentIntroIndex, setCurrentIntroIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isHardwareDeactivated, setIsHardwareDeactivated] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Written answer state for written questions (e.g. Content Writing Q6)
  const [writtenAnswer, setWrittenAnswer] = useState<string>('');
  const [writtenAnswerError, setWrittenAnswerError] = useState<string | null>(null);

  // Camera cover / occlusion warning
  const [cameraWarning, setCameraWarning] = useState<boolean>(false);
  const consecutiveDarkFramesRef = useRef<number>(0);

  // Time stamps for each question
  const questionStartTimeRef = useRef<number>(0);
  const answersLogRef = useRef<QuestionAnswerMetadata[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Intro steps for candidate's domain
  const introSteps = useMemo(
    () => getIntroStepsForDomain(candidateData.domain),
    [candidateData.domain]
  );

  const currentIntroStep = introSteps[currentIntroIndex] || introSteps[0];
  const isLastIntroStep = currentIntroIndex === introSteps.length - 1;

  const currentQuestion = questions[currentQuestionIndex] || questions[0];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isWrittenQuestion = Boolean(currentQuestion?.isWrittenAnswer);

  // Format seconds to mm:ss
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Speak text safely using English-only TTS
  const speakText = (text: string) => {
    if (isMuted) return;
    setIsSpeaking(true);
    speechEngine.speak(text, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Mount camera stream and start continuous recording covering entire session
  useEffect(() => {
    const stream = mediaManager.getStream();
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => console.warn('Video preview error:', e));
    }

    try {
      mediaManager.startRecording((elapsed) => {
        setDurationSeconds(elapsed);
      });
    } catch (e) {
      console.warn('Recording start warning:', e);
    }

    // Audio level meter
    const micInterval = setInterval(() => {
      const level = mediaManager.getAudioLevel();
      setMicLevel(level);
    }, 100);

    // Speak initial welcome step (English only)
    const initialIntro = introSteps[0];
    if (initialIntro) {
      setTimeout(() => {
        speakText(initialIntro.english);
      }, 700);
    }

    // Camera coverage / low visibility monitor using offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 36;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const cameraMonitorInterval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isHardwareDeactivated) return;
      try {
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 48, 36);
          const frame = ctx.getImageData(0, 0, 48, 36);
          const data = frame.data;
          let totalLuminance = 0;
          const pixelCount = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Standard perceptual luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += lum;
          }

          const avgLuminance = totalLuminance / pixelCount;

          // Check for pitch black / covered camera (< 14 luminance)
          if (avgLuminance < 14) {
            consecutiveDarkFramesRef.current += 1;
          } else {
            consecutiveDarkFramesRef.current = 0;
          }

          if (consecutiveDarkFramesRef.current >= 3) {
            setCameraWarning(true);
          } else {
            setCameraWarning(false);
          }
        }
      } catch (err) {
        // Ignore canvas read errors if any
      }
    }, 1200);

    return () => {
      clearInterval(micInterval);
      clearInterval(cameraMonitorInterval);
      speechEngine.stop();
    };
  }, []);

  // Handler to replay current step audio
  const handleReplayAudio = () => {
    if (phase === 'intro') {
      speakText(currentIntroStep.english);
    } else {
      const qNum = currentQuestionIndex + 1;
      speakText(`Question ${qNum}. ${currentQuestion.english || currentQuestion.questionText}`);
    }
  };

  // Mute / Unmute speech
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    speechEngine.setMuted(nextMuted);
    if (nextMuted) {
      setIsSpeaking(false);
    } else {
      handleReplayAudio();
    }
  };

  // Advance to next intro step or start questions
  const handleNextIntroStep = () => {
    speechEngine.stop();

    if (isLastIntroStep) {
      // Transition from Intro to Question 1 of 6
      setPhase('questions');
      setCurrentQuestionIndex(0);
      questionStartTimeRef.current = durationSeconds;

      const firstQ = questions[0];
      const speechPrompt = `Question 1 of 6. ${firstQ.english || firstQ.questionText}`;
      setTimeout(() => {
        speakText(speechPrompt);
      }, 400);
    } else {
      const nextIndex = currentIntroIndex + 1;
      setCurrentIntroIndex(nextIndex);
      const nextStep = introSteps[nextIndex];
      setTimeout(() => {
        speakText(nextStep.english);
      }, 400);
    }
  };

  // Advance to next question (Question 1 to 6)
  const handleNextQuestion = () => {
    // If current question is written, validate that candidate typed something meaningful
    if (isWrittenQuestion) {
      if (!writtenAnswer.trim() || writtenAnswer.trim().length < 15) {
        setWrittenAnswerError('Please write at least 2-3 sentences before completing your submission.');
        return;
      }
      setWrittenAnswerError(null);
    }

    speechEngine.stop();

    // Record answer metadata for current question
    const startedAt = questionStartTimeRef.current;
    const completedAt = durationSeconds;
    const duration = Math.max(1, completedAt - startedAt);

    const answerMeta: QuestionAnswerMetadata = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.english || currentQuestion.questionText,
      questionOrder: currentQuestionIndex + 1,
      startedAtSeconds: startedAt,
      completedAtSeconds: completedAt,
      durationSeconds: duration,
      ...(isWrittenQuestion && writtenAnswer.trim() ? { writtenAnswer: writtenAnswer.trim() } : {}),
    };

    answersLogRef.current.push(answerMeta);

    if (isLastQuestion) {
      handleSubmitInterview();
      return;
    }

    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    questionStartTimeRef.current = durationSeconds;

    const nextQ = questions[nextIndex];
    const speechPrompt = `Question ${nextIndex + 1} of 6. ${nextQ.english || nextQ.questionText}`;
    setTimeout(() => {
      speakText(speechPrompt);
    }, 400);
  };

  // Submit interview
  const handleSubmitInterview = async () => {
    if (isFinishing) return;
    const submitStartTime = Date.now();
    console.log(`[SUBMIT] Button clicked ${new Date().toISOString()} elapsed=0ms`);
    console.log(`[SUBMIT] submission lock enabled ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`);
    setIsFinishing(true);
    setSubmissionError(null);
    speechEngine.stop();

    try {
      // 1. Finalize recording and shut down tracks inside mediaManager
      const result = await mediaManager.stopRecording(submitStartTime);

      // 2. ONLY AFTER final Blob is created and tracks stopped:
      // Detach video element and update UI to Deactivated state
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsHardwareDeactivated(true);

      // 3. Perform upload
      await onFinishInterview({
        durationSeconds: result.durationSeconds,
        recordedBlob: result.blob,
        answers: answersLogRef.current,
        chunksCount: result.chunksCount,
        sizeBytes: result.sizeBytes,
        submitStartTime,
      });
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to complete interview submission. Please try again.';
      console.error('[InterviewRoom] ❌ Submission error:', msg);
      setIsFinishing(false);
      setIsHardwareDeactivated(false);
      setSubmissionError(msg);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 sm:px-6">
      {/* Top Session Bar */}
      <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo variant="compact" />
          <div className="hidden sm:block h-8 w-px bg-[#D8D0BA]" />
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-[#0A192F]">
              <User className="w-3.5 h-3.5 text-[#1B4D36]" />
              <span>{candidateData.fullName}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#EAF3EE] text-[#1B4D36] border border-[#2E7D56]/30 px-2.5 py-1 rounded-md font-medium">
              <Briefcase className="w-3.5 h-3.5 text-[#1B4D36]" />
              <span>{candidateData.domain}</span>
            </div>
          </div>
        </div>

        {/* Live Recording Timer Badge */}
        <div className="flex items-center gap-3 shrink-0">
          {isFinishing ? (
            <div className="flex items-center gap-2 bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide">
              <CheckCircle2 className="w-4 h-4 text-[#1B4D36]" />
              <span>RECORDING COMPLETE</span>
              <span className="font-mono text-slate-900">{formatTime(durationSeconds)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200/80 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide">
              <Radio className="w-4 h-4 text-red-600 animate-pulse" />
              <span>REC</span>
              <span className="font-mono text-slate-900">{formatTime(durationSeconds)}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-[#0A192F] bg-[#FAF7F0] px-3 py-1.5 rounded-full border border-[#E5DEC9] font-bold">
            {phase === 'intro' ? (
              <>
                <BookOpen className="w-3.5 h-3.5 text-[#1B4D36]" />
                <span>Introduction ({currentIntroIndex + 1}/{introSteps.length})</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-[#1B4D36]" />
                <span>Question {currentQuestionIndex + 1} of 6</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Interview Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Content Display & Voice Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Phase 1: STEP-BY-STEP INTRODUCTIONS */}
          {phase === 'intro' ? (
            <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
              {/* Intro Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1B4D36] bg-[#EAF3EE] px-3 py-1 rounded-full border border-[#2E7D56]/30">
                    Step {currentIntroStep.stepNumber} of {currentIntroStep.totalSteps}: {currentIntroStep.title}
                  </span>
                </div>

                {/* Voice status */}
                <div className="flex items-center gap-2">
                  {isSpeaking ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#0A192F] bg-[#FAF7F0] border border-[#D4AF37] px-3 py-1 rounded-full animate-pulse shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Speaking Introduction...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0A192F] bg-[#FAF7F0] border border-[#E5DEC9] px-3 py-1 rounded-full">
                      <Mic className="w-3.5 h-3.5 text-[#1B4D36]" />
                      Session Recording Active
                    </span>
                  )}
                </div>
              </div>

              {/* English Version (Spoken by TTS) */}
              <div className="space-y-2 border-l-4 border-[#1B4D36] pl-4">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4AF37]">
                  English (Voice)
                </span>
                <p className="text-lg sm:text-xl font-bold text-[#0A192F] leading-relaxed">
                  "{currentIntroStep.english}"
                </p>
              </div>

              {/* Hindi Version (Screen display only, never spoken by TTS) */}
              <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1B4D36] uppercase tracking-wider">
                  <Languages className="w-3.5 h-3.5 text-[#1B4D36]" />
                  <span>हिंदी अनुवाद (Hindi Translation — On Screen Only)</span>
                </div>
                <p className="text-sm sm:text-base font-medium text-[#0A192F] leading-relaxed font-sans">
                  "{currentIntroStep.hindi}"
                </p>
              </div>

              {/* Bilingual Notice */}
              <div className="flex items-center gap-2 text-xs text-[#0A192F] bg-[#EAF3EE] p-2.5 rounded-lg border border-[#2E7D56]/30">
                <HelpCircle className="w-4 h-4 text-[#1B4D36] shrink-0" />
                <span>
                  <strong>Language rule:</strong> Candidate may answer questions in <strong>English, Hindi, or Hinglish</strong>.
                </span>
              </div>

              {/* Audio Controls */}
              <div className="pt-3 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReplayAudio}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#EAF3EE] text-[#0A192F] font-semibold border border-[#D8D0BA] transition-colors cursor-pointer"
                    title="Replay English Audio"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#1B4D36]" />
                    <span>Replay Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer border ${
                      isMuted
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-[#FAF7F0] hover:bg-[#EAF3EE] text-[#0A192F] border-[#D8D0BA]'
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-amber-700" />
                        <span>Audio Muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#1B4D36]" />
                        <span>Mute Audio</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Phase 2: EXACT 6 FIXED QUESTIONS */
            <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
              {/* Question Progress Header */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#1B4D36] bg-[#EAF3EE] px-3.5 py-1.5 rounded-full border border-[#2E7D56]/30">
                  Question {currentQuestionIndex + 1} of 6 {isWrittenQuestion ? '• Written Task' : ''}
                </span>

                {/* Speech State */}
                <div className="flex items-center gap-2">
                  {isSpeaking ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#0A192F] bg-[#FAF7F0] border border-[#D4AF37] px-3 py-1 rounded-full animate-pulse shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Interviewer Speaking Question...
                    </span>
                  ) : isWrittenQuestion ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#1B4D36] bg-[#EAF3EE] border border-[#2E7D56]/30 px-3 py-1 rounded-full">
                      <PenTool className="w-3.5 h-3.5 text-[#1B4D36]" />
                      Written Assignment
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0A192F] bg-[#FAF7F0] border border-[#E5DEC9] px-3 py-1 rounded-full">
                      <Mic className="w-3.5 h-3.5 text-[#1B4D36]" />
                      Recording Your Answer
                    </span>
                  )}
                </div>
              </div>

              {/* English Question (Prominent + Spoken by TTS) */}
              <div className="space-y-1.5 border-l-4 border-[#1B4D36] pl-4">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4AF37]">
                  {isWrittenQuestion ? 'Written Task Prompt' : 'English Question (Spoken via Voice)'}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0A192F] leading-snug tracking-tight">
                  "{currentQuestion.english || currentQuestion.questionText}"
                </h2>
              </div>

              {/* Hindi Translation (Screen Display Only) */}
              <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1B4D36] uppercase tracking-wider">
                  <Languages className="w-3.5 h-3.5 text-[#1B4D36]" />
                  <span>हिंदी अनुवाद (Hindi Translation — Display Only)</span>
                </div>
                <p className="text-base sm:text-lg font-medium text-[#0A192F] leading-relaxed font-sans">
                  "{currentQuestion.hindi}"
                </p>
              </div>

              {/* Written Assignment Input Box for Content Writing Q6 */}
              {isWrittenQuestion ? (
                <div className="p-4 rounded-xl bg-amber-50/50 border-2 border-[#1B4D36]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="written-answer-box" className="block text-xs font-bold text-[#0A192F] uppercase tracking-wide flex items-center gap-1.5">
                      <PenTool className="w-4 h-4 text-[#1B4D36]" />
                      <span>Your Written Response (Type Below)</span>
                    </label>
                    <span className="text-[11px] font-bold text-[#1B4D36]">
                      {writtenAnswer.trim().split(/\s+/).filter(Boolean).length} words • {writtenAnswer.length} chars
                    </span>
                  </div>

                  <textarea
                    id="written-answer-box"
                    rows={5}
                    value={writtenAnswer}
                    onChange={(e) => {
                      setWrittenAnswer(e.target.value);
                      if (writtenAnswerError) setWrittenAnswerError(null);
                    }}
                    placeholder="Write your creative copy or social media post here (aim for 3-5 engaging sentences)..."
                    className="w-full p-3.5 text-sm bg-white border border-[#D8D0BA] rounded-xl text-[#0A192F] focus:ring-2 focus:ring-[#1B4D36] focus:outline-none leading-relaxed placeholder:text-slate-400"
                  />

                  {writtenAnswerError && (
                    <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {writtenAnswerError}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-600 italic">
                    💡 Tip: Focus on clarity, tone, and inspiring action among students and young professionals.
                  </p>
                </div>
              ) : (
                /* Candidate Answering Instruction for Spoken Questions */
                <div className="p-3 rounded-lg bg-[#EAF3EE] border border-[#2E7D56]/30 text-xs text-[#0A192F] flex items-center justify-between">
                  <span>
                    💡 <strong>Accepted Languages:</strong> You may answer in <strong>English, Hindi, or Hinglish</strong>.
                  </span>
                </div>
              )}

              {/* Voice Helper Tools */}
              <div className="pt-3 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReplayAudio}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#EAF3EE] text-[#0A192F] font-semibold border border-[#D8D0BA] transition-colors cursor-pointer"
                    title="Replay Voice Question in English"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#1B4D36]" />
                    <span>Replay Question Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer border ${
                      isMuted
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-[#FAF7F0] hover:bg-[#EAF3EE] text-[#0A192F] border-[#D8D0BA]'
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-amber-700" />
                        <span>Voice Muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#1B4D36]" />
                        <span>Mute Voice</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#1B4D36]" />
                  <span>{isWrittenQuestion ? 'Type your answer and click submit' : 'Answer clearly into your microphone'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Progress Timeline bar */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-2">
              <span>
                {phase === 'intro' ? 'Introduction Progress' : 'Interview Question Progress'}
              </span>
              <span className="font-bold text-[#1B4D36]">
                {phase === 'intro'
                  ? `${currentIntroIndex + 1} of ${introSteps.length} Intro Steps`
                  : `Question ${currentQuestionIndex + 1} of 6`}
              </span>
            </div>
            <div className="w-full bg-[#FAF7F0] border border-[#E5DEC9] rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#1B4D36] h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width:
                    phase === 'intro'
                      ? `${((currentIntroIndex + 1) / introSteps.length) * 100}%`
                      : `${((currentQuestionIndex + 1) / 6) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Action Navigation Controls */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {phase === 'intro' ? (
              <button
                type="button"
                id="btn-next-intro-step"
                onClick={handleNextIntroStep}
                className="inline-flex items-center gap-2.5 bg-[#1B4D36] hover:bg-[#143D2B] text-white font-bold px-7 py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all uppercase tracking-wider text-xs sm:text-sm cursor-pointer border border-[#143D2B]"
              >
                {isLastIntroStep ? (
                  <>
                    <span>Begin Question 1 of 6</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                id="btn-next-interview-question"
                disabled={isFinishing}
                onClick={handleNextQuestion}
                className={`inline-flex items-center gap-2.5 font-bold px-7 py-3.5 rounded-lg shadow-md transition-all uppercase tracking-wider text-xs sm:text-sm border ${
                  isFinishing
                    ? 'bg-slate-700 text-white cursor-not-allowed opacity-90 border-slate-800'
                    : 'bg-[#1B4D36] hover:bg-[#143D2B] text-white hover:shadow-lg cursor-pointer border-[#143D2B]'
                }`}
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                    <span>Submitting...</span>
                  </>
                ) : isLastQuestion ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Submit Interview</span>
                  </>
                ) : (
                  <>
                    <span>Next Question ({currentQuestionIndex + 2} of 6)</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Submission Status Message */}
          {isFinishing && (
            <div className="mt-4 p-4 rounded-xl bg-[#FFFDF9] border border-[#D4AF37]/50 shadow-xs flex items-center gap-3.5 animate-fadeIn">
              <Loader2 className="w-5 h-5 animate-spin text-[#1B4D36] shrink-0" />
              <div>
                <p className="font-bold text-[#0A192F] text-sm">Your interview has been submitted.</p>
                <p className="text-xs text-slate-600 mt-0.5">Please wait while we securely save your recording to Google Drive and update HR records...</p>
              </div>
            </div>
          )}

          {/* Submission Error Banner */}
          {submissionError && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-950">Submission Encountered an Issue</p>
                <p className="text-xs text-red-800 mt-0.5">{submissionError}</p>
                <button
                  type="button"
                  onClick={handleSubmitInterview}
                  className="mt-2 text-xs font-bold bg-red-700 hover:bg-red-800 text-white px-3.5 py-1.5 rounded-md inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Submission
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Camera Feed & Mic Monitor (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Camera Frame */}
          <div className="bg-slate-950 rounded-2xl overflow-hidden border border-[#E5DEC9] shadow-md relative aspect-[4/3] flex items-center justify-center">
            {!isHardwareDeactivated ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 bg-[#0A192F] w-full h-full">
                <div className="w-12 h-12 rounded-full bg-[#1B4D36]/40 border border-[#D4AF37]/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Camera & Microphone Deactivated</p>
                  <p className="text-slate-300 text-xs mt-1">Recording complete. Securely uploading to Google Drive & HR records...</p>
                </div>
              </div>
            )}

            {/* Camera Cover / Low Visibility Warning Banner */}
            {cameraWarning && !isHardwareDeactivated && (
              <div className="absolute top-12 left-3 right-3 bg-amber-950/90 text-amber-200 border border-amber-500/80 p-2.5 rounded-xl shadow-lg backdrop-blur-sm flex items-start gap-2 text-xs z-30 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-300">Camera Visibility Warning</span>
                  <span className="text-[11px] leading-tight text-amber-100">
                    Camera appears covered or lighting is very low. Please ensure your face is clearly visible.
                  </span>
                </div>
              </div>
            )}

            {/* Live Recording Indicator Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {isFinishing ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0A192F]/95 text-[#D4AF37] backdrop-blur-sm border border-[#D4AF37]/50 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-[#D4AF37]" />
                  Recording Finalized • Uploading...
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0A192F]/90 text-white backdrop-blur-sm border border-[#D4AF37]/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Recording Active
                </span>
              )}
            </div>

            {/* Candidate Name Watermark */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white bg-[#0A192F]/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-[#D4AF37]/40">
              <span className="font-semibold truncate">{candidateData.fullName}</span>
              <span className="text-[11px] text-[#D4AF37]">{candidateData.domain}</span>
            </div>
          </div>

          {/* Microphone Live Activity Indicator */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0A192F] uppercase tracking-wide">
                <Mic className="w-4 h-4 text-[#1B4D36]" />
                <span>Microphone Activity</span>
              </div>
              <span className="text-xs font-semibold text-[#0A192F]">
                {isFinishing ? 'Mic Deactivated' : (micLevel > 5 ? 'Recording Voice' : 'Silent')}
              </span>
            </div>
            <div className="w-full bg-[#FAF7F0] border border-[#E5DEC9] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#1B4D36] h-full rounded-full transition-all duration-75"
                style={{ width: `${isFinishing ? 0 : Math.max(4, Math.min(100, micLevel * 1.6))}%` }}
              />
            </div>
          </div>

          {/* Security & Privacy Notice */}
          <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] text-slate-700 text-xs leading-relaxed space-y-1">
            <p className="font-bold text-[#0A192F]">Official Foundation Policy:</p>
            <p>
              Your interview recording is submitted directly to the HR review desk. Candidate downloading, saving, or sharing of interview recordings is restricted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
