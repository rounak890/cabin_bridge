import { useRef, useState } from 'react';
import type { Lang, MessageKind } from '../types';
import { apiTranslate } from '../api';
import { getLang, LANGUAGES } from '../languages';
import HighlightText from './HighlightText';

export default function MessageComposer({ sourceLang, targetLang, onSend, onTargetLangChange }: {
  sourceLang: Lang; targetLang: Lang;
  onSend: (a: string, b: string, kind: MessageKind, metrics?: { asr_ms: number; translate_ms: number }) => void;
  onTargetLangChange?: (lang: Lang) => void;
}) {
  const [text, setText] = useState('');
  const [translated, setTranslated] = useState('');
  const [translatedFor, setTranslatedFor] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const needsTranslation = sourceLang !== targetLang;
  // Japanese is entered through an IME. During composition React state can lag
  // behind the textarea, so read the DOM value for the actual action.
  const currentText = () => (textareaRef.current?.value ?? text).trim();
  const valueNow = currentText();
  const translationReady = !needsTranslation || (Boolean(translated) && translatedFor === valueNow);
  const canSend = Boolean(valueNow) && translationReady;

  function resetTranslation() {
    setTranslated('');
    setTranslatedFor('');
    setError('');
  }

  async function preview() {
    const value = currentText();
    if (!value) return;
    if (value !== text) setText(value);
    setBusy(true);
    setError('');
    try {
      const result = await apiTranslate(value, sourceLang, targetLang);
      if (result.translated) {
        setTranslated(result.translated);
        setTranslatedFor(value);
      } else if (result.error === 'translation_model_unavailable') {
        setTranslated('');
        setError('Japanese translation needs the local Ollama model. Start Ollama and try again, or use a phrase card.');
      } else {
        setTranslated('');
        setError('Live translation is unavailable for this pair. Use a phrase card for translated wording.');
      }
    } catch {
      setTranslated('');
      setError('Translation service is unavailable. Please try again or use a phrase card.');
    } finally {
      setBusy(false);
    }
  }

  const speak = (value: string, lang: Lang) => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(value);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  };

  return <section className="panel">
    <h2>Type a message</h2>
    <div className="compose-target">
      <span>Translate for crew</span>
      {onTargetLangChange
        ? <select value={targetLang} onChange={e => { onTargetLangChange(e.target.value as Lang); resetTranslation(); }}>
            {LANGUAGES.filter(language => language.translate).map(language =>
              <option key={language.code} value={language.code}>{language.nativeName}</option>)}
          </select>
        : <strong>{getLang(targetLang).nativeName}</strong>}
    </div>
    <textarea
      ref={textareaRef}
      aria-label="Message to send"
      value={text}
      onChange={e => { setText(e.target.value); resetTranslation(); }}
      onCompositionEnd={e => setText(e.currentTarget.value)}
      onBlur={e => setText(e.currentTarget.value)}
      rows={3}
      placeholder="Type what you need…"
    />
    <div className="button-row">
      <button className="btn btn-secondary" disabled={busy} onClick={preview}>{busy ? 'Translating…' : 'Translate preview'}</button>
      <button className="btn btn-secondary" disabled={!valueNow} onClick={() => speak(currentText(), sourceLang)}>🔊 Speak source</button>
    </div>
    {error && <p role="status" className="notice">{error}</p>}
    <div className="translation-pair">
      <article><h3>{getLang(sourceLang).nativeName} · Original</h3><p><HighlightText text={valueNow || 'Your source transcript appears here.'} /></p></article>
      <article><h3>{getLang(targetLang).nativeName} · Translation</h3><p><HighlightText text={translationReady ? translated : 'Translation preview appears here.'} /></p></article>
    </div>
    {needsTranslation && valueNow && !translationReady && <p className="notice" role="note">Translate the message before sending so the crew can read it.</p>}
    <button className="btn btn-primary" disabled={!canSend} onClick={() => {
      onSend(valueNow, needsTranslation ? translated : valueNow, 'text');
      setText('');
      resetTranslation();
    }}>Send message</button>
  </section>;
}
