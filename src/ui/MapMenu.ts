import { ENEMIES, isBoss, type EnemyId } from '../data/enemies';
import { LEVELS, type LevelDef } from '../data/levels';
import { Path } from '../systems/path';
import { HEROES } from '../data/hero';
import { t } from '../i18n';
import { dailyChallenge } from '../game/daily';
import { isUnlocked, type Progress } from './progress';
import { DAILY_SLOT, dailyBest, loadRun, mapBest } from './saves';
import { memberId } from '../platform/member';

/** Enemy types that appear in a map, in order of first appearance. */
export function enemiesIn(level: LevelDef): EnemyId[] {
  const seen: EnemyId[] = [];
  const add = (id: EnemyId) => {
    if (!seen.includes(id)) seen.push(id);
    const a = ENEMIES[id].ability;
    if (a?.kind === 'split') add(a.into);
    if (a?.kind === 'spawn') add(a.child);
    for (const phase of ENEMIES[id].phases ?? []) for (const action of phase.actions) if (action.kind === 'summon') add(action.enemy);
  };
  for (const w of level.waves) for (const g of w.groups) add(g.enemy);
  return seen;
}

/** Enemy types a map introduces: not seen in any earlier map. */
export function newEnemiesIn(index: number): EnemyId[] {
  const before = new Set(LEVELS.slice(0, index).flatMap(enemiesIn));
  return enemiesIn(LEVELS[index]).filter((id) => !before.has(id));
}

export interface MapMenuActions {
  /**
   * Start a fresh run on `level` (replacing its saved run, if any). Multiplayer maps say which
   * mode: one hero ('single') or a party of 2–5 ('party').
   */
  play(level: LevelDef, mode?: 'single' | 'party'): void;
  /** Continue the run saved on `level`. */
  resume(level: LevelDef): void;
  /** Today's Daily Challenge: continue the saved attempt, or start a new one. */
  daily(resume: boolean): void;
  close(): void;
}

/**
 * Map select screen: the Daily Challenge on top, then one card per map. Locked maps show what
 * unlocks them; maps with a saved run offer Continue and New run.
 */
export class MapMenu {
  constructor(
    private readonly root: HTMLElement,
    private readonly actions: MapMenuActions,
  ) {
    root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-close]')) return this.actions.close();
      if (el.closest('[data-copy-member]')) return copyMemberId(el.closest<HTMLElement>('[data-copy-member]')!);
      if (el.closest('[data-daily]')) return this.actions.daily(el.closest<HTMLElement>('[data-daily]')!.dataset.daily === 'resume');
      const card = el.closest<HTMLElement>('[data-level]');
      if (!card || card.classList.contains('locked')) return;
      const level = LEVELS[Number(card.dataset.level)];
      // The card itself does the main action: continue a saved run, else start one.
      const mode = el.closest<HTMLElement>('[data-mode]')?.dataset.mode as 'single' | 'party' | undefined;
      if (mode) this.actions.play(level, mode);
      else if (el.closest('[data-new]')) this.actions.play(level);
      else if (el.closest('[data-resume]') || card.dataset.saved) this.actions.resume(level);
      else this.actions.play(level);
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  private last: { progress: Progress; canClose: boolean } | null = null;

  /** Redraws the screen if it's open (after a language change). */
  refresh(): void {
    if (this.open && this.last) this.show(this.last.progress, this.last.canClose);
  }

