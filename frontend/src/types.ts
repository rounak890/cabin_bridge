// Shared TypeScript types for CabinBridge

export type Role = 'passenger' | 'crew';
export type Lang = 'en' | 'ja' | 'hi' | 'th' | 'vi' | 'id' | 'tl';
export type MessageKind = 'speech' | 'text' | 'card' | 'safety' | 'urgent';
export type Priority = 'normal' | 'urgent';
export type DeliveryStatus = 'sent' | 'delivered' | 'acknowledged' | 'resolved' | 'not_delivered';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'empty';
export type UrgentType = 'medical' | 'unwell' | 'security' | 'other';

export interface LanguageInfo {
  code: Lang;
  name: string;
  nativeName: string;
  asr: boolean;
  translate: boolean;
  tts: boolean;
  phrasebook: boolean;
  pivot: boolean;
}

export interface PhraseText {
  en: string;
  ja: string;
  hi: string;
  th: string;
  vi: string;
  id: string;
  tl: string;
  [key: string]: string;
}

export interface Phrase {
  id: string;
  category: 'service' | 'assistance' | 'medical' | 'navigation' | 'safety' | 'urgent';
  icon: string;
  priority: Priority;
  approved: boolean;
  text: PhraseText;
}

export interface Message {
  id: string;
  from?: string;   // seat or 'crew'
  seat?: string;
  source_lang: Lang;
  source_text: string;
  translated_text: string;
  target_lang: Lang;
  kind: MessageKind;
  priority?: Priority;
  status?: DeliveryStatus;
  confidence_level?: ConfidenceLevel;
  asr_ms?: number;
  translate_ms?: number;
  total_ms?: number;
  edited?: boolean;
  ts?: number;
  is_crew_reply?: boolean;
  is_outgoing?: boolean;
}

export interface UrgentEvent {
  id: string;
  seat: string;
  urgent_type: UrgentType;
  ts: number;
  status?: DeliveryStatus;
}

export interface RepeatRequest {
  id: string;
  request_id: string;
  seat: string;
  ts: number;
}

export interface TranscribeResponse {
  text: string;
  language: string;
  confidence_level: ConfidenceLevel;
  avg_logprob: number;
  no_speech_prob: number;
  duration: number;
  processing_ms: number;
  error?: string;
}

export interface TranslateResponse {
  translated?: string;
  processing_ms?: number;
  engine?: string;
  error?: string;
}

export interface MetricsRecord {
  id: string;
  seat: string;
  kind: MessageKind;
  source_lang: string;
  target_lang: string;
  status: string;
  confidence_level: ConfidenceLevel;
  asr_ms: number;
  translate_ms: number;
  total_ms: number;
  created_at: number;
}

export interface MetricsResponse {
  requests: MetricsRecord[];
  stats: {
    asr: { median: number; p95: number; count: number };
    translate: { median: number; p95: number; count: number };
    total: { median: number; p95: number; count: number };
  };
  fallback_count: number;
  total_requests: number;
  crew_online: boolean;
  simulate_failure: boolean;
}

export interface AppSettings {
  role: Role | null;
  seat: string;
  lang: Lang;
  crewLang: Lang;
  /** One-time migration marker; legacy settings defaulted the crew language to Hindi. */
  crewLangVersion?: number;
  textSize: 1 | 2 | 3 | 4;   // 1=small, 4=xlarge
  highContrast: boolean;
  reducedMotion: boolean;
  simpleMode: boolean;
  ttsSpeed: number;            // 0.5 - 2.0
  confirmBeforeTTS: boolean;
  languageChosen?: boolean;
}


export interface Classification {
  intent: string;
  label: string;
  icon: string;
  summary: string;
  action: string;
  action_type?: string;
  urgency: 'routine' | 'attention' | 'urgent';
  urgency_label?: string;
  keywords: string[];
  confidence: number | null;
  source: 'jev' | 'local';
  error?: string;
}
