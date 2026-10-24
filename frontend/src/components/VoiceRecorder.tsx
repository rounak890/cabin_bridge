import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { Lang } from '../types';
import { apiHealth, apiTranscribe } from '../api';
import type { TranscribeResponse } from '../types';
import LevelMeter from './LevelMeter';
import TranscriptEditor from './TranscriptEditor';

interface Props {
  targetLang: Lang;
  onResult: (sourceText: string, translatedText: string, asrMs: number, translateMs: number, confidence: string, edited: boolean) => void;
}

type RecordState = 'idle' | 'recording' | 'processing' | 'review' | 'error';
type ServiceState = 'checking' | 'ready' | 'offline' | 'model_missing';

export default function VoiceRecorder({ targetLang, onResult }: Props) {
  const { settings } = useApp();
  const [recState, setRecState] = useState<RecordState>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [quality, setQuality] = useState<'ok' | 'too_quiet' | 'too_noisy' | 'clipping'>('ok');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResponse | null>(null);
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [serviceState, setServiceState] = useState<ServiceState>('checking');

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let active = true;
    const checkService = () => apiHealth().then(result => {
      if (active) setServiceState(result.asr_model?.cached === false ? 'model_missing' : 'ready');
    }).catch(() => { if (active) setServiceState('offline'); });
    checkService();
    const timer = setInterval(checkService, 8000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function startRecording() {
    setError('');
    if (serviceState !== 'ready') {
      setError(serviceState === 'model_missing'
        ? 'Whisper small is not cached on this computer. Follow SETUP.md to prepare the local model, then reload this page.'
        : 'The transcription backend is not ready. Start it with the backend command in SETUP.md, then try again.');
      setRecState('error');
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access requires a secure browser context. Open CabinBridge on localhost or HTTPS.');
      setRecState('error');
      return;
    }
    let activeStream: MediaStream | null = null;
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      activeStream = ms;
      streamRef.current = ms;
      setStream(ms);
      chunksRef.current = [];

      if (!window.MediaRecorder) throw new Error('This browser does not support audio recording. Please use typed text or phrase cards.');
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mr = mimeType ? new MediaRecorder(ms, { mimeType }) : new MediaRecorder(ms);
      mediaRecorder.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        ms.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setStream(null);
        void handleRecordingStop(mimeType || mr.mimeType || 'audio/webm');
      };
      mr.start(100);

      setRecState('recording');
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e) {
      activeStream?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
      const msg = (e as Error).message;
      if (msg.includes('Permission') || msg.includes('denied')) {
        setError('Microphone permission denied. Please allow microphone access in your browser settings, then try again.');
      } else {
        setError(`Could not start recording: ${msg}`);
      }
      setRecState('error');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    const recorder = mediaRecorder.current;
    if (!recorder || recorder.state === 'inactive') return;
    setRecState('processing');
    recorder.stop();
  }

  async function handleRecordingStop(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size < 512) {
      setError('The recording was too short or empty. Hold the mic a little longer, or use a phrase card.');
      setRecState('error');
      return;
    }
    // PRODUCT RULE 6: Audio is processed in memory and never stored.
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);

    try {
      const result = await apiTranscribe(blob, settings.lang);
      if (result.error && result.error !== 'audio_too_short') {
        setError(result.error === 'model_not_available'
          ? 'Whisper small is not cached on this computer. Follow SETUP.md to prepare the local model, then reload this page.'
          : 'The local transcription engine could not process this recording. Check the backend console for the model error. Your audio was not saved.');
        URL.revokeObjectURL(url);
        setAudioUrl(null);
        setRecState('error');
        return;
      }
      setTranscribeResult(result);
      setRecState('review');
    } catch (e) {
      setError('Could not reach transcription service. Please check if the backend is running.');
      setRecState('error');
    }
  }

  const handleConfirm = useCallback((sourceText: string, translatedText: string, translateMs: number, edited: boolean) => {
    const asrMs = transcribeResult?.processing_ms ?? 0;
    const confidence = transcribeResult?.confidence_level ?? 'high';
    onResult(sourceText, translatedText, asrMs, translateMs, confidence, edited);
    setRecState('idle');
    setTranscribeResult(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
  }, [transcribeResult, audioUrl, onResult]);

  function reset() {
    setRecState('idle');
    setTranscribeResult(null);
    setError('');
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
  }

  if (recState === 'review' && transcribeResult) {
    return (
      <TranscriptEditor
        result={transcribeResult}
        sourceLang={settings.lang as Lang}
        targetLang={targetLang}
        onConfirm={handleConfirm}
        onRetry={reset}
        onCancel={reset}
        audioUrl={audioUrl}
      />
    );
  }

  return (
    <div className="voice-recorder">
      <div className="voice-rec-status" role="status" aria-live="off">
        {recState === 'recording' && <div className="voice-recording-label">
          <span className="voice-recording-dot" aria-hidden="true" />
          Recording · {recSeconds}s · Tap the microphone to stop
        </div>}
      </div>

      <div className="voice-quality" aria-live="off">
      {recState === 'recording' && quality !== 'ok' && (
        <div style={{fontSize:'var(--text-xs)',color:'var(--color-warning)',textAlign:'center'}}>
          {quality === 'too_quiet' && '🎤 Too quiet — move closer to the mic'}
          {quality === 'too_noisy' && '🔊 Very noisy — try to reduce background noise'}
          {quality === 'clipping' && '⚠️ Audio clipping — move mic further away'}
        </div>
      )}
      </div>

      {/* Level meter */}
      <div style={{width:'100%',maxWidth:'300px'}}>
        <LevelMeter stream={stream} onQualityFeedback={setQuality} />
      </div>

      {serviceState !== 'ready' && <p className="notice" role="status">
        {serviceState === 'checking' && 'Checking local voice service…'}
        {serviceState === 'offline' && 'Voice service is offline. Start the backend from SETUP.md.'}
        {serviceState === 'model_missing' && 'Whisper small is not cached. Follow SETUP.md to prepare voice recognition.'}
      </p>}

      {/* Big push-to-talk mic button */}
      <button
        id="mic-btn"
        className={`mic-btn ${recState === 'recording' ? 'recording' : ''}`}
        onClick={() => { if (recState === 'idle' || recState === 'error') void startRecording(); else if (recState === 'recording') stopRecording(); }}
        aria-label={recState === 'idle' || recState === 'error' ? 'Start recording' : recState === 'recording' ? 'Stop recording' : 'Processing...'}
        disabled={recState === 'processing' || serviceState === 'checking'}
        aria-pressed={recState === 'recording'}
      >
        {recState === 'processing' ? <span className="animate-spin" style={{fontSize:'1.5rem'}}>⟳</span> : '🎤'}
      </button>

      <p className="voice-instruction" style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)',textAlign:'center'}}>
        {recState === 'idle' && 'Tap once to start; tap again to stop and transcribe'}
        {recState === 'recording' && 'Tap the microphone again when you have finished speaking'}
        {recState === 'processing' && 'Transcribing audio…'}
      </p>

      {/* Audio playback after processing */}
      {audioUrl && recState === 'review' && (
        <audio controls src={audioUrl} style={{width:'100%',maxWidth:'300px'}} aria-label="Recorded audio playback" />
      )}

      {error && (
        <div role="alert" style={{color:'var(--color-urgent)',fontSize:'var(--text-sm)',textAlign:'center',background:'var(--color-urgent-dim)',border:'1px solid var(--color-urgent)',borderRadius:'var(--radius-sm)',padding:'var(--space-3)'}}>
          {error}
          <br/><button className="btn btn-ghost" style={{marginTop:'8px',minHeight:'32px',padding:'4px 12px',fontSize:'0.8rem'}} onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}
