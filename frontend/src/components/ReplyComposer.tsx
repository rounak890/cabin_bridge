import { useEffect, useState } from 'react';
import catalog from '../../../shared/approved_phrases.json';
import { apiTranslate } from '../api';
import { useApp } from '../context/AppContext';
import { LANGUAGES } from '../languages';
import type { Lang, Phrase } from '../types';
import VoiceRecorder from './VoiceRecorder';

const quickReplies = (catalog as { phrases: Phrase[] }).phrases.filter(phrase =>
  ['c003', 'c004', 'c005', 'c006', 'c007'].includes(phrase.id));

export default function ReplyComposer({ seat, targetLang, requestId, onClose }: {
  seat: string; targetLang: Lang; requestId?: string; onClose?: () => void;
}) {
  const app = useApp();
  const [text, setText] = useState('');
  const [translated, setTranslated] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState('');
  const delivery = sentId ? app.deliveryMap[sentId] : undefined;

  useEffect(() => {
    setTranslated('');
    setSentId('');
    setError('');
  }, [seat, targetLang, requestId]);

  function chooseReply(phrase: Phrase) {
    setText(phrase.text[app.settings.lang]);
    setTranslated(phrase.text[targetLang]);
    setSentId('');
    setError('');
  }

  async function previewTranslation() {
    const source = text.trim();
    if (!source) return;
    if (app.settings.lang === targetLang) {
      setTranslated(source);
      setError('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await apiTranslate(source, app.settings.lang, targetLang);
      if (response.translated) setTranslated(response.translated);
      else { setTranslated(''); setError('Live translation is unavailable for this language pair. Use a quick reply, or explicitly send the original as-is.'); }
    } catch {
      setTranslated('');
      setError('Translation service is offline. Retry translation, or explicitly send the original as-is.');
    } finally { setBusy(false); }
  }

  function send(source: string, target: string, kind = 'text', allowOriginal = false) {
    if (app.settings.lang !== targetLang && source.trim() === target.trim() && !allowOriginal) {
      setError('This reply has not been translated. Translate it first or explicitly send the original as-is.');
      return;
    }
    const id = app.sendCrewReply(seat, source, target, app.settings.lang, targetLang, kind, requestId);
    if (!id) { setError('Reply was not sent. Check the passenger seat and crew connection.'); return; }
    setError('');
    setSentId(id);
    setText('');
    setTranslated('');
  }

  function sendTypedReply() {
    const source = text.trim();
    if (!source) return;
    if (app.settings.lang !== targetLang && !translated) {
      setError('Translate the reply before sending, or choose “Send original as-is” below.');
      return;
    }
    send(source, app.settings.lang === targetLang ? source : translated);
  }

  return <section className="panel reply-composer" aria-label={`Reply to seat ${seat}`}>
    <header><h2>Reply to seat {seat || 'passenger'}</h2>{onClose && <button className="btn btn-ghost" onClick={onClose}>Close</button>}</header>
    <div className="button-row" aria-label="Quick replies">
      {quickReplies.map(phrase => <button className="btn btn-secondary" key={phrase.id} onClick={() => chooseReply(phrase)}>{phrase.text[app.settings.lang]}</button>)}
    </div>
    <label>Message to passenger<textarea rows={2} value={text} onChange={event => {
      setText(event.target.value); setTranslated(''); setSentId(''); setError('');
    }} placeholder="Type a short reply" /></label>
    <button className="btn btn-secondary" disabled={!text.trim() || busy} onClick={previewTranslation}>
      {busy ? 'Translating…' : 'Translate preview'}
    </button>
    {error && <p className="notice" role="status">{error}</p>}
    <div className="translation-pair">
      <article><h3>Crew original</h3><p>{text || 'Your message appears here.'}</p></article>
      <article><h3>Passenger language</h3><p>{translated || 'Translation preview appears here.'}</p></article>
    </div>
    {sentId && <p role="status" aria-live="polite">
      {delivery === 'delivered' ? 'Delivered to passenger device.'
        : delivery === 'not_delivered' ? 'Passenger device is offline. Saved for reconnect; please check on them in person.'
          : 'Sending reply…'}
    </p>}
    <div className="button-row">
      <button className="btn btn-primary" disabled={!text.trim() || app.wsStatus !== 'connected' || (app.settings.lang !== targetLang && !translated)} onClick={sendTypedReply}>Send reply</button>
      {text.trim() && app.settings.lang !== targetLang && <button className="btn btn-ghost" disabled={app.wsStatus !== 'connected'} onClick={() => send(text.trim(), text.trim(), 'text', true)}>Send original as-is</button>}
    </div>
    {text.trim() && app.settings.lang !== targetLang && !translated && <p className="notice" role="note">Replies are translated before sending. Sending the original is an explicit fallback.</p>}
    {app.wsStatus !== 'connected' && <p className="notice" role="status">Crew connection is offline. Reconnect before sending.</p>}
    <details><summary>Reply by voice</summary>
      {LANGUAGES.find(language => language.code === app.settings.lang)?.asr
        ? <VoiceRecorder targetLang={targetLang} onResult={(source, target) => send(source, target, 'speech')} />
        : <p>Voice input is unavailable in this language. Type or choose a quick reply.</p>}
    </details>
  </section>;
}
