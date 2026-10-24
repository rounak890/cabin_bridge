import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Lang, Message, MessageKind, Phrase } from '../types';
import { FLAGS, LANGUAGES } from '../languages';
import catalog from '../../../shared/approved_phrases.json';
import AccessibilityPanel from '../components/AccessibilityPanel';
import MessageComposer from '../components/MessageComposer';
import VoiceRecorder from '../components/VoiceRecorder';

const HOME_PHRASE_IDS = ['p001', 'p002', 'p003', 'p004', 'p007', 'p009'];
const HOME_PHRASES = (catalog as { phrases: Phrase[] }).phrases
  .filter(phrase => HOME_PHRASE_IDS.includes(phrase.id))
  .sort((a, b) => HOME_PHRASE_IDS.indexOf(a.id) - HOME_PHRASE_IDS.indexOf(b.id));

function activityStatus(status?: Message['status']) {
  if (status === 'acknowledged') return 'Crew acknowledged';
  if (status === 'resolved') return 'Request resolved';
  if (status === 'not_delivered') return 'Not delivered';
  if (status === 'delivered') return 'Crew received request';
  if (status === 'sent') return 'Sending to crew';
  return 'Received';
}

function ConversationHistory({ messages, deliveryMap, hiddenIds, onHide, onHideAll, onRestore }: {
  messages: Message[]; deliveryMap: Record<string, string>;
  hiddenIds: string[]; onHide: (id: string) => void; onHideAll: (ids: string[]) => void; onRestore: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const hidden = new Set(hiddenIds);
  const entries = messages
    .filter(message => !message.is_crew_reply && !message.is_outgoing)
    .slice()
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .filter(message => !hidden.has(message.id));
  const visibleEntries = (showAll ? entries : entries.slice(-5)).slice().reverse();
  return <section className="panel" aria-label="Conversation history">
    <header>
      <h2>Conversation</h2>
      <div className="history-actions">
        <span>{entries.length} shown</span>
        {entries.length > 0 && <button type="button" className="btn btn-ghost btn-compact" onClick={() => onHideAll(entries.map(message => message.id))}>Clear all</button>}
        {hiddenIds.length > 0 && <button type="button" className="btn btn-ghost btn-compact" onClick={onRestore}>Restore cleared ({hiddenIds.length})</button>}
      </div>
    </header>
    {!entries.length ? <p>{hiddenIds.length ? 'All requests are cleared from this view. Use “Restore cleared” to bring them back.' : 'Your requests and their crew status will appear here.'}</p> :
      <ol className="conversation-list" aria-live="polite">
        {visibleEntries.map(message => {
          const status = deliveryMap[message.id] as Message['status'] | undefined || message.status;
          return <li className="conversation-entry passenger-entry" key={message.id}>
            <header>
              <strong>Your request</strong>
              <div className="entry-header-right">
                <span className={`badge ${status === 'resolved' ? 'badge-success' : status === 'not_delivered' ? 'badge-urgent' : 'badge-info'}`}>
                  {activityStatus(status)}
                </span>
                <button type="button" className="entry-clear" onClick={() => onHide(message.id)}
                  aria-label="Clear this request from your conversation view" title="Clear from view">×</button>
              </div>
            </header>
            <p>{message.translated_text || message.source_text}</p>
            {message.translated_text && message.source_text && message.translated_text !== message.source_text &&
              <small>Original: {message.source_text}</small>}
            {message.ts && <time dateTime={new Date(message.ts * 1000).toISOString()}>{new Date(message.ts * 1000).toLocaleTimeString()}</time>}
          </li>;
        })}
      </ol>}
    {entries.length > 5 && <button type="button" className="btn btn-ghost" onClick={() => setShowAll(value => !value)}>
      {showAll ? 'Show recent only' : `Show all ${entries.length} requests`}
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

type PassengerView = 'home' | 'voice' | 'type' | 'replies' | 'history' | 'more';

export default function Passenger() {
  const app = useApp();
  const [view, setView] = useState<PassengerView>('home');
  const [crewLang, setCrewLang] = useState<Lang>(app.settings.crewLang);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [unreadReplyId, setUnreadReplyId] = useState<string | null>(null);
  const lastSeenReplyId = useRef<string | null>(null);
  const historyKey = `cb_hidden_requests_${app.settings.seat || 'unknown'}`;
  const [hiddenRequests, setHiddenRequests] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) || '[]');
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  });
  const hiddenSet = new Set(hiddenRequests);
  const historyEntries = app.messages.filter(message => !message.is_crew_reply && !message.is_outgoing);
  const visibleHistoryCount = historyEntries.filter(message => !hiddenSet.has(message.id)).length;
  const replies = app.messages
    .filter(message => message.is_crew_reply)
    .slice()
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const lastRequest = [...app.messages].reverse().find(message => !message.is_crew_reply && !message.is_outgoing && !hiddenSet.has(message.id));
  const lastStatus = lastRequest ? (app.deliveryMap[lastRequest.id] || lastRequest.status) : undefined;
  const latestReply = replies[replies.length - 1];
  const latestReplyText = latestReply ? (latestReply.translated_text || latestReply.source_text) : '';
  const voiceAvailable = Boolean(LANGUAGES.find(language => language.code === app.settings.lang)?.asr);

  function persistHidden(next: string[]) {
    setHiddenRequests(next);
    try {
      if (next.length) localStorage.setItem(historyKey, JSON.stringify(next));
      else localStorage.removeItem(historyKey);
    } catch { /* local view preference is optional */ }
  }
  function hideRequest(id: string) {
    if (hiddenSet.has(id)) return;
    persistHidden([...hiddenRequests, id]);
  }
  function hideRequests(ids: string[]) {
    persistHidden([...new Set([...hiddenRequests, ...ids])]);
  }
  function restoreHidden() {
    persistHidden([]);
  }

  function speak(text: string) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = app.settings.lang;
    utterance.rate = app.settings.ttsSpeed;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!latestReply || app.settings.confirmBeforeTTS || !window.speechSynthesis) return;
    speak(latestReply.translated_text || latestReply.source_text);
  }, [latestReply?.id, app.settings.confirmBeforeTTS, app.settings.lang, app.settings.ttsSpeed]);

  // A reply that arrives while the passenger is on another screen is surfaced
  // immediately in a fixed toast, so no refresh is ever needed to notice it.
  useEffect(() => {
    if (!latestReply) return;
    if (view === 'replies') {
      lastSeenReplyId.current = latestReply.id;
      setUnreadReplyId(null);
      return;
    }
    if (latestReply.id !== lastSeenReplyId.current) setUnreadReplyId(latestReply.id);
  }, [latestReply?.id, view]);

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
    setView('replies');
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

  function sendPhrase(phrase: Phrase) {
    const source = phrase.text[app.settings.lang] || phrase.text.en;
    const translated = phrase.text[crewLang] || phrase.text.en;
    send(source, translated, 'card');
    setJustSent(phrase.id);
    window.setTimeout(() => setJustSent(current => current === phrase.id ? null : current), 1800);
  }

  function changeLanguage(next: Lang) {
    app.updateSettings({ lang: next });
  }

  const header = <>
    <header className="simple-top">
      <div>
        <p className="simple-kicker">CabinBridge · JL-DEMO</p>
        <h1 className="simple-title">How can we help?</h1>
      </div>
      <label className="simple-language">
        <span aria-hidden="true">{FLAGS[app.settings.lang]}</span>
        <span className="sr-only">Your language</span>
        <select value={app.settings.lang} onChange={event => changeLanguage(event.target.value as Lang)}>
          {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
        </select>
      </label>
    </header>
    <p className="simple-connection">
      <span className={`status-dot ${app.wsStatus === 'connected' && app.crewOnline ? 'online' : app.wsStatus === 'connecting' ? 'connecting' : 'offline'}`} />
      {app.wsStatus !== 'connected' ? 'Connecting to the crew…' : app.crewOnline ? 'Crew connected' : 'Crew offline — use the call button if urgent'}
    </p>
  </>;

  const backButton = view !== 'home'
    ? <button type="button" className="simple-back" onClick={() => setView('home')}>← Back</button>
    : null;

  return (
    <div className="page container simple-passenger">
      {header}

      {view === 'home' ? <>
        {replies.length > 0 && <section className="simple-replies" aria-label="Cabin crew replies">
          <div className="simple-replies-head">
            <h2>💬 From the crew</h2>
            {replies.length > 2 && <button type="button" onClick={openReplies}>All {replies.length}</button>}
          </div>
          {replies.slice(-2).reverse().map(reply => {
            const text = reply.translated_text || reply.source_text;
            return <article className="simple-bubble" key={reply.id}>
              <p>{text}</p>
              <button type="button" className="simple-listen" onClick={() => speak(text)}>🔊 Listen</button>
            </article>;
          })}
        </section>}

        <section aria-labelledby="simple-needs-title">
          <h2 id="simple-needs-title" className="simple-section-title">What do you need?</h2>
          <div className="simple-tile-grid">
            {HOME_PHRASES.map(phrase => {
              const sent = justSent === phrase.id;
              return <button key={phrase.id} type="button" className={`simple-tile ${sent ? 'is-sent' : ''}`}
                onClick={() => sendPhrase(phrase)} aria-label={`${phrase.text.en} — send to crew`}>
                <span className="simple-tile-icon" aria-hidden="true">{phrase.icon}</span>
                <span className="simple-tile-text">{sent ? '✓ Sent to crew' : (phrase.text[app.settings.lang] || phrase.text.en)}</span>
                {app.settings.lang !== 'en' && <span className="simple-tile-sub">{phrase.text.en}</span>}
              </button>;
            })}
          </div>
        </section>

        <div className="simple-secondary">
          <button type="button" className="simple-action" onClick={() => setView('voice')}>
            🎤<span>Speak<small>Say it in your language</small></span>
          </button>
          <button type="button" className="simple-action" onClick={() => setView('type')}>
            ⌨️<span>Type<small>Write a message</small></span>
          </button>
        </div>

        {lastRequest && <section className={`simple-status ${lastStatus === 'not_delivered' ? 'is-error' : lastStatus === 'resolved' ? 'is-done' : ''}`} role="status" aria-live="polite">
          <span className="simple-status-icon" aria-hidden="true">{lastStatus === 'not_delivered' ? '⚠️' : lastStatus === 'resolved' ? '✅' : '⏳'}</span>
          <div>
            <span className="simple-status-label">Last request</span>
            <strong>{lastRequest.translated_text || lastRequest.source_text}</strong>
            <span className="simple-status-text">{activityStatus(lastStatus)}</span>
            {lastStatus === 'not_delivered' && <p className="simple-status-help">Press the call button above your seat or raise your hand.</p>}
          </div>
        </section>}

        <p className="simple-disclaimer">Phrase translations are communication assistance, not medical advice.</p>

        <nav className="simple-nav" aria-label="More options">
          <button type="button" onClick={() => setView('replies')}>💬<span>Replies</span>{replies.length > 0 && <em>{replies.length}</em>}</button>
          <button type="button" onClick={() => setView('history')}>🕘<span>History</span>{visibleHistoryCount > 0 && <em>{visibleHistoryCount}</em>}</button>
          <button type="button" onClick={() => setView('more')}>⚙️<span>More</span></button>
        </nav>
      </> : <>
        {backButton}
        {view === 'voice' && <section className="simple-panel" aria-label="Speak your request">
          <h2>Speak your request</h2>
          <p className="simple-panel-hint">Tap the microphone, say what you need, check the words, then send.</p>
          {voiceAvailable ? <VoiceRecorder targetLang={crewLang}
            onResult={(source, translated, asrMs, translateMs, confidence, edited) => send(source, translated, 'speech', {
              asr_ms: asrMs, translate_ms: translateMs,
              confidence_level: confidence as 'high' | 'medium' | 'low' | 'empty', edited,
            })} />
            : <p className="simple-empty">Voice input is unavailable in this language. Please use the phrase cards or type your message.</p>}
        </section>}

        {view === 'type' && <section className="simple-panel" aria-label="Type your request">
          <h2>Type your request</h2>
          <MessageComposer sourceLang={app.settings.lang} targetLang={crewLang} onSend={send} />
        </section>}

        {view === 'replies' && <CrewReplyInbox messages={app.messages} deliveryMap={app.deliveryMap} lang={app.settings.lang} speed={app.settings.ttsSpeed} />}

        {view === 'history' && <ConversationHistory messages={app.messages} deliveryMap={app.deliveryMap}
          hiddenIds={hiddenRequests} onHide={hideRequest} onHideAll={hideRequests} onRestore={restoreHidden} />}

        {view === 'more' && <section className="simple-panel" aria-label="More options">
          <h2>More options</h2>
          <div className="simple-more-list">
            <button type="button" onClick={() => setView('replies')}>💬 Crew replies {replies.length > 0 && <em>{replies.length}</em>}</button>
            <button type="button" onClick={() => setView('history')}>🕘 Request history</button>
            <details>
              <summary>🌐 Crew language</summary>
              <p className="simple-panel-hint">The language your messages are translated into for the crew.</p>
              <select value={crewLang} onChange={event => {
                const next = event.target.value as Lang;
                setCrewLang(next);
                app.updateSettings({ crewLang: next });
              }}>
                {LANGUAGES.filter(language => language.translate).map(language =>
                  <option key={language.code} value={language.code}>{language.nativeName}</option>)}
              </select>
            </details>
            <details>
              <summary>♿ Accessibility</summary>
              <AccessibilityPanel />
            </details>
            <details>
              <summary>ℹ️ About & privacy</summary>
              <p className="simple-panel-hint">Local-first communication aid. Audio is processed in memory and is not stored. Translations are not medical advice and require native-speaker review before operational use.</p>
              <a href="#/about">Read more</a>
            </details>
            <a href="#/">Switch workspace</a>
          </div>
        </section>}
      </>}

      {unreadReplyId && view !== 'replies' && view !== 'home' && latestReply && <div className="reply-toast" role="status" aria-live="assertive">
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
