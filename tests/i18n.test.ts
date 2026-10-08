import { describe, expect, it } from 'vitest';
import { DICTIONARIES, getLang, setLang, t } from '../src/i18n';
import { allKeys, codeKeys } from './i18nKeys';

const keys = allKeys();
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Translations', () => {
  it('finds the keys in t() calls, including both sides of a ternary', () => {
    expect(codeKeys(`t('A'); tr("B's", { n }); t(x ? 'C' : 'D'); t(\`skip\`); t(f('E'))`)).toEqual(['A', "B's", 'C', 'D', 'E']);
    expect(keys.length).toBeGreaterThan(400);
  });

  for (const [lang, dict] of Object.entries(DICTIONARIES)) {
    it(`${lang}: has every key, with the same placeholders`, () => {
      const missing = keys.filter((k) => !(k in dict));
      expect(missing, `${missing.length} missing`).toEqual([]);
      const broken = keys.filter((k) => placeholders(k).join() !== placeholders(dict[k]).join());
      expect(broken).toEqual([]);
    });

    it(`${lang}: has no stale keys`, () => {
      const known = new Set(keys);
      expect(Object.keys(dict).filter((k) => !known.has(k))).toEqual([]);
    });
  }

  it('fills placeholders and falls back to English', () => {
    const before = getLang();
    setLang('es', false);
    expect(t('Need {n} more gold.', { n: 5 })).toContain('5');
    expect(t('not a key {n}', { n: 1 })).toBe('not a key 1');
    setLang(before, false);
  });
});
