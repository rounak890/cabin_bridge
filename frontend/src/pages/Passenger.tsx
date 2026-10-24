import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Lang, Message, MessageKind } from '../types';
import { LANGUAGES } from '../languages';
import AccessibilityPanel from '../components/AccessibilityPanel';
import MessageComposer from '../components/MessageComposer';
import PhraseBoard from '../components/PhraseBoard';
import VoiceRecorder from '../components/VoiceRecorder';

function activityStatus(status?: Message['status']) {
  if (status === 'acknowledged') return 'Crew acknowledged';
  if (status === 'resolved') return 'Request resolved';
  if (status === 'not_delivered') return 'Not delivered';
  if (status === 'delivered') return 'Crew received request';
  if (status === 'sent') return 'Sending to crew';
  return 'Received';
}

function ConversationHistory({ messages, deliveryMap }: { messages: Message[]; deliveryMap: Record<string, string> }) {
  const [showAll, setShowAll] = useState(false);
  const entries = messages
    .filter(message => !message.is_crew_reply && !message.is_outgoing)
    .slice()
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const visibleEntries = (showAll ? entries : entries.slice(-5)).slice().reverse();
  return <section className="panel" aria-label="Conversation history">
    <header><h2>Conversation</h2><span>{entries.length} messages</span></header>
    {!entries.length ? <p>Your requests and their crew status will appear here.</p> :
      <ol className="conversation-list" aria-live="polite">
        {visibleEntries.map(message => {
          const status = deliveryMap[message.id] as Message['status'] | undefined || message.status;
          return <li className="conversation-entry passenger-entry" key={message.id}>
            <header>
              <strong>Your request</strong>
              <span className={`badge ${status === 'resolved' ? 'badge-success' : status === 'not_delivered' ? 'badge-urgent' : 'badge-info'}`}>
                {activityStatus(status)}
              </span>
            </header>
            <p>{message.translated_text || message.source_text}</p>
            {message.translated_text && message.source_text && message.translated_text !== message.source_text &&
              <small>Original: {message.source_text}</small>}
            {message.ts && <time dateTime={new Date(message.ts * 1000).toISOString()}>{new Date(message.ts * 1000).toLocaleTimeString()}</time>}
          </li>;
        })}
      </ol>}
    {entries.length > 5 && <button className="btn btn-ghost" onClick={() => setShowAll(value => !value)}>
      {showAll ? 'Show recent only' : `Show all ${entries.length} messages`}
    </button>}
  </section>;
}

function CrewReplyInbox({ messages, deliveryMap, lang, speed }: { messages: Message[]; deliveryMap: Record<string, string>; lang: Lang; speed: number }) {
  const replies = messages.filter(message => message.is_crew_reply).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return <section className="panel crew-reply-inbox" aria-label="Written cabin crew replies">
    <header><h2>Cabin crew replies</h2><span>{replies.length}</span></header>
    {!replies.length ? <p>Written replies from cabin crew will appear here. You can read them or tap “Hear reply”.</p> :
      <ol className="conversation-list" aria-live="polite">
        {replies.map(message => {
          const status = deliveryMap[message.id] || message.status;
          const replyText = message.translated_text || message.source_text;
          return <li className="conversation-entry crew-entry" key={message.id}>
            <header><strong>Message for you</strong>
              <span className={`badge ${status === 'delivered' ? 'badge-success' : 'badge-info'}`}>
                {status === 'not_delivered' ? 'Saved · reconnect to receive' : 'Crew reply'}
              </span>
            </header>
            <p className="crew-reply-text">{replyText}</p>
            {message.source_text && message.translated_text && message.source_text !== message.translated_text &&
              <small>Crew original ({message.source_lang}): {message.source_text}</small>}
            <div className="button-row">
              {message.ts && <time dateTime={new Date(message.ts * 1000).toISOString()}>{new Date(message.ts * 1000).toLocaleTimeString()}</time>}
              <button className="btn btn-secondary" disabled={!window.speechSynthesis} onClick={() => {
                const utterance = new SpeechSynthesisUtterance(replyText);
                utterance.lang = lang;
                utterance.rate = speed;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
              }}>🔊 Hear reply</button>
            </div>
          </li>;
        })}
      </ol>}
  </section>;
}

