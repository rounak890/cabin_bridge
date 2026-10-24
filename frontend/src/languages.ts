import type { LanguageInfo, Lang } from './types';

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', asr: true, translate: true, tts: true, phrasebook: true, pivot: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', asr: true, translate: true, tts: true, phrasebook: true, pivot: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', asr: true, translate: true, tts: true, phrasebook: true, pivot: true },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', asr: true, translate: false, tts: true, phrasebook: true, pivot: false },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', asr: true, translate: false, tts: true, phrasebook: true, pivot: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', asr: true, translate: false, tts: true, phrasebook: true, pivot: false },
  { code: 'tl', name: 'Tagalog', nativeName: 'Filipino', asr: true, translate: false, tts: true, phrasebook: true, pivot: false },
];

export const LANG_MAP: Record<Lang, LanguageInfo> = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l])
) as Record<Lang, LanguageInfo>;

export function getLang(code: string): LanguageInfo {
  return LANG_MAP[code as Lang] ?? LANGUAGES[0];
}

export const FLAGS: Record<Lang, string> = {
  en: '🇬🇧', ja: '🇯🇵', hi: '🇮🇳',
  th: '🇹🇭', vi: '🇻🇳', id: '🇮🇩', tl: '🇵🇭',
};
