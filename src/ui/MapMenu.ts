import { ENEMIES, type EnemyId } from '../data/enemies';
import { LEVELS, type LevelDef } from '../data/levels';
import { Path } from '../systems/path';
import { isUnlocked, type Progress } from './progress';

/** Enemy types that appear in a map, in order of first appearance. */
export function enemiesIn(level: LevelDef): EnemyId[] {
  const seen: EnemyId[] = [];
  const add = (id: EnemyId) => {
    if (!seen.includes(id)) seen.push(id);
    const a = ENEMIES[id].ability;
    if (a?.kind === 'split') add(a.into);
    if (a?.kind === 'spawn') add(a.child);
  };
  for (const w of level.waves) for (const g of w.groups) add(g.enemy);
  return seen;
}

/** Enemy types a map introduces: not seen in any earlier map. */
export function newEnemiesIn(index: number): EnemyId[] {
  const before = new Set(LEVELS.slice(0, index).flatMap(enemiesIn));
  return enemiesIn(LEVELS[index]).filter((id) => !before.has(id));
}

/** Map select screen. Locked maps show what unlocks them. */
export class MapMenu {
  constructor(
    private readonly root: HTMLElement,
    private readonly onPick: (level: LevelDef) => void,
    private readonly onClose: () => void,
  ) {
    root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-close]')) return this.onClose();
      const card = el.closest<HTMLElement>('[data-level]');
      if (card && !card.classList.contains('locked')) this.onPick(LEVELS[Number(card.dataset.level)]);
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(progress: Progress, canClose: boolean): void {
    const cards = LEVELS.map((level, i) => {
      const unlocked = isUnlocked(LEVELS, i, progress);
      const cleared = progress.cleared.includes(level.id);
      const fresh = new Set(newEnemiesIn(i));
      const roster = enemiesIn(level)
        .map((id) => {
          const def = ENEMIES[id];
          return `<li class="${fresh.has(id) ? 'new' : ''}" title="${def.description}">
            <span class="dot" style="background:${def.color};color:${def.color}"></span>${def.name}${fresh.has(id) && i > 0 ? ' <b>NEW</b>' : ''}</li>`;
        })
        .join('');
      const status = cleared
        ? '<span class="map-status cleared">✓ Cleared</span>'
        : unlocked
          ? '<span class="map-status open">Play</span>'
          : `<span class="map-status locked">🔒 Clear ${LEVELS[i - 1].name} to unlock</span>`;
      return `
        <button class="map-card ${unlocked ? '' : 'locked'}" data-level="${i}" ${unlocked ? '' : 'aria-disabled="true"'}>
          <canvas width="200" height="120" data-preview="${i}"></canvas>
          <div class="map-info">
            <div class="map-title"><span>${i + 1}. ${level.name}</span><span class="map-waves">${level.waves.length} waves</span></div>
            <p>${level.description}</p>
            <ul class="map-roster">${roster}</ul>
            ${status}
          </div>
        </button>`;
    }).join('');
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-head">
          <h2>Select map</h2>
          ${canClose ? '<button data-close>Back to game</button>' : ''}
        </div>
        <div class="map-grid">${cards}</div>
      </div>`;
    this.root.querySelectorAll<HTMLCanvasElement>('[data-preview]').forEach((c) => drawPreview(c, LEVELS[Number(c.dataset.preview)]));
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}

/** Tiny picture of the map's road, obstacles, and core. */
function drawPreview(canvas: HTMLCanvasElement, level: LevelDef): void {
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const w = 200;
  const h = 120;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const s = Math.min(w / level.cols, h / level.rows);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, w, h);
  // Obstacles: grey blocks where nothing can be built
  ctx.fillStyle = '#2a2f45';
  for (const o of level.obstacles ?? []) ctx.fillRect(o.col * s + 0.5, o.row * s + 0.5, (o.w ?? 1) * s - 1, (o.h ?? 1) * s - 1);
  const path = new Path(level.path);
  ctx.beginPath();
  path.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = s * 0.7;
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const end = path.points[path.points.length - 1];
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(end.x * s, end.y * s, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
}
