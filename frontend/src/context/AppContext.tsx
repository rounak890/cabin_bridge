import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { AppSettings, Message, UrgentEvent, RepeatRequest, DeliveryStatus, Lang, Role } from '../types';
import { applyRealtimeEvent, type RealtimeEvent } from './realtimeState';

/** Same-device tab sync only. Events are tagged with the tab that emitted them
 * so a crew tab and a passenger tab can never reinterpret each other's events. */
interface LocalRealtimeEvent extends RealtimeEvent {
  origin?: { role: Role; seat: string };
}

const normalizeSeat = (seat: string) => seat.replace(/\s/g, '').toUpperCase();

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  messages: Message[];
  urgentEvents: UrgentEvent[];
  repeatRequests: RepeatRequest[];
  crewOnline: boolean;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  sendMessage: (msg: Omit<Message, 'id'>) => void;
  sendUrgent: (urgentType: string, id?: string) => void;
  replyToSeat: (seat: string, lang: Lang, requestId?: string) => void;
  sendAck: (id: string) => void;
  sendResolve: (id: string) => void;
  syncMessages: () => void;
  sendRepeatRequest: (id: string) => void;
  sendCrewReply: (targetSeat: string, sourceText: string, translatedText: string, sourceLang: Lang, targetLang: Lang, kind?: string, requestId?: string) => string | null;
  toggleSimFailure: (on: boolean) => void;
  simulateFailure: boolean;
  deliveryMap: Record<string, DeliveryStatus>;
  replyTarget: { seat: string; lang: Lang; requestId?: string } | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  role: null,
  seat: '',
  lang: 'en',
  crewLang: 'en',
  textSize: 2,
  highContrast: false,
  reducedMotion: false,
  simpleMode: false,
  ttsSpeed: 1.0,
  confirmBeforeTTS: false,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('cb_settings');
      const parsed = stored ? JSON.parse(stored) as Partial<AppSettings> : null;
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...(parsed || {}) };
      // Older sessions persisted crewLang="hi" from an earlier demo. Reset the
      // crew translation target to English once; an explicit choice after that
      // is preserved (the marker is saved with the settings).
      if (!parsed || parsed.crewLangVersion !== 2) {
        merged.crewLang = 'en';
        merged.crewLangVersion = 2;
        localStorage.setItem('cb_settings', JSON.stringify(merged));
      }
      return merged;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [urgentEvents, setUrgentEvents] = useState<UrgentEvent[]>([]);
  const [repeatRequests, setRepeatRequests] = useState<RepeatRequest[]>([]);
  const [crewOnline, setCrewOnline] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [deliveryMap, setDeliveryMap] = useState<Record<string, DeliveryStatus>>({});
  const [replyTarget, setReplyTarget] = useState<{ seat: string; lang: Lang; requestId?: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const bcRef = useRef<BroadcastChannel | null>(null);
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => applyRealtimeEvent(event, {
    messages: setMessages, urgentEvents: setUrgentEvents, repeatRequests: setRepeatRequests, deliveryMap: setDeliveryMap,
    crewOnline: setCrewOnline, simulateFailure: setSimulateFailure,
  }), []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('cb_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  // Apply accessibility classes to document
  useEffect(() => {
    const html = document.documentElement;
    html.className = [
      `ts-${settings.textSize}`,
      settings.highContrast ? 'high-contrast' : '',
      settings.reducedMotion ? 'reduced-motion' : '',
      settings.simpleMode ? 'simple-mode' : '',
    ].filter(Boolean).join(' ');
  }, [settings.textSize, settings.highContrast, settings.reducedMotion, settings.simpleMode]);

  // BroadcastChannel is only a same-device offline fallback. Live WebSocket
  // events are deliberately not re-broadcast: the server already routes crew
  // replies to the passenger role (and crew copies to the crew role), so
  // replaying them across roles would overwrite is_crew_reply flags and make a
  // reply disappear from the passenger screen until a refresh.
  useEffect(() => {
    const bc = new BroadcastChannel('cabinbridge');
    bcRef.current = bc;
    bc.onmessage = (event: MessageEvent<LocalRealtimeEvent>) => {
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;
      if (data.type === 'presence' || data.type === 'simulate_failure') {
        handleRealtimeEvent(data);
        return;
      }
      const origin = data.origin;
      if (!origin) return;
      const mySeat = normalizeSeat(settings.seat);
      const fromSeat = normalizeSeat(origin.seat || '');
      if (data.type === 'message') {
        // An offline passenger message is visible to the crew console and to
        // other tabs for the same passenger seat, never to another seat.
        if (settings.role === 'crew' || (settings.role === 'passenger' && fromSeat === mySeat)) {
          handleRealtimeEvent(data);
        }
      } else if (data.type === 'urgent') {
        if (settings.role === 'crew') handleRealtimeEvent(data);
      } else if (data.type === 'delivery' || data.type === 'ack') {
        handleRealtimeEvent(data);
      }
    };
    return () => bc.close();
  }, [handleRealtimeEvent, settings.role, settings.seat]);

  // WebSocket connection with auto-reconnect
  const connect = useCallback(() => {
    if (!settings.role || !settings.seat) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws?role=${settings.role}&seat=${encodeURIComponent(settings.seat)}&lang=${settings.lang}`;

    setWsStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setWsStatus('connected');
      ws.send(JSON.stringify({ type: 'join', role: settings.role, seat: settings.seat, lang: settings.lang }));
      try {
        const queued = JSON.parse(localStorage.getItem('cb_outbox') || '[]') as object[];
        queued.forEach(item => ws.send(JSON.stringify(item)));
        localStorage.removeItem('cb_outbox');
      } catch { /* keep the live connection available even if local storage is unavailable */ }
    };
    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setWsStatus('disconnected');
    };
    ws.onmessage = (e) => {
      if (wsRef.current !== ws) return;
      try {
        handleRealtimeEvent(JSON.parse(e.data) as RealtimeEvent);
      } catch { /* ignore */ }
    };
  }, [settings.role, settings.seat, settings.lang, handleRealtimeEvent]);

  useEffect(() => {
    if (settings.role && settings.seat) {
      connect();
    }
    return () => {
      clearTimeout(reconnectTimer.current);
      const current = wsRef.current;
      wsRef.current = null;
      current?.close();
    };
  }, [settings.role, settings.seat, settings.lang]);

  const wsSend = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Tag locally generated events with their role/seat so other tabs can decide
  // whether the event is relevant to them before applying it.
  const postLocal = useCallback((event: RealtimeEvent) => {
    if (!settings.role) return;
    bcRef.current?.postMessage({ ...event, origin: { role: settings.role, seat: normalizeSeat(settings.seat) } });
  }, [settings.role, settings.seat]);

  const sendMessage = useCallback((msg: Omit<Message, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 10);
    const full = { ...msg, id, ts: msg.ts || Date.now() / 1000 };
    setMessages(prev => [...prev.slice(-99), { ...full, status: 'sent' as DeliveryStatus }]);
    setDeliveryMap(prev => ({ ...prev, [id]: 'sent' }));
    const event = { type: 'message', ...full };
    if (wsRef.current?.readyState === WebSocket.OPEN) wsSend(event);
    else {
      setDeliveryMap(prev => ({ ...prev, [id]: 'not_delivered' }));
      try { const queue = JSON.parse(localStorage.getItem('cb_outbox') || '[]') as object[]; queue.push(event); localStorage.setItem('cb_outbox', JSON.stringify(queue.slice(-50))); } catch { /* optional local queue */ }
      postLocal({ type: 'message', ...full, from: settings.seat, status: 'sent' });
    }
  }, [postLocal, settings.seat, wsSend]);

  const sendUrgent = useCallback((urgentType: string, messageId?: string) => {
    const id = messageId || Math.random().toString(36).slice(2, 10);
    const ts = Date.now() / 1000;
    const label = `Urgent assistance: ${urgentType}`;
    setMessages(prev => [...prev.slice(-99), {
      id, seat: settings.seat, from: settings.seat,
      source_lang: settings.lang, source_text: label,
      translated_text: label, target_lang: 'en',
      kind: 'urgent', priority: 'urgent', status: 'sent', ts,
    }]);
    setDeliveryMap(prev => ({ ...prev, [id]: 'sent' }));
    const event = { type: 'urgent', id, urgent_type: urgentType, seat: settings.seat, ts };
    if (wsRef.current?.readyState === WebSocket.OPEN) wsSend(event);
    else { setDeliveryMap(prev => ({ ...prev, [id]: 'not_delivered' })); postLocal(event); }
  }, [postLocal, settings.lang, settings.seat, wsSend]);

  const sendAck = useCallback((id: string) => wsSend({ type: 'ack', id }), [wsSend]);
  const sendResolve = useCallback((id: string) => {
    // Move the card immediately; the backend event then synchronizes the
    // passenger, other crew consoles, and reconnect snapshot.
    setDeliveryMap(prev => ({ ...prev, [id]: 'resolved' }));
    setMessages(prev => prev.map(message => message.id === id ? { ...message, status: 'resolved' } : message));
    setUrgentEvents(prev => prev.map(event => event.id === id ? { ...event, status: 'resolved' } : event));
    postLocal({ type: 'delivery', id, status: 'resolved' });
    wsSend({ type: 'resolve', id });
  }, [postLocal, wsSend]);
  const syncMessages = useCallback(() => wsSend({ type: 'sync' }), [wsSend]);
  const sendRepeatRequest = useCallback((requestId: string) => {
    const id = Math.random().toString(36).slice(2, 10);
    wsSend({ type: 'repeat_request', id, request_id: requestId });
  }, [wsSend]);

  const sendCrewReply = useCallback((targetSeat: string, sourceText: string, translatedText: string, sourceLang: Lang, targetLang: Lang, kind = 'text', requestId?: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !targetSeat.trim()) return null;
    const id = Math.random().toString(36).slice(2, 10);
    const normalizedSeat = targetSeat.replace(/\s/g, '').toUpperCase();
    const relatedRequest = requestId
      ? messages.find(message => message.id === requestId && (message.seat || message.from || '').replace(/\s/g, '').toUpperCase() === normalizedSeat)
      : [...messages].reverse().find(message => !message.is_crew_reply && !message.is_outgoing
        && (message.seat || message.from || '').replace(/\s/g, '').toUpperCase() === normalizedSeat
        && (deliveryMap[message.id] || message.status) !== 'resolved');
    if (relatedRequest) {
      setDeliveryMap(prev => ({ ...prev, [relatedRequest.id]: 'resolved' }));
      setMessages(prev => prev.map(message => message.id === relatedRequest.id ? { ...message, status: 'resolved' } : message));
    }
    const msg: Message = { id, seat: targetSeat.trim(), from: settings.seat, source_text: sourceText, translated_text: translatedText, source_lang: sourceLang, target_lang: targetLang, kind: kind as Message['kind'], status: 'sent', ts: Date.now()/1000, is_outgoing: true };
    setMessages(prev => [...prev.slice(-99), msg]);
    setDeliveryMap(prev => ({ ...prev, [id]: 'sent' }));
    wsSend({ type: 'crew_reply', id, target_seat: targetSeat.trim(), source_text: sourceText, translated_text: translatedText, source_lang: sourceLang, target_lang: targetLang, kind, request_id: requestId });
    return id;
  }, [deliveryMap, messages, settings.seat, wsSend]);
  const replyToSeat = useCallback((seat: string, lang: Lang, requestId?: string) => setReplyTarget(seat ? { seat, lang, requestId } : null), []);

  const toggleSimFailure = useCallback((on: boolean) => {
    setSimulateFailure(on);
    wsSend({ type: 'simulate_failure', on });
  }, [wsSend]);

  const value: AppContextValue = {
    settings, updateSettings,
    messages, urgentEvents, repeatRequests,
    crewOnline, wsStatus,
    sendMessage, sendUrgent,
    sendAck, sendResolve, syncMessages, sendRepeatRequest, sendCrewReply, replyToSeat,
    toggleSimFailure, simulateFailure,
    deliveryMap, replyTarget,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export type { AppContextValue };
