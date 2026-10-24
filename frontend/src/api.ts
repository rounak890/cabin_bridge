// Typed API client for CabinBridge
import type { TranscribeResponse, TranslateResponse, MetricsResponse, Classification } from './types';

const BASE = '';

export async function apiHealth(): Promise<{ status: string; asr_model?: { cached: boolean; loaded: boolean } }> {
  const r = await fetch(`${BASE}/api/health`);
  if (!r.ok) throw new Error('Health check failed');
  return r.json();
}

export async function apiTranscribe(
  audioBlob: Blob,
  lang: string
): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append('audio', audioBlob, audioBlob.type.includes('webm') ? 'recording.webm' : 'recording.wav');
  form.append('lang', lang);
  const r = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Transcribe failed: ${r.status}`);
  return r.json();
}

export async function apiTranslate(
  text: string,
  source: string,
  target: string
): Promise<TranslateResponse> {
  const r = await fetch(`${BASE}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source, target }),
  });
  if (!r.ok) throw new Error(`Translate failed: ${r.status}`);
  return r.json();
}

export async function apiMetrics(): Promise<MetricsResponse> {
  const r = await fetch(`${BASE}/api/metrics`);
  if (!r.ok) throw new Error('Metrics failed');
  return r.json();
}

export async function apiToggleFailure(on: boolean): Promise<void> {
  await fetch(`${BASE}/api/simulate_failure?on=${on}`, { method: 'POST' });
}

export async function apiClassify(
  text: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  kind: string
): Promise<Classification> {
  const r = await fetch(`${BASE}/api/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_text: sourceText, source_lang: sourceLang, target_lang: targetLang, kind }),
  });
  if (!r.ok) throw new Error(`Classify failed: ${r.status}`);
  return r.json();
}
