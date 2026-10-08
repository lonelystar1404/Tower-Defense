import { ES } from './es';
import { VI } from './vi';
import { ZH } from './zh';

/**
 * Translations. The English text is the key: wrap every player-facing string in `t()`, with
 * `{name}` placeholders for numbers and names (`t('Need {n} more gold.', { n })`). Each other
 * language is a dictionary from that English text to its translation; anything missing falls
 * back to English (and fails `tests/i18n.test.ts`). No DOM: the game logic can use it too.
 */
export type Lang = 'en' | 'es' | 'zh' | 'vi';

export const LANGS: readonly { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'zh', label: '中文' },
  { id: 'vi', label: 'Tiếng Việt' },
];

export const DICTIONARIES: Record<Exclude<Lang, 'en'>, Record<string, string>> = { es: ES, zh: ZH, vi: VI };

const KEY = 'td-lang';
let current: Lang = 'en';

/** `text` in the current language, with `{placeholders}` filled from `params`. */
export function t(text: string, params?: Record<string, string | number>): string {
  const out = current === 'en' ? text : (DICTIONARIES[current][text] ?? text);
  return params ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : out;
}

export function getLang(): Lang {
  return current;
}

/** Switches language (and remembers it in the browser when storage is available). */
export function setLang(lang: Lang, save = true): void {
  current = lang;
  if (!save) return;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/** The saved language, else the browser's if we have it, else English. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGS.some((l) => l.id === saved)) return saved as Lang;
  } catch {
    // Storage blocked
  }
  const browser = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  return LANGS.find((l) => l.id === browser)?.id ?? 'en';
}
