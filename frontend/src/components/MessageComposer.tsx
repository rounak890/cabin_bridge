import { useState } from 'react';
import type { Lang, MessageKind } from '../types';
import { apiTranslate } from '../api';
import { getLang } from '../languages';
import HighlightText from './HighlightText';

export default function MessageComposer({ sourceLang, targetLang, onSend }: { sourceLang: Lang; targetLang: Lang; onSend: (a: string, b: string, kind: MessageKind, metrics?: { asr_ms: number; translate_ms: number }) => void }) {
  const [text, setText] = useState(''); const [translated, setTranslated] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function preview() {
    const value = text.trim(); if (!value) return;
    setBusy(true); setError('');
    try { const result = await apiTranslate(value, sourceLang, targetLang); if (result.translated) setTranslated(result.translated); else { setTranslated(''); setError('Live translation is unavailable for this pair. The original can still be sent and will remain visible to crew; use an approved phrase card for translated wording.'); } }
    catch { setTranslated(''); setError('Translation service is unavailable. You can send the original text or choose a phrase card.'); }
    finally { setBusy(false); }
  }
  const speak = (value: string, lang: Lang) => { if (!window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(value); u.lang = lang; window.speechSynthesis.speak(u); };
  return <section className="panel">
    <h2>Type a message</h2><textarea aria-label="Message to send" value={text} onChange={e => { setText(e.target.value); setTranslated(''); }} rows={3} placeholder="Type what you need…" />
    <div className="button-row"><button className="btn btn-secondary" disabled={!text.trim() || busy} onClick={preview}>{busy ? 'Translating…' : 'Translate preview'}</button><button className="btn btn-secondary" disabled={!text.trim()} onClick={() => speak(text, sourceLang)}>🔊 Speak source</button></div>
    {error && <p role="status" className="notice">{error}</p>}
    <div className="translation-pair"><article><h3>{getLang(sourceLang).nativeName} · Original</h3><p><HighlightText text={text || 'Your source transcript appears here.'}/></p></article><article><h3>{getLang(targetLang).nativeName} · Translation</h3><p><HighlightText text={translated || 'Translation preview appears here.'}/></p></article></div>
    <button className="btn btn-primary" disabled={!text.trim()} onClick={() => { onSend(text.trim(), translated || text.trim(), 'text'); setText(''); setTranslated(''); }}>Send message</button>
  </section>;
}
