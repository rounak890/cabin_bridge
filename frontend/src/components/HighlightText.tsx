import type { ReactNode } from 'react';
const WORDS = `not|no|cannot|can't|never|allergy|allergic|don't|didn't|without|アレルギー|ありません|ない|禁止|できません|違います|नहीं|मत|एलर्जी|खतरा|ไม่|ห้าม|แพ้|không|dị ứng|đừng|tidak|alergi|jangan|bukan|hindi|huwag|alerdyi`;
export default function HighlightText({ text }: { text: string }): ReactNode {
  const matcher = new RegExp(`(\\b(?:${WORDS})\\b|アレルギー|ありません|ない|禁止|できません|नहीं|मत|एलर्जी|ไม่|ห้าม|แพ้|không|dị ứng|đừng|अलर्जी|tidak|alergi|jangan|bukan|hindi|huwag|alerdyi|\\d+)`, 'gi');
  const negation = new RegExp(`^(?:${WORDS}|アレルギー|ありません|ない|禁止|できません|नहीं|मत|एलर्जी|ไม่|ห้าม|แพ้|không|dị ứng|đừng|अलर्जी|tidak|alergi|jangan|bukan|hindi|huwag|alerdyi)$`, 'i');
  return text.split(matcher).map((part,i)=>/\d+/.test(part)?<mark className="highlight-number" key={i}>{part}</mark>:negation.test(part)?<mark className="highlight-negation" key={i}>{part}</mark>:part);
}
