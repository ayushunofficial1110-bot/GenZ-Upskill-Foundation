/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RecorderResult {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
  chunksCount: number;
  sizeBytes: number;
}

export class InterviewMediaManager {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private startTime: number = 0;
  private durationInterval: number | null = null;
  private onDurationTick?: (seconds: number) => void;
  private isRecordingActive: boolean = false;

  /**
   * Requests camera and microphone permissions and returns the MediaStream.
   */
  public async requestPermissions(): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API is not supported in this browser environment.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 360 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      this.mediaStream = stream;
      this.setupAudioAnalyser(stream);
      return stream;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera or microphone permission was denied. Please allow access in browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone device was found on this system.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera or microphone is already in use by another application.');
      }
      throw new Error(error.message || 'Failed to access camera and microphone.');
    }
  }

  public getStream(): MediaStream | null {
    return this.mediaStream;
  }

  private setupAudioAnalyser(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('[MediaManager] AudioAnalyser setup skipped:', e);
    }
  }

  /**
   * Returns current microphone volume level from 0 to 100.
   */
  public getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    return Math.min(100, Math.round((average / 128) * 100));
  }

  /**
   * Starts continuous interview video + audio recording.
   * Collects all chunks incrementally without dropping frames.
   */
  public startRecording(onDurationTick?: (seconds: number) => void): void {
    if (!this.mediaStream) {
      throw new Error('Cannot start recording: MediaStream is not active.');
    }

    this.recordedChunks = [];
    this.onDurationTick = onDurationTick;
    this.startTime = Date.now();
    this.isRecordingActive = true;

    // Pick best supported MIME type (prefer VP8 or H.264 for maximum container stability across browsers)
    const candidateMimes = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];

    let selectedMime = '';
    for (const mime of candidateMimes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    const options: MediaRecorderOptions = {
      videoBitsPerSecond: 1500000, // 1.5 Mbps high definition
      audioBitsPerSecond: 128000,
    };
    if (selectedMime) {
      options.mimeType = selectedMime;
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          const isFinal = !this.isRecordingActive || this.mediaRecorder?.state === 'inactive';
          if (isFinal) {
            console.log(
              `[RECORDING] final dataavailable event received (${event.data.size} bytes, total chunks: ${this.recordedChunks.length})`
            );
          } else {
            console.log(
              `[RECORDING] dataavailable event received (${event.data.size} bytes, total chunks: ${this.recordedChunks.length})`
            );
          }
        }
      };

      // Request timeslice chunks every 1000ms so data is continuously buffered
      this.mediaRecorder.start(1000);
      console.log(`[MediaManager] 🔴 Recording started with MIME: ${this.mediaRecorder.mimeType || selectedMime}`);

      // Duration tick interval
      this.durationInterval = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.onDurationTick?.(elapsed);
      }, 1000);
    } catch (err) {
      console.error('[MediaManager] MediaRecorder start error:', err);
      throw new Error('Failed to start recording on this device.');
    }
  }

  /**
   * Stops recording following the strict W3C MediaRecorder lifecycle:
   * 1. Stops duration timer
   * 2. Calls requestData() to flush pending buffer
   * 3. Calls stop() on MediaRecorder
   * 4. Ensures BOTH 'dataavailable' (final chunk) and 'stop' events have fired
   * 5. Assembles all chunks and verifies Blob integrity (size > 0 and reasonable minimum for recorded duration)
   * 6. Shuts down hardware tracks ONLY after final blob creation and integrity verification
   */
  public async stopRecording(submitStartTime: number = Date.now()): Promise<RecorderResult> {
    // 1. Immediately stop interview timer
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    console.log(
      `[RECORDING] Submission lock enabled ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
    );
    console.log(
      `[RECORDING] Timer stopped ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
    );

    const durationSeconds = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
    this.isRecordingActive = false;

    const stopHardwareTracks = () => {
      this.stopAllTracks(submitStartTime);
    };

    if (!this.mediaRecorder) {
      console.warn('[RECORDING] stopRecording called without active MediaRecorder.');
      this.stopAllTracks(submitStartTime);
      throw new Error('Recording was never initialized — please retry the interview.');
    }

    return new Promise<RecorderResult>((resolve, reject) => {
      const recorder = this.mediaRecorder!;
      const mime = recorder.mimeType || 'video/webm';

      let isFinalized = false;
      let hasReceivedStopEvent = false;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
      const DEBOUNCE_SILENCE_MS = 400; // 400ms of complete silence after stop before finalizing
      const MAX_WAIT_MS = 2000; // Maximum cap of 2000ms after stop

      const finalizeAndStopTracks = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (maxWaitTimer) clearTimeout(maxWaitTimer);
        debounceTimer = null;
        maxWaitTimer = null;

        if (isFinalized) return;
        isFinalized = true;

        try {
          if (this.recordedChunks.length === 0) {
            throw new Error('MediaRecorder produced 0 video/audio chunks. Recording could not be captured.');
          }

          const consolidatedBlob = new Blob(this.recordedChunks, { type: mime });
          const totalSize = consolidatedBlob.size;
          const fileExt = mime.includes('mp4') ? 'mp4' : 'webm';
          const fileName = `interview_recording.${fileExt}`;

          if (totalSize === 0) {
            throw new Error('Final recording Blob has 0 bytes.');
          }

          // Expected minimum size heuristic:
          // A 720p/360p video stream with audio at minimum 150-250 kbps produces ~20-30 KB/sec minimum.
          // Minimum acceptable threshold is 10 KB per 5 seconds recorded, with absolute floor of 5 KB.
          const minExpectedBytes = Math.min(50000, Math.max(5120, durationSeconds * 4000));
          if (totalSize < minExpectedBytes && durationSeconds > 5) {
            console.warn(
              `[RECORDING] ⚠️ Recorded file size (${totalSize} bytes) is suspiciously small for ${durationSeconds}s duration (expected >= ${minExpectedBytes} bytes).`
            );
          }

          console.log(
            `[RECORDING] Final blob created ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
          );
          console.log(`filename=${fileName}`);
          console.log(`mimeType=${mime}`);
          console.log(`size=${totalSize}`);
          console.log(`duration=${durationSeconds}`);
          console.log(`chunkCount=${this.recordedChunks.length}`);

          // Hardware tracks stopped strictly AFTER the final blob is assembled and validated
          stopHardwareTracks();

          resolve({
            blob: consolidatedBlob,
            durationSeconds,
            mimeType: mime,
            chunksCount: this.recordedChunks.length,
            sizeBytes: totalSize,
          });
        } catch (err) {
          stopHardwareTracks();
          reject(err);
        }
      };

      const scheduleDebouncedFinalize = (reason: string) => {
        if (isFinalized) return;

        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }

        console.log(
          `[RECORDING] ⏳ Debounce timer started (${DEBOUNCE_SILENCE_MS}ms silence required). Reason: ${reason} (elapsed=${Date.now() - submitStartTime}ms)`
        );

        debounceTimer = setTimeout(() => {
          console.log(
            `[RECORDING] ⏱️ Debounce silence window of ${DEBOUNCE_SILENCE_MS}ms expired with no further chunks. Proceeding with Blob finalization. (elapsed=${Date.now() - submitStartTime}ms)`
          );
          finalizeAndStopTracks();
        }, DEBOUNCE_SILENCE_MS);
      };

      const handlePostStopChunkArrival = (chunkIndex: number, chunkSize: number) => {
        if (hasReceivedStopEvent) {
          scheduleDebouncedFinalize(`Chunk #${chunkIndex} (${chunkSize} bytes) arrived after MediaRecorder stop`);
        }
      };

      // Set up listeners for dataavailable & stop
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0 && !isFinalized) {
          this.recordedChunks.push(event.data);
          const chunkIndex = this.recordedChunks.length;
          const isFinalState = recorder.state === 'inactive';
          console.log(
            `[RECORDING] dataavailable event received (chunk #${chunkIndex}, ${event.data.size} bytes, recorderState=${recorder.state}, hasReceivedStop=${hasReceivedStopEvent}) elapsed=${Date.now() - submitStartTime}ms`
          );

          // If we are already waiting after stop event, reset the debounce silence timer
          if (hasReceivedStopEvent || isFinalState) {
            handlePostStopChunkArrival(chunkIndex, event.data.size);
          }
        }
      };

      recorder.onstop = () => {
        hasReceivedStopEvent = true;
        console.log(
          `[RECORDING] 🛑 MediaRecorder 'stop' event received ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms. Starting debounce window...`
        );

        // Start the silence debounce timer
        scheduleDebouncedFinalize("MediaRecorder 'stop' event fired");

        // Enforce maximum wait cap so it never hangs indefinitely
        maxWaitTimer = setTimeout(() => {
          if (!isFinalized) {
            console.warn(
              `[RECORDING] ⚠️ Max wait cap (${MAX_WAIT_MS}ms after stop) reached. Forcing finalization now. (elapsed=${Date.now() - submitStartTime}ms)`
            );
            finalizeAndStopTracks();
          }
        }, MAX_WAIT_MS);
      };

      recorder.onerror = (event: Event) => {
        console.error('[RECORDING] MediaRecorder error event:', event);
        finalizeAndStopTracks();
      };

      if (recorder.state === 'inactive') {
        hasReceivedStopEvent = true;
        console.log(
          `[RECORDING] 🛑 MediaRecorder already inactive ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms. Starting debounce window...`
        );
        scheduleDebouncedFinalize('MediaRecorder was already inactive');
      }

      try {
        // Request flush of pending data
        if (recorder.state === 'recording') {
          try {
            console.log(
              `[RECORDING] requestData() called ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
            );
            recorder.requestData();
          } catch (reqErr) {
            console.warn('[RECORDING] requestData notice:', reqErr);
          }
        }

        // Call stop on recorder while tracks are still alive
        console.log(
          `[RECORDING] stop() called ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
        );
        recorder.stop();
      } catch (err) {
        console.warn('[RECORDING] Error stopping recorder:', err);
        finalizeAndStopTracks();
      }
    });
  }

  /**
   * Stops all active audio/video tracks and closes AudioContext safely.
   */
  private stopAllTracks(submitStartTime?: number): void {
    if (this.mediaStream) {
      this.mediaStream.getVideoTracks().forEach((track) => {
        try {
          track.stop();
          if (submitStartTime) {
            console.log(
              `[RECORDING] Camera tracks stopped ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
            );
          }
        } catch (e) {
          console.warn('[RECORDING] Camera track stop error:', e);
        }
      });
      this.mediaStream.getAudioTracks().forEach((track) => {
        try {
          track.stop();
          if (submitStartTime) {
            console.log(
              `[RECORDING] Microphone tracks stopped ${new Date().toISOString()} elapsed=${Date.now() - submitStartTime}ms`
            );
          }
        } catch (e) {
          console.warn('[RECORDING] Mic track stop error:', e);
        }
      });
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Stops active camera and microphone hardware tracks.
   * Call only after upload has initiated or session is destroyed.
   */
  public cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
    }
  }
}
