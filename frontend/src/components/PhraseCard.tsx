import type { Phrase, Lang } from '../types';

interface Props {
  phrase: Phrase;
  lang: Lang;
  selected?: boolean;
  onClick?: () => void;
}

export default function PhraseCard({ phrase, lang, selected, onClick }: Props) {
  const text = phrase.text[lang] ?? phrase.text.en;
  const isSafety = phrase.category === 'safety';
  const isUrgent = phrase.priority === 'urgent';

  return (
    <button
      className={`phrase-card ${
        selected ? 'selected' : ''
      } ${isUrgent ? 'urgent' : ''} ${isSafety ? 'safety' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={text}
      title={text}
    >
      <span className="phrase-card-icon" aria-hidden="true">{phrase.icon}</span>
      <span className="phrase-card-text">{text}</span>
      {isSafety && <span className="badge badge-safety" style={{position:'absolute',top:4,right:4,fontSize:'0.6rem'}}>Airline-approved</span>}
      {isUrgent && !isSafety && <span style={{position:'absolute',top:4,right:4,width:8,height:8,borderRadius:'50%',background:'var(--color-urgent)',display:'block'}} />}
    </button>
  );
}
