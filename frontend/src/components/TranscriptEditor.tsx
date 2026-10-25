import { useState } from 'react';
import type { Lang, TranscribeResponse } from '../types';
import { apiTranslate } from '../api';
import { getLang } from '../languages';
import HighlightText from './HighlightText';

export default function TranscriptEditor({ result, sourceLang, targetLang, onConfirm, onRetry, onCancel, audioUrl }: {
  result: TranscribeResponse; sourceLang: Lang; targetLang: Lang;
  onConfirm: (a: string, b: string, ms: number, edited: boolean) => void;
  onRetry: () => void; onCancel: () => void; audioUrl?: string | null;
}) {
  const [source, setSource] = useState(result.text);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [translateMs, setTranslateMs] = useState(0);
  const needsTranslation = sourceLang !== targetLang;
  const canSend = Boolean(source.trim()) && (!needsTranslation || Boolean(target));

  if (result.confidence_level === 'empty' || source.trim().length < 2) return <div role="alert" className="notice">
    <strong>No clear speech was detected. Please record again or use a phrase card.</strong>
    <div className="button-row"><button className="btn btn-primary" onClick={onRetry}>Record again</button><button className="btn btn-secondary" onClick={onCancel}>Use a card</button></div>
  </div>;

  async function translate() {
    setBusy(true);
    setError('');
    try {
      const r = await apiTranslate(source, sourceLang, targetLang);
      if (r.translated) {
        setTarget(r.translated);
        setTranslateMs(r.processing_ms || 0);
      } else if (r.error === 'translation_model_unavailable') {
        setError('Japanese translation needs the local Ollama model. Start Ollama and try again, or use a phrase card.');
      } else {
        setError('Live translation is unavailable for this pair. Use an approved phrase card for translated wording.');
      }
    } catch {
      setError('Translation service is unavailable. Please try again or use a phrase card.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="panel"><h3>Review and edit what we heard</h3>
    {result.confidence_level === 'low' && <p className="notice" role="status">We are not sure we heard this correctly. Check and edit the transcript before sending.</p>}
    {result.confidence_level === 'medium' && <p className="notice" role="status">Please review the transcript before sending.</p>}
    {audioUrl && <audio controls src={audioUrl} aria-label="Replay recorded audio" />}
    <textarea value={source} onChange={e => { setSource(e.target.value); setTarget(''); setTranslateMs(0); setError(''); }} aria-label="Editable transcript" rows={3} />
    <button className="btn btn-secondary" onClick={translate} disabled={busy || !source.trim()}>{busy ? 'Translating…' : 'Translate'}</button>
    {error && <p role="status">{error}</p>}
    <div className="translation-pair">
      <article><h3>{getLang(sourceLang).nativeName} · Original</h3><p><HighlightText text={source} /></p></article>
      <article><h3>{getLang(targetLang).nativeName} · Translation</h3><p><HighlightText text={target} /></p></article>
    </div>
    {needsTranslation && source.trim() && !target && <p className="notice" role="note">Translate the transcript before sending so the crew can read it.</p>}
    <div className="button-row">
      <button className="btn btn-primary" disabled={!canSend} onClick={() => onConfirm(source.trim(), needsTranslation ? target : source.trim(), translateMs, source.trim() !== result.text.trim())}>Confirm and send</button>
      <button className="btn btn-secondary" onClick={onRetry}>Record again</button>
      <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}
