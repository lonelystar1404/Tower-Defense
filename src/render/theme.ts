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
  font: "bold 13px 'Share Tech Mono', ui-monospace, monospace",
} as const;