export default function Passenger() {
  const app = useApp();
  const [tab, setTab] = useState<'cards' | 'type' | 'voice' | 'settings' | 'replies'>('cards');
  const [crewLang, setCrewLang] = useState<Lang>(app.settings.crewLang);
  const [unreadReplyId, setUnreadReplyId] = useState<string | null>(null);
  const lastSeenReplyId = useRef<string | null>(null);
  const replies = app.messages
    .filter(message => message.is_crew_reply)
    .slice()
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const lastRequest = [...app.messages].reverse().find(message => !message.is_crew_reply && !message.is_outgoing);
  const latestReply = replies[replies.length - 1];
  const latestReplyText = latestReply ? (latestReply.translated_text || latestReply.source_text) : '';

  useEffect(() => {
    if (!latestReply || app.settings.confirmBeforeTTS || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestReply.translated_text || latestReply.source_text);
    utterance.lang = app.settings.lang;
    utterance.rate = app.settings.ttsSpeed;
    window.speechSynthesis.speak(utterance);
  }, [latestReply?.id, app.settings.confirmBeforeTTS, app.settings.lang, app.settings.ttsSpeed]);

  // A reply that arrives while the passenger is on another tab is surfaced
  // immediately in a fixed toast, so no refresh is ever needed to notice it.
  useEffect(() => {
    if (!latestReply) return;
    if (tab === 'replies') {
      lastSeenReplyId.current = latestReply.id;
      setUnreadReplyId(null);
      return;
    }
    if (latestReply.id !== lastSeenReplyId.current) setUnreadReplyId(latestReply.id);
  }, [latestReply?.id, tab]);

  useEffect(() => {
    if (app.wsStatus !== 'connected') return;
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') app.syncMessages();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => document.removeEventListener('visibilitychange', refreshOnReturn);
  }, [app.wsStatus, app.syncMessages]);

  function openReplies() {
    if (latestReply) lastSeenReplyId.current = latestReply.id;
    setUnreadReplyId(null);
    setTab('replies');
    window.setTimeout(() => {
      document.querySelector('.crew-reply-inbox')?.scrollIntoView({
        behavior: app.settings.reducedMotion ? 'auto' : 'smooth', block: 'start',
      });
    }, 50);
  }

  function dismissReplyToast() {
    if (latestReply) lastSeenReplyId.current = latestReply.id;
    setUnreadReplyId(null);
  }

  function send(source: string, translated: string, kind: MessageKind, metrics?: {
    asr_ms?: number; translate_ms?: number; confidence_level?: 'high' | 'medium' | 'low' | 'empty'; edited?: boolean;
  }) {
    const asrMs = metrics?.asr_ms || 0;
    const translateMs = metrics?.translate_ms || 0;
    app.sendMessage({
      from: app.settings.seat, seat: app.settings.seat,
      source_lang: app.settings.lang, source_text: source,
      translated_text: translated, target_lang: crewLang,
      kind, priority: 'normal', asr_ms: asrMs, translate_ms: translateMs,
      total_ms: asrMs + translateMs,
      confidence_level: metrics?.confidence_level || 'high', edited: metrics?.edited || false,
    });
  }

  const tabs = app.settings.simpleMode
    ? ['cards', 'voice', 'replies'] as const
    : ['cards', 'type', 'voice', 'replies', 'settings'] as const;

  return (
    <div className="page container">
      <header className="page-header">
        <h1 className="page-title">Passenger communication</h1>
        <label>Crew language <select value={crewLang} onChange={event => {
          const next = event.target.value as Lang;
          setCrewLang(next);
          app.updateSettings({ crewLang: next });
        }}>
          {LANGUAGES.filter(language => language.translate).map(language =>
            <option key={language.code} value={language.code}>{language.nativeName}</option>)}
        </select></label>
        <p>Connection: {app.wsStatus} · Crew {app.crewOnline ? 'online' : 'offline'}</p>
      </header>

      <nav className="tabs" aria-label="Ways to communicate">
        {tabs.map(item => <button className={`tab ${tab === item ? 'active' : ''}`} key={item} onClick={() => setTab(item)}>
          {item === 'cards' ? 'Phrase cards' : item === 'type' ? 'Type' : item === 'voice' ? 'Voice' : item === 'replies' ? `Crew replies${replies.length ? ` · ${replies.length}` : ''}` : 'Accessibility'}
        </button>)}
      </nav>

      {tab === 'replies' ? <CrewReplyInbox messages={app.messages} deliveryMap={app.deliveryMap} lang={app.settings.lang} speed={app.settings.ttsSpeed} /> : <>
      <ConversationHistory messages={app.messages} deliveryMap={app.deliveryMap} />
      <p className="notice">Medical and allergy phrases are communication assistance, not medical advice.</p>

      {tab === 'cards' && <PhraseBoard lang={app.settings.lang} targetLang={crewLang}
        simple={app.settings.simpleMode} ttsSpeed={app.settings.ttsSpeed}
        onSend={(source, translated, kind) => send(source, translated, kind)} />}
      {tab === 'type' && <MessageComposer sourceLang={app.settings.lang} targetLang={crewLang} onSend={send} />}
      {tab === 'voice' && (LANGUAGES.find(language => language.code === app.settings.lang)?.asr
        ? <section className="panel"><h2>Voice message</h2><VoiceRecorder targetLang={crewLang}
          onResult={(source, translated, asrMs, translateMs, confidence, edited) => send(source, translated, 'speech', {
            asr_ms: asrMs, translate_ms: translateMs,
            confidence_level: confidence as 'high' | 'medium' | 'low' | 'empty', edited,
          })} /></section>
        : <p className="notice">Voice input is unavailable in this language. Use phrase cards or typed text.</p>)}
      {tab === 'settings' && <>
        <AccessibilityPanel />
        <section className="panel"><h2>Language support</h2><div className="table-scroll">
          <table><thead><tr><th>Language</th><th>Voice</th><th>Translation</th><th>Phrase cards</th></tr></thead>
            <tbody>{LANGUAGES.map(language => <tr key={language.code}>
              <td>{language.nativeName}</td><td>{language.asr ? 'ASR available' : 'Card only'}</td>
              <td>{language.translate ? 'Argos local' : 'Card only'}</td><td>{language.phrasebook ? 'Available' : '—'}</td>
            </tr>)}</tbody>
          </table>
        </div></section>
      </>}

      {!app.settings.simpleMode && <details className="panel"><summary>Quick communication</summary>
        <div className="button-row">
          <button className="btn btn-secondary" disabled={!lastRequest || app.wsStatus !== 'connected'} onClick={() => lastRequest && app.sendRepeatRequest(lastRequest.id)}>🔁 Please repeat</button>
          <button className="btn btn-secondary" disabled={!lastRequest || app.wsStatus !== 'connected'} onClick={() => lastRequest && app.sendRepeatRequest(lastRequest.id)}>❓ I did not understand</button>
        </div>
      </details>}
      {!app.settings.simpleMode && <details className="panel"><summary>Request status · {Object.keys(app.deliveryMap).length}</summary>
        {Object.entries(app.deliveryMap).map(([id, status]) => {
          const message = app.messages.find(item => item.id === id);
          return <p key={id}><strong>{message?.is_crew_reply ? 'Crew reply' : 'Your request'}:</strong> {message?.translated_text || 'Message'} · {status === 'delivered' ? (message?.is_crew_reply ? 'Received' : 'Delivered to crew')
            : status === 'acknowledged' ? 'Acknowledged by crew'
              : status === 'resolved' ? 'Resolved by crew'
                : status === 'not_delivered' ? 'Not delivered — press your call button or raise your hand' : 'Sending'}</p>;
        })}
      </details>}
      </>}

      {unreadReplyId && tab !== 'replies' && latestReply && <div className="reply-toast" role="status" aria-live="assertive">
        <div>
          <strong>💬 New reply from cabin crew</strong>
          <p className="reply-toast-text">{latestReplyText}</p>
        </div>
        <div className="button-row">
          <button className="btn btn-primary" onClick={openReplies}>View reply</button>
          <button className="btn btn-ghost" onClick={dismissReplyToast}>Dismiss</button>
        </div>
      </div>}
    </div>
  );
}
