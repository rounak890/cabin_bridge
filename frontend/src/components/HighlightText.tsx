import type { ReactNode } from 'react';
const WORDS = `not|no|cannot|can't|never|allergy|allergic|don't|didn't|without|アレルギー|ありません|ない|禁止|できません|違います|नहीं|मत|एलर्जी|खतरा|ไม่|ห้าม|แพ้|không|dị ứng|đừng|tidak|alergi|jangan|bukan|hindi|huwag|alerdyi`;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function HighlightText({ text, keywords = [] }: { text: string; keywords?: string[] }): ReactNode {
  const cleanKeywords = keywords.filter(keyword => keyword && keyword.trim().length > 1);
  const extra = cleanKeywords.map(escapeRegExp).join('|');
  const matcher = new RegExp(`(${extra ? `(?:${extra})|` : ''}\\b(?:${WORDS})\\b|アレルギー|ありません|ない|禁止|できません|नहीं|मत|एलर्जी|ไม่|ห้าม|แพ้|không|dị ứng|đừng|अलर्जी|tidak|alergi|jangan|bukan|hindi|huwag|alerdyi|\\d+)`, 'gi');
  const negation = new RegExp(`^(?:${WORDS}|アレルギー|ありません|ない|禁止|できません|नहीं|मत|एलर्जी|ไม่|ห้าม|แพ้|không|dị ứng|đừng|अलर्जी|tidak|alergi|jangan|bukan|hindi|huwag|alerdyi)$`, 'i');
  const keywordSet = new Set(cleanKeywords.map(keyword => keyword.toLowerCase()));
  return text.split(matcher).map((part, i) => {
    if (!part) return part;
    if (keywordSet.has(part.toLowerCase())) return <mark className="highlight-keyword" key={i}>{part}</mark>;
    if (/\d+/.test(part)) return <mark className="highlight-number" key={i}>{part}</mark>;
    if (negation.test(part)) return <mark className="highlight-negation" key={i}>{part}</mark>;
    return part;
  });
}