  show(progress: Progress, canClose: boolean): void {
    this.last = { progress, canClose };
    const cards = LEVELS.map((level, i) => {
      const unlocked = isUnlocked(LEVELS, i, progress);
      const cleared = progress.cleared.includes(level.id);
      const fresh = new Set(newEnemiesIn(i));
      const roster = enemiesIn(level)
        .map((id) => {
          const def = ENEMIES[id];
          return `<li class="${fresh.has(id) ? 'new' : ''}" title="${t(def.description)}">
            <span class="dot" style="background:${def.color};color:${def.color}"></span>${t(def.name)}${isBoss(def) ? ` <i>${t('BOSS')}</i>` : ''}${fresh.has(id) && i > 0 ? ` <b>${t('NEW')}</b>` : ''}</li>`;
        })
        .join('');
      const save = unlocked ? loadRun(level.id) : null;
      const status = cleared ? `<span class="map-status cleared">✓ ${t('Cleared')}</span>` : '';
      const best = unlocked ? mapBest(level.id) : null;
      const bestLine = best
        ? `<p class="map-best">🏆 ${t('Best score {score}', { score: best.score.toLocaleString() })} · ${best.won ? t('{n} ♥ left', { n: best.lives }) : t('fell on wave {n}', { n: best.waves + 1 })}${best.hero ? ` · ${best.hero}` : ''}</p>`
        : '';
      const actions = !unlocked
        ? `<span class="map-status locked">🔒 ${t('Clear {map} to unlock', { map: t(LEVELS[i - 1].name) })}</span>`
        : save
          ? `<button class="primary" data-resume>${t('Continue · wave {n}/{total}', { n: save.snapshot.wavesStarted + 1, total: level.waves.length })}</button>
             ${level.multiplayer ? `<button data-mode="single">${t('Single')}</button><button data-mode="party">👥 ${t('Multiplayer')}</button>` : `<button data-new>${t('New run')}</button>`}
             <span class="map-save-lives">${t('{n} ♥ left', { n: save.snapshot.lives })}</span>`
          : level.multiplayer
            ? `<button data-mode="single" title="${t('One hero. This map is built for a party: expect to fall.')}">${t('Single')}</button>
               <button class="primary" data-mode="party">👥 ${t('Multiplayer')}</button>`
            : `<button class="primary" data-new>${t('Play')}</button>`;
      return `
        <div class="map-card ${unlocked ? '' : 'locked'}" data-level="${i}" ${save ? 'data-saved="1"' : ''} ${unlocked ? '' : 'aria-disabled="true"'}>
          <canvas width="200" height="120" data-preview="${i}"></canvas>
          <div class="map-info">
            <div class="map-title"><span>${i + 1}. ${t(level.name)}</span><span class="map-waves">${t('{n} waves', { n: level.waves.length })}</span></div>
            <p>${t(level.description)}</p>
            ${level.heroStart ? `<p class="map-hero">${level.multiplayer ? `👥 ${t('2–5 players, a hero each')}` : level.heroMode === 'random' ? `🎲 ${t('Random hero')}` : `🦸 ${t('Choose your hero')}`}</p>` : ''}
            <ul class="map-roster">${roster}</ul>
            ${bestLine}
            <div class="map-actions">${actions}${status}</div>
          </div>
        </div>`;
    }).join('');
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-head">
          <h2>${t('Select map')}</h2>
          ${canClose ? `<button data-close>${t('Back to game')}</button>` : ''}
        </div>
        ${dailyCard()}
        <div class="map-grid">${cards}</div>
        <footer class="menu-foot">
          <button class="member-id" data-copy-member title="${t('Your player ID for multiplayer. Tap to copy.')}">${t('Member ID')} <b>${memberId()}</b></button>
          <span><a href="privacy.html">${t('Privacy policy')}</a> · <a href="support.html">${t('Support')}</a></span>
        </footer>
      </div>`;
    this.root.querySelectorAll<HTMLCanvasElement>('[data-preview]').forEach((c) => drawPreview(c, LEVELS[Number(c.dataset.preview)]));
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}

/** Copies the MemberId and says so on the button for a moment. */
function copyMemberId(button: HTMLElement): void {
  const label = button.innerHTML;
  navigator.clipboard?.writeText(memberId()).then(
    () => {
      button.innerHTML = `✓ ${t('Copied!')}`;
      setTimeout(() => (button.innerHTML = label), 1200);
    },
    () => {},
  );
}

/** Today's Daily Challenge: map, hero, best score, and Play / Continue. */
function dailyCard(): string {
  const daily = dailyChallenge();
  const save = loadRun(DAILY_SLOT, daily.date);
  const best = dailyBest(daily.date);
  const map = `<b>${t(daily.level.name)}</b>`;
  const buttons = save
    ? `<button class="primary" data-daily="resume">${t('Continue · wave {n}/{total}', { n: save.snapshot.wavesStarted + 1, total: daily.level.waves.length })}</button>
       <button data-daily="new">${t('New attempt')}</button>`
    : `<button class="primary" data-daily="new">${t('Play daily')}</button>`;
  return `
    <div class="daily-card">
      <div>
        <h3>${t('Daily Challenge')} <span>${daily.date}</span></h3>
        <p>${daily.level.heroStart ? t('{map} with {hero}.', { map, hero: HEROES[daily.hero].callsign }) : `${map}.`} ${t('Same battlefields and lockdowns for everyone today: compare scores with friends.')}
        ${best ? t('Your best today: {score}.', { score: `<b class="best">${best.toLocaleString()}</b>` }) : ''}</p>
      </div>
      <div class="daily-actions">${buttons}</div>
    </div>`;
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
