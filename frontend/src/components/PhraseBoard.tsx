import { useMemo, useState } from 'react';
import type { Lang, Phrase } from '../types';
import PhraseCard from './PhraseCard';
import catalog from '../../../shared/approved_phrases.json';

const phrases = (catalog as { phrases: Phrase[] }).phrases;
const categories = ['quick', 'all', 'service', 'assistance', 'medical', 'navigation'];
export default function PhraseBoard({ lang, targetLang = 'en', simple = false, ttsSpeed = 1, onSend }: { lang: Lang; targetLang?: Lang; simple?: boolean; ttsSpeed?: number; onSend: (source: string, translated: string, kind: 'card' | 'safety') => void }) {
  const [category, setCategory] = useState('quick');
  const [selected, setSelected] = useState<Phrase[]>([]);
  const visible = useMemo(() => {
    const simpleIds = new Set(['p001','p002','p003','p004','p007','p009']);
    const quickIds = new Set(['p001','p002','p003','p004','p006','p007','p014','p018']);
    return phrases.filter(p => p.category !== 'safety' && p.priority !== 'urgent' && (simple ? simpleIds.has(p.id) : category === 'quick' ? quickIds.has(p.id) : category === 'all' || p.category === category));
  }, [category, simple]);
  const toggle = (p: Phrase) => setSelected(prev => {
    if (prev.some(x => x.id === p.id)) return prev.filter(x => x.id !== p.id);
    if (p.category === 'safety' || prev.some(x => x.category === 'safety')) return [p];
    return prev.length < 3 ? [...prev, p] : prev;
  });
  function send() {
    if (!selected.length) return;
    const source = selected.map(p => p.text[lang] || p.text.en).join(' ');
    const translated = selected.map(p => p.text[targetLang] || p.text.en).join(' ');
    const safety = selected.some(p => p.category === 'safety');
    onSend(source, translated, safety ? 'safety' : 'card');
    setSelected([]);
  }
  return <section className="panel">
    <h2>Phrase board</h2>
    {!simple&&<div className="category-row">{categories.map(c => <button key={c} className={`btn btn-secondary ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>}
    {selected.length > 0 && <div className="compose-preview" style={{position:'sticky',top:0,zIndex:5,background:'var(--color-surface)',padding:'var(--space-3)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)'}}><strong>Selected ({selected.length}/3)</strong><div className="translation-pair"><article><h3>{lang} · Original</h3><p>{selected.map(p => p.text[lang] || p.text.en).join(' ')}</p></article><article><h3>{targetLang} · Translation</h3><p>{selected.map(p => p.text[targetLang] || p.text.en).join(' ')}</p></article></div>
      {selected.some(p => p.category === 'safety') && <span className="badge badge-safety">Airline-approved</span>}
      {selected.some(p => p.category === 'medical') && <p className="notice">Communication assistance, not medical advice.</p>}
      <button className="btn btn-secondary" disabled={!selected.length||!window.speechSynthesis} onClick={()=>{const u=new SpeechSynthesisUtterance(selected.map(p=>p.text[lang]||p.text.en).join(' '));u.lang=lang;u.rate=ttsSpeed;window.speechSynthesis.speak(u);}}>🔊 Play preview</button>
      <button className="btn btn-primary" disabled={!selected.length} onClick={send}>Send phrase</button></div>}
    <div className="phrase-grid">{visible.map(p => <PhraseCard key={p.id} phrase={p} lang={lang} selected={selected.some(s => s.id === p.id)} onClick={() => toggle(p)} />)}</div>
  </section>;
}
