import { getLang } from '../i18n';
/**
 * Cyberpunk palette for things drawn on the canvas that don't change with the battlefield.
 * Ground, pads, grid, and road colors are per battlefield (`src/data/battlefields.ts`);
 * element and enemy colors live in their data files. The page UI uses matching values as
 * CSS variables in `src/style.css`.
 */
export const THEME = {
  /** Lit window colors scattered on pads. */
  windows: ['#ff2bd6', '#00f0ff', '#ffe600'],
  /** Air route line. */
  airLine: 'rgba(255,43,214,0.45)',
  /** Spawn portal and base core. */
  portal: '#ff2bd6',
  core: '#00f0ff',
  /** Tower armor plates. */
  armor: '#151a2c',
  armorLight: '#232a44',
  /** Gun barrels: lighter than the plate so weapon shapes read at a glance. */
  barrel: '#4a5482',
  /** Enemy hull. */
  hull: '#141827',
  /** Placement preview. */
  ok: '0,255,200',
  bad: '255,56,100',
  /** Floating text font. */
  /** Default canvas text font; see `canvasFont` for language-aware stacks. */
  font: "bold 13px 'Share Tech Mono', ui-monospace, monospace",
} as const;

/**
 * Canvas font for the current language: Orbitron ('display') / Share Tech Mono ('mono') for
 * English and Spanish; system fonts for Vietnamese and Chinese, which those fonts can't show.
 */
export function canvasFont(kind: 'display' | 'mono', size: number, weight = 'bold'): string {
  const lang = getLang();
  if (lang === 'zh') return `${weight} ${size}px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif`;
  if (lang === 'vi') return `${weight} ${size}px system-ui, 'Segoe UI', Roboto, Arial, sans-serif`;
  return kind === 'display' ? `${weight} ${size}px 'Orbitron', system-ui, sans-serif` : `${weight} ${size}px 'Share Tech Mono', ui-monospace, monospace`;
}
