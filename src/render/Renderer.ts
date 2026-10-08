import { weakenedElement, type BattlefieldDef } from '../data/battlefields';
import { MAX_HERO_LEVEL } from '../data/hero';
import type { Hero } from '../entities/Hero';
import { ELEMENTS, type ElementId } from '../data/elements';
import { towerStats, type TowerOption } from '../data/towers';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Tower } from '../entities/Tower';
import type { Game } from '../game/Game';
import type { ObstacleDef } from '../data/levels';
import { seededRng } from '../systems/rng';
import { drawHeroSprite, drawTower, flame, glowDot, neonStroke, roundRect } from './sprites';
import { canvasFont, THEME } from './theme';
import { t as tr } from '../i18n';

/** Pixels per tile. Game logic is in tile units; only the renderer knows about pixels. */
export const TILE = 40;

/** Attack colors per element: `core` is the projectile body, `glow` an "r,g,b" triple for trails. */
const FX: Record<ElementId, { core: string; glow: string }> = {
  fire: { core: '#ffd36b', glow: '255,90,54' },
  water: { core: '#e8fdff', glow: '0,229,255' },
  wood: { core: '#d8ffe6', glow: '57,255,136' },
  earth: { core: '#ffe2a0', glow: '255,176,32' },
  metal: { core: '#ffffff', glow: '201,209,255' },
};

export interface ViewState {
  hover: { col: number; row: number } | null;
  /** Exact pointer position in tile units (for aiming hero abilities). */
  pointer: { x: number; y: number } | null;
  buildChoice: TowerOption | null;
  selected: Tower | null;
  /** The hero is selected (shows its range and lets left-click move it). */
  heroSelected: boolean;
  /** Slot (0–3) of a point ability waiting for a click on the map. */
  aiming: number | null;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  /** Level + battlefield the cached background was drawn for. */
  private backgroundKey = '';
  private dpr = 1;
  /** Battlefield banner: shown for a moment whenever the battlefield changes. */
  private bannerField: BattlefieldDef | null = null;
  private bannerStart = 0;
  /** Boss arrival banner: the boss it's for and when it started. */
  private bossBanner: Enemy | null = null;
  private bossBannerStart = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(game: Game, view: ViewState): void {
    this.ensureSize(game);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (game.effects.some((fx) => fx.kind === 'shake')) {
      ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    }
    ctx.drawImage(this.background!, 0, 0, game.level.cols * TILE, game.level.rows * TILE);
    this.drawCorePulse(game);

    if (view.selected) {
      const s = view.selected;
      this.drawRange(s.x, s.y, s.stats.range, 'rgba(0,240,255,0.07)', 'rgba(0,240,255,0.7)');
    }

    for (const t of game.towers) {
      if (t === view.selected) {
        roundRect(ctx, t.col * TILE + 1, t.row * TILE + 1, TILE - 2, TILE - 2, 6);
        neonStroke(ctx, '#00f0ff', 1.5);
      }
      drawTower(ctx, t.x * TILE, t.y * TILE, TILE, t.element, t.weapon, t.angle, t.recoil, t.level);
      if (t.disabledTime > 0) this.drawOffline(t, game.time);
      else if (game.isLocked(t)) {
        // Encrypted this wave: no upgrades
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.85;
        ctx.fillText('🔒', (t.col + 1) * TILE - 2, t.row * TILE + 10);
        ctx.globalAlpha = 1;
      }
    }

    this.drawZones(game);
    this.drawSummons(game);
    for (const e of game.enemies) if (e.movement === 'ground') this.drawEnemy(e, game.time);
    for (const p of game.projectiles) if (p.homing) this.drawProjectile(p);
    for (const e of game.enemies) if (e.movement === 'air') this.drawEnemy(e, game.time);
    for (const p of game.projectiles) if (!p.homing) this.drawShell(p);
    if (game.hero) this.drawHero(game.hero, game.time, view.heroSelected);
    this.drawStrikes(game);
    this.drawEffects(game);
    this.drawHover(game, view);
    this.drawAim(game, view);
    this.drawBossBar(game);
    this.drawBanner(game);
  }

  /** Big HP bar for the boss on the map, with phase marks and its shield; a banner when it arrives. */
  private drawBossBar(game: Game): void {
    const boss = game.enemies.find((e) => e.alive && e.def.phases);
    if (!boss) return;
    const ctx = this.ctx;
    const def = boss.def;
    const mapW = game.level.cols * TILE;
    const now = performance.now();
    if (this.bossBanner !== boss) {
      this.bossBanner = boss;
      this.bossBannerStart = now;
    }

    const w = Math.min(420, mapW * 0.6);
    const x = (mapW - w) / 2;
    const y = 26;
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,11,0.8)';
    roundRect(ctx, x - 10, y - 20, w + 20, 40, 6);
    ctx.fill();
    neonStroke(ctx, hexAlpha(def.color, 0.8), 1.2);
    ctx.font = canvasFont('display', 11, '800');
    ctx.textAlign = 'left';
    ctx.fillStyle = def.color;
    ctx.fillText(`${tr('BOSS')} · ${tr(def.name).toUpperCase()}`, x, y - 5);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    const phaseText = boss.phase > 0 ? `${tr('PHASE {n}', { n: boss.phase + 1 })} · ` : '';
    ctx.fillText(`${phaseText}${Math.ceil((boss.hp / boss.maxHp) * 100)}%`, x + w, y - 5);
    // HP bar with a mark at each phase threshold
    const frac = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = def.color;
    ctx.fillRect(x, y, w * frac, 8);
    if (boss.shield > 0 && boss.maxShield > 0) {
      ctx.fillStyle = 'rgba(77,210,255,0.85)';
      ctx.fillRect(x, y + 9, w * (boss.shield / boss.maxShield), 3);
    }
    ctx.fillStyle = '#ffffff';
    def.phases!.forEach((p, i) => {
      ctx.globalAlpha = i < boss.phase ? 0.3 : 0.9;
      ctx.fillRect(x + w * p.at - 1, y - 2, 2, 12);
    });
    ctx.restore();

    // Arrival banner
    const t = (now - this.bossBannerStart) / 1000;
    const DURATION = 3;
    if (t > DURATION) return;
    const by = game.level.rows * TILE * 0.42;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 4, (DURATION - t) * 1.5);
    ctx.fillStyle = 'rgba(5,6,11,0.85)';
    ctx.fillRect(0, by - 36, mapW, 72);
    ctx.fillStyle = def.color;
    ctx.fillRect(0, by - 36, mapW, 2);
    ctx.fillRect(0, by + 34, mapW, 2);
    ctx.textAlign = 'center';
    ctx.font = canvasFont('display', 26, '800');
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`⚠ ${tr('BOSS')}: ${tr(def.name).toUpperCase()}`, mapW / 2, by + 2);
    ctx.shadowBlur = 0;
    ctx.font = canvasFont('mono', 13);
    ctx.fillStyle = def.color;
    ctx.fillText(tr(def.description), mapW / 2, by + 24);
    ctx.restore();
  }

  /** A tower knocked out by a Disruptor: dimmed, with crackling sparks and its seconds left. */
  private drawOffline(t: Tower, time: number): void {
    const ctx = this.ctx;
    const x = t.col * TILE;
    const y = t.row * TILE;
    ctx.save();
    roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 5);
    ctx.fillStyle = 'rgba(5,8,20,0.6)';
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const rng = seededRng(Math.floor(time * 20) + t.id * 31);
    ctx.strokeStyle = 'rgba(143,180,255,0.85)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      let px = x + 6 + rng() * (TILE - 12);
      let py = y + 6;
      ctx.moveTo(px, py);
      for (let i = 0; i < 4; i++) {
        px = Math.min(x + TILE - 4, Math.max(x + 4, px + (rng() - 0.5) * 14));
        py += (TILE - 12) / 4;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = canvasFont('mono', 9);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fb4ff';
    ctx.fillText(`${tr('OFF')} ${t.disabledTime.toFixed(1)}`, x + TILE / 2, y + TILE - 4);
    ctx.restore();
  }

  /** Cryo Fields: frosty circles that fade out. */
  private drawZones(game: Game): void {
    const ctx = this.ctx;
    for (const z of game.zones) {
      const t = z.ttl / z.maxTtl;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.beginPath();
      ctx.arc(z.x * TILE, z.y * TILE, z.radius * TILE, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(z.color, 0.14);
      ctx.fill();
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -game.time * 20;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Remaining time: a draining arc on the rim and the seconds in the middle
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(z.x * TILE, z.y * TILE, z.radius * TILE + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      const icon = z.slow ? '❄' : z.armorBreak ? '⬡' : '🔥';
      countdownLabel(ctx, z.x * TILE, z.y * TILE, `${icon} ${z.ttl.toFixed(1)}s`, z.color);
      ctx.restore();
    }
  }

  /** Orbital Strike markers: a shrinking target ring until impact. */
  private drawStrikes(game: Game): void {
    const ctx = this.ctx;
    for (const s of game.strikes) {
      const r = s.radius * TILE;
      ctx.save();
      ctx.strokeStyle = '#ff5a36';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x * TILE, s.y * TILE, r * (0.4 + 0.6 * s.delay), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x * TILE, s.y * TILE, r, 0, Math.PI * 2);
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(s.x * TILE - r, s.y * TILE);
      ctx.lineTo(s.x * TILE + r, s.y * TILE);
      ctx.moveTo(s.x * TILE, s.y * TILE - r);
      ctx.lineTo(s.x * TILE, s.y * TILE + r);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Above the target ring, or below it when that would leave the map
      const labelY = s.y * TILE - r - 10 >= 10 ? s.y * TILE - r - 10 : s.y * TILE + r + 12;
      countdownLabel(ctx, s.x * TILE, labelY, `${tr('IMPACT')} ${Math.max(0, s.delay).toFixed(1)}`, '#ff5a36');
      ctx.restore();
    }
  }

  /** The hero: its figure, a level badge, an XP ring, and (when selected) its attack range. */
  private drawHero(hero: Hero, time: number, selected: boolean): void {
    const ctx = this.ctx;
    const x = hero.x * TILE;
    const y = hero.y * TILE;
    const r = TILE * 0.3;
    const color = hero.def.color;
    // Passive aura (Undertow, Field Engineer, Bounty): a faint turning ring at its reach
    const passive = hero.def.passive?.effect;
    if (passive && 'radius' in passive) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, passive.radius * TILE, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(color, 0.035);
      ctx.fill();
      ctx.setLineDash([2, 7]);
      ctx.lineDashOffset = -time * 12;
      ctx.strokeStyle = hexAlpha(color, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    if (selected) {
      this.drawRange(hero.x, hero.y, hero.def.attack.range, hexAlpha(color, 0.05), hexAlpha(color, 0.6));
    }
    if (hero.moving) {
      // Move marker
      ctx.save();
      ctx.strokeStyle = hexAlpha(color, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hero.targetX * TILE, hero.targetY * TILE, 6 + Math.sin(time * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Aura and XP ring
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, x, y, r * 2.2, color, color);
    ctx.restore();
    const next = hero.killsForNextLevel;
    const frac = next === null ? 1 : (hero.kills - hero.killsForThisLevel) / (next - hero.killsForThisLevel);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.75, 0, Math.PI * 2);
      neonStroke(ctx, '#ffffff', 1);
    }
    drawHeroSprite(ctx, hero.def.id, color, x, y, r, hero.angle, time);

    // Countdown rings for timed self effects (stuns from self blasts, buffs, Time Lock)
    let ring = 0;
    for (let slot = 0; slot < 4; slot++) {
      const ab = hero.ability(slot);
      const k = ab.effect.kind;
      const timed = (k === 'blast' && ab.target === 'self' && ab.effect.stun) || k === 'buff' || k === 'freeze-all';
      if (!timed || hero.effects[slot] <= 0) continue;
      const rr = r * (2.1 + ring * 0.45);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (hero.effects[slot] / hero.effectLengths[slot]));
      ctx.strokeStyle = '#4dd2ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#4dd2ff';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
      countdownLabel(ctx, x, y + rr + 10 + ring * 12, `${tr(ab.name)} ${hero.effects[slot].toFixed(1)}s`, '#4dd2ff');
      ring++;
    }
    // Jammed: crackling static
    if (hero.jammed) {
      ctx.save();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = time * 13 + i * 1.7;
        ctx.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2);
        ctx.lineTo(x + Math.cos(a + 0.4) * r * 1.9, y + Math.sin(a + 0.4) * r * 1.9);
      }
      ctx.stroke();
      ctx.restore();
    }
    // Level badge
    ctx.save();
    ctx.font = canvasFont('display', 10, '800');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#05060b';
    roundRect(ctx, x - 9, y - r - 17, 18, 12, 3);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(hero.level >= MAX_HERO_LEVEL ? tr('MAX') : String(hero.level), x, y - r - 7.5);
    ctx.restore();
  }

  /** Echo's drones with a ring showing time left; marked enemies; overclocked towers. */
  private drawSummons(game: Game): void {
    const ctx = this.ctx;
    const color = game.hero?.def.color ?? '#5dffb1';
    for (const d of game.summons) {
      const x = d.x * TILE;
      const y = d.y * TILE;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(game.time * 3);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      }
      ctx.closePath();
      ctx.fillStyle = THEME.hull;
      ctx.fill();
      neonStroke(ctx, color, 1.5);
      ctx.restore();
      glowDot(ctx, x, y, 5, '#ffffff', color);
      ctx.beginPath();
      ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (d.ttl / d.maxTtl));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const e of game.enemies) {
      if (e.markTime <= 0) continue;
      // Red target reticle over marked enemies
      const x = e.x * TILE;
      const y = e.y * TILE - (e.movement === 'air' ? TILE * 0.35 : 0);
      const rr = e.def.radius * TILE + 6;
      ctx.save();
      ctx.strokeStyle = '#ff3864';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        ctx.moveTo(x + dx * (rr - 3), y + dy * (rr - 3));
        ctx.lineTo(x + dx * (rr + 4), y + dy * (rr + 4));
      }
      ctx.stroke();
      ctx.restore();
    }
    for (const t of game.towers) {
      if (t.boostTime <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x * TILE, t.y * TILE, TILE * 0.55, 0, Math.PI * 2);
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -game.time * 30;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** While aiming a hero ability: its reach around the hero and its area (or line) at the pointer. */
  private drawAim(game: Game, view: ViewState): void {
    const hero = game.hero;
    if (!hero || view.aiming === null) return;
    const def = hero.ability(view.aiming);
    const ctx = this.ctx;
    const color = hero.def.color;
    if (Number.isFinite(def.castRange)) {
      this.drawRange(hero.x, hero.y, def.castRange, hexAlpha(color, 0.04), hexAlpha(color, 0.5));
    }
    if (!view.pointer) return;
    const ok = Math.hypot(view.pointer.x - hero.x, view.pointer.y - hero.y) <= def.castRange;
    ctx.save();
    ctx.strokeStyle = ok ? color : '#ff3864';
    ctx.fillStyle = ok ? hexAlpha(color, 0.15) : 'rgba(255,56,100,0.15)';
    ctx.lineWidth = 2;
    if (def.effect.kind === 'pierce') {
      // A line from the hero through the pointer
      const len = Math.hypot(view.pointer.x - hero.x, view.pointer.y - hero.y) || 1;
      const ex = hero.x + ((view.pointer.x - hero.x) / len) * def.effect.length;
      const ey = hero.y + ((view.pointer.y - hero.y) / len) * def.effect.length;
      ctx.lineWidth = def.effect.width * 2 * TILE;
      ctx.strokeStyle = hexAlpha(color, 0.25);
      ctx.beginPath();
      ctx.moveTo(hero.x * TILE, hero.y * TILE);
      ctx.lineTo(ex * TILE, ey * TILE);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(view.pointer.x * TILE, view.pointer.y * TILE, def.aimRadius * TILE, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** "BATTLEFIELD: MARS" title card, fading out over a few seconds after each change. */
  private drawBanner(game: Game): void {
    const now = performance.now();
    if (this.bannerField !== game.battlefield) {
      this.bannerField = game.battlefield;
      this.bannerStart = now;
    }
    const t = (now - this.bannerStart) / 1000;
    const DURATION = 2.8;
    if (t > DURATION) return;
    const field = game.battlefield;
    const el = ELEMENTS[field.element];
    const weak = ELEMENTS[weakenedElement(field)];
    const w = game.level.cols * TILE;
    const y = game.level.rows * TILE * 0.42;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 4, (DURATION - t) * 1.5);
    const band = ctx.createLinearGradient(0, 0, w, 0);
    band.addColorStop(0, 'rgba(5,6,11,0)');
    band.addColorStop(0.2, 'rgba(5,6,11,0.85)');
    band.addColorStop(0.8, 'rgba(5,6,11,0.85)');
    band.addColorStop(1, 'rgba(5,6,11,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 36, w, 72);
    ctx.fillStyle = el.color;
    ctx.fillRect(w * 0.2, y - 36, w * 0.6, 1.5);
    ctx.fillRect(w * 0.2, y + 34.5, w * 0.6, 1.5);
    ctx.textAlign = 'center';
    ctx.font = canvasFont('display', 26, '800');
    ctx.shadowColor = el.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tr('BATTLEFIELD: {name}', { name: tr(field.name).toUpperCase() }), w / 2, y + 2);
    ctx.shadowBlur = 0;
    ctx.font = canvasFont('mono', 13);
    ctx.fillStyle = el.color;
    ctx.fillText(`${el.icon} ${tr(el.name)} +${pct(game.battlefieldBonus)}`, w / 2 - 70, y + 24);
    ctx.fillStyle = weak.color;
    ctx.fillText(`${weak.icon} ${tr(weak.name)} −${pct(game.battlefieldBonus)}`, w / 2 + 70, y + 24);
    ctx.restore();
  }

  private ensureSize(game: Game): void {
    const w = game.level.cols * TILE;
    const h = game.level.rows * TILE;
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.dpr = dpr;
      this.background = null;
    }
    const key = `${game.level.id}:${game.battlefield.id}`;
    if (!this.background || this.backgroundKey !== key) {
      this.background = buildBackground(game, dpr);
      this.backgroundKey = key;
    }
  }

  /** The base core breathes; it flickers faster as lives run low. */
  private drawCorePulse(game: Game): void {
    const end = game.path.points[game.path.points.length - 1];
    const danger = 1 - game.lives / game.level.lives;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * (2 + danger * 10));
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + pulse * 0.35;
    glowDot(ctx, end.x * TILE, end.y * TILE, TILE * 0.75, danger > 0.5 ? '#ff3864' : '#00f0ff', danger > 0.5 ? '#ff3864' : '#00f0ff');
    ctx.restore();
  }

  private drawRange(x: number, y: number, range: number, fill: string, stroke: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x * TILE, y * TILE, range * TILE, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Robots: dark hull, neon trim, a glowing visor facing where they move. */
  private drawEnemy(e: Enemy, time: number): void {
    const ctx = this.ctx;
    if (e.burrowed) return this.drawBurrowed(e, time);
    ctx.save();
    if (e.def.ability?.kind === 'fortify') {
      // Warden aura: a faint ring showing who it protects.
      ctx.beginPath();
      ctx.arc(e.x * TILE, e.y * TILE, e.def.ability.radius * TILE, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(e.def.color, 0.04);
      ctx.fill();
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = hexAlpha(e.def.color, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Hidden Ghosts are faint and flicker; revealed ones are solid.
    if (e.def.ability?.kind === 'stealth') ctx.globalAlpha = e.hidden ? 0.28 + Math.sin(time * 9 + e.id) * 0.08 : 0.95;
    this.drawEnemyBody(e, time);
    ctx.restore();
  }

  /** An underground Burrower: a moving dirt mound with a ripple, no body or bars. */
  private drawBurrowed(e: Enemy, time: number): void {
    const ctx = this.ctx;
    const x = e.x * TILE;
    const y = e.y * TILE;
    const r = e.def.radius * TILE;
    ctx.save();
    const ripple = (time * 2 + e.id * 0.37) % 1;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * (0.9 + ripple), r * (0.4 + ripple * 0.45), 0, 0, Math.PI * 2);
    ctx.strokeStyle = hexAlpha(e.def.color, 0.5 * (1 - ripple));
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.85, r * 0.45, 0, Math.PI, 0);
    ctx.fillStyle = '#2a1d12';
    ctx.fill();
    neonStroke(ctx, hexAlpha(e.def.color, 0.7), 1);
    const rng = seededRng(Math.floor(time * 12) + e.id);
    ctx.fillStyle = hexAlpha(e.def.color, 0.6);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + (rng() - 0.5) * r * 2, y - rng() * r * 0.6, 2, 2);
    ctx.restore();
  }

  private drawEnemyBody(e: Enemy, time: number): void {
    const ctx = this.ctx;
    const air = e.movement === 'air';
    const color = e.def.color;
    // Flyers bob above their shadow.
    const lift = air ? TILE * (0.35 + Math.sin(time * 4 + e.id) * 0.05) : 0;
    const x = e.x * TILE;
    const gy = e.y * TILE;
    const y = gy - lift;
    // Scale up tougher (higher HP multiplier) enemies a little.
    const boss = e.def.phases !== undefined;
    const r = e.def.radius * TILE * (boss ? 1.1 : Math.min(1.5, 1 + (e.maxHp / e.def.hp - 1) * 0.12));
    const angle = Math.atan2(e.dirY, e.dirX);

    // Ground units hover on a neon underglow; flyers cast a dark shadow.
    ctx.beginPath();
    ctx.ellipse(x, gy + r * 0.8, r * (air ? 0.7 : 1), r * (air ? 0.25 : 0.35), 0, 0, Math.PI * 2);
    ctx.fillStyle = air ? 'rgba(0,0,0,0.45)' : hexAlpha(color, 0.22);
    ctx.fill();

    if (e.element) {
      // Element ring: a slowly turning dashed halo in the enemy's element color
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r * 1.45 + (air ? 2 : 0), time * 1.5, time * 1.5 + Math.PI * 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ELEMENTS[e.element].color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (e.def.id === 'drone') {
      // Quad-rotor: four spinning rotors on arms.
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const rx = dx * r * 0.85;
        const ry = dy * r * 0.85;
        ctx.strokeStyle = THEME.armorLight;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rx, ry, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(color, 0.12);
        ctx.fill();
        const spin = time * 40 + dx * 3 + dy;
        ctx.strokeStyle = hexAlpha(color, 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(spin) * r * 0.42, ry + Math.sin(spin) * r * 0.42);
        ctx.lineTo(rx - Math.cos(spin) * r * 0.42, ry - Math.sin(spin) * r * 0.42);
        ctx.stroke();
      }
    } else if (e.def.id === 'carrier') {
      // Carrier: a long hull with side hangars and blinking launch lights.
      ctx.fillStyle = THEME.hull;
      for (const side of [-1, 1]) {
        roundRect(ctx, -r * 0.9, side * r * 0.75 - r * 0.25, r * 1.6, r * 0.5, r * 0.15);
        ctx.fill();
        neonStroke(ctx, color, 1);
        ctx.fillStyle = Math.sin(time * 6 + side) > 0 ? color : THEME.hull;
        ctx.fillRect(r * 0.5, side * r * 0.75 - 2, 4, 4);
        ctx.fillStyle = THEME.hull;
      }
    } else if (e.def.id === 'wyvern') {
      // Gunship: swept mechanical wings that beat slowly.
      const beat = Math.sin(time * 6 + e.id) * 0.5 + 0.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.2, side * r * 0.3);
        ctx.lineTo(-r * 0.9, side * r * (1.3 + beat * 0.6));
        ctx.lineTo(-r * 0.5, side * r * 0.4);
        ctx.closePath();
        ctx.fillStyle = THEME.hull;
        ctx.fill();
        neonStroke(ctx, color, 1.2);
      }
    }

    if (boss) {
      // Boss: a slowly turning ring of runes, faster once enraged.
      const spin = time * (e.speedMult > 1 ? 2.4 : 0.8);
      ctx.strokeStyle = hexAlpha(color, 0.55);
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + spin;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.3, a, a + 0.42);
        ctx.stroke();
      }
      if (e.def.id === 'leviathan') {
        // Long swept wings
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(r * 0.5, side * r * 0.4);
          ctx.lineTo(-r * 0.7, side * r * 1.6);
          ctx.lineTo(-r * 1.1, side * r * 1.5);
          ctx.lineTo(-r * 0.6, side * r * 0.4);
          ctx.closePath();
          ctx.fillStyle = THEME.hull;
          ctx.fill();
          neonStroke(ctx, color, 1.4);
        }
      } else if (e.def.id === 'colossus') {
        // Shoulder cannons
        ctx.fillStyle = THEME.armorLight;
        for (const side of [-1, 1]) ctx.fillRect(r * 0.2, side * r * 0.8 - r * 0.15, r * 1.05, r * 0.3);
      } else if (e.def.id === 'chimera') {
        // Spines that ripple
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.sin(time * 3 + i) * 0.15;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
          ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
          ctx.stroke();
        }
      }
    }

    // Hull
    if (e.def.id === 'disruptor') {
      // Tesla prongs around a round core, turning
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time * 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
        ctx.stroke();
      }
    } else if (e.def.id === 'burrower') {
      // Drill nose
      ctx.beginPath();
      ctx.moveTo(r * 1.55, 0);
      ctx.lineTo(r * 0.6, r * 0.55);
      ctx.lineTo(r * 0.6, -r * 0.55);
      ctx.closePath();
      ctx.fillStyle = THEME.armorLight;
      ctx.fill();
      neonStroke(ctx, color, 1);
      const turn = (time * 8) % 1;
      ctx.strokeStyle = hexAlpha(color, 0.7);
      ctx.beginPath();
      for (const k of [0.25, 0.6]) {
        const px = r * (0.6 + ((k + turn) % 1) * 0.9);
        const half = r * 0.55 * (1 - (px - r * 0.6) / (r * 0.95));
        ctx.moveTo(px, -half);
        ctx.lineTo(px, half);
      }
      ctx.stroke();
    }
    if (e.def.id === 'brute' || e.def.id === 'warden') {
      roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.35);
    } else if (e.def.id === 'phaser') {
      // Diamond that stretches when it's about to blink
      const charge = e.def.ability?.kind === 'blink' ? 1 - Math.max(0, e.abilityTimer) / e.def.ability.interval : 0;
      ctx.beginPath();
      ctx.moveTo(r * (1.2 + charge * 0.4), 0);
      ctx.lineTo(0, r * 0.85);
      ctx.lineTo(-r * 1.1, 0);
      ctx.lineTo(0, -r * 0.85);
      ctx.closePath();
    } else if (e.def.id === 'splitter') {
      // Three fused pods
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        ctx.moveTo(Math.cos(a) * r * 0.45 + r * 0.6, Math.sin(a) * r * 0.45);
        ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.6, 0, Math.PI * 2);
      }
    } else if (e.def.id === 'shard') {
      ctx.beginPath();
      ctx.moveTo(r * 1.3, 0);
      ctx.lineTo(-r, r * 0.8);
      ctx.lineTo(-r * 0.6, 0);
      ctx.lineTo(-r, -r * 0.8);
      ctx.closePath();
    } else if (e.def.id === 'carrier') {
      roundRect(ctx, -r * 1.1, -r * 0.55, r * 2.2, r * 1.1, r * 0.3);
    } else if (e.def.id === 'prism') {
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0);
      ctx.lineTo(-r * 0.75, r * 0.95);
      ctx.lineTo(-r * 0.75, -r * 0.95);
      ctx.closePath();
    } else if (e.def.id === 'burrower') {
      roundRect(ctx, -r, -r * 0.7, r * 1.6, r * 1.4, r * 0.3);
    } else if (e.def.id === 'mirror') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      }
      ctx.closePath();
    } else if (e.def.id === 'colossus' || e.def.id === 'chimera') {
      // Octagon (Colossus) or pentagon (Chimera)
      const sides = e.def.id === 'colossus' ? 8 : 5;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      }
      ctx.closePath();
    } else if (e.def.id === 'bulwark') {
      roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.5);
    } else if (e.def.id === 'leviathan') {
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(r * 0.4, r * 0.6);
      ctx.lineTo(-r * 1.2, r * 0.45);
      ctx.lineTo(-r * 1.2, -r * 0.45);
      ctx.lineTo(r * 0.4, -r * 0.6);
      ctx.closePath();
    } else if (e.def.id === 'swarm') {
      ctx.beginPath();
      ctx.moveTo(r * 1.1, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = THEME.hull;
    ctx.fill();
    neonStroke(ctx, color, 1.5);

    if (e.def.id === 'mirror') {
      // Chrome shine streak
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.65, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    if (e.def.id === 'jammer') {
      // Antenna arcs that pulse
      const pulse = (time * 2 + e.id * 0.3) % 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (const k of [0.6, 1]) {
        ctx.globalAlpha = 1 - pulse * k;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.2 + pulse * 0.8 * k), -0.7, 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (e.def.id === 'prism' && e.element) {
      // Inner facet glowing in its current element
      ctx.beginPath();
      ctx.moveTo(r * 0.6, 0);
      ctx.lineTo(-r * 0.4, r * 0.48);
      ctx.lineTo(-r * 0.4, -r * 0.48);
      ctx.closePath();
      ctx.fillStyle = hexAlpha(ELEMENTS[e.element].color, 0.75);
      ctx.fill();
    }
    if (e.def.id === 'warden') {
      // Shield crest
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.45);
      ctx.lineTo(-r * 0.6, -r * 0.3);
      ctx.lineTo(-r * 0.6, r * 0.1);
      ctx.lineTo(-r * 0.15, r * 0.5);
      ctx.closePath();
      ctx.fillStyle = hexAlpha(color, 0.7);
      ctx.fill();
    }
    if (e.def.id === 'disruptor') {
      // Charge glow that brightens as the next pulse nears
      const a = e.def.ability;
      const charge = a?.kind === 'disrupt' ? 1 - e.abilityTimer / a.interval : 0;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(color, 0.25 + charge * 0.65);
      ctx.fill();
    }
    if (boss) {
      // Glowing core in its current element (or its own color), pulsing
      const core = e.element ? ELEMENTS[e.element].color : color;
      ctx.beginPath();
      ctx.arc(-r * 0.15, 0, r * (0.32 + Math.sin(time * 4) * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(core, 0.85);
      ctx.fill();
      if (e.def.id === 'bulwark') {
        // Front plate
        ctx.fillStyle = THEME.armorLight;
        ctx.fillRect(r * 0.55, -r * 0.8, r * 0.3, r * 1.6);
      }
    }
    if (e.def.id === 'medic') {
      // Medical cross
      ctx.fillStyle = color;
      ctx.fillRect(-r * 0.12, -r * 0.5, r * 0.24, r * 1);
      ctx.fillRect(-r * 0.5, -r * 0.12, r * 1, r * 0.24);
    }

    if (e.def.armor >= 4) {
      // Armor plating seams
      ctx.strokeStyle = hexAlpha(color, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.55);
      ctx.lineTo(-r * 0.6, r * 0.55);
      ctx.moveTo(-r * 0.2, -r * 0.7);
      ctx.lineTo(-r * 0.2, r * 0.7);
      ctx.stroke();
    }

    if (r > TILE * 0.1) {
      // Visor
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, r * 0.28);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth *= 2.2;
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.45);
      ctx.lineTo(r * 0.45, r * 0.45);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, r * 0.28);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    if (e.def.id === 'runner') {
      // Light trails behind it.
      ctx.strokeStyle = hexAlpha(color, 0.6);
      ctx.lineWidth = 1.5;
      for (const o of [-0.45, 0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo(-r * 1.2, r * o);
        ctx.lineTo(-r * 2.3, r * o);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (e.bonusArmor > 0) {
      // Fortified by a Warden: green armor brackets
      ctx.save();
      ctx.strokeStyle = hexAlpha('#c0ff3d', 0.8);
      ctx.lineWidth = 1.5;
      const br = r * 1.3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * br * 0.6, y - br);
        ctx.lineTo(x + side * br, y - br * 0.6);
        ctx.lineTo(x + side * br, y + br * 0.6);
        ctx.lineTo(x + side * br * 0.6, y + br);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (e.shield > 0) {
      // Hexagonal energy shield
      const sr = r * 1.55;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + time * 0.6;
        ctx.lineTo(x + Math.cos(a) * sr, y + Math.sin(a) * sr);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(77,210,255,${0.08 + 0.12 * (e.shield / e.maxShield)})`;
      ctx.fill();
      neonStroke(ctx, '#4dd2ff', 1.2);
    }

    this.drawStatus(e, x, y, gy, r, time);

    const w = Math.max(TILE * 0.35, r * 2.4);
    const bx = x - w / 2;
    const by = y - r - (air ? 12 : 8) - (e.shield > 0 ? 4 : 0);
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(bx - 1, by - 1, w + 2, 5);
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#00f0ff' : frac > 0.25 ? '#ffe600' : '#ff3864';
      ctx.fillRect(bx, by, w * frac, 3);
    }
    if (e.shield > 0 && e.shield < e.maxShield) {
      // Shield bar just under the HP bar
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(bx - 1, by + 4, w + 2, 4);
      ctx.fillStyle = '#4dd2ff';
      ctx.fillRect(bx, by + 5, w * (e.shield / e.maxShield), 2);
    }
  }

  /** Status-effect overlays: chill tint, ice block, flames, poison, vines, stun stars, cracks. */
  private drawStatus(e: Enemy, x: number, y: number, groundY: number, r: number, time: number): void {
    const ctx = this.ctx;
    const s = e.status;

    if (s.armorBreak > 0) {
      ctx.strokeStyle = 'rgba(255,176,32,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const cracks = Math.ceil(s.armorBreak / 4);
      for (let i = 0; i < cracks; i++) {
        const a = e.id * 1.3 + i * 2.1;
        ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
        ctx.lineTo(x + Math.cos(a + 0.3) * r * 0.45, y + Math.sin(a + 0.3) * r * 0.45);
        ctx.lineTo(x + Math.cos(a - 0.2) * r * 0.2, y + Math.sin(a - 0.2) * r * 0.2);
      }
      ctx.stroke();
    }

    if (s.chillTime > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,229,255,0.35)';
      ctx.fill();
    }

    if (s.freezeTime > 0) {
      const b = r * 1.35;
      roundRect(ctx, x - b, y - b, b * 2, b * 2, 4);
      ctx.fillStyle = 'rgba(160,240,255,0.4)';
      ctx.fill();
      neonStroke(ctx, '#c8fbff', 1.2);
      ctx.beginPath();
      ctx.moveTo(x - b * 0.6, y - b * 0.2);
      ctx.lineTo(x - b * 0.2, y - b * 0.6);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    if (s.rootTime > 0) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * r * 1.1, groundY + r * 0.9);
        ctx.quadraticCurveTo(x + side * r * 1.4, y, x + side * r * 0.3, y - r * 0.2);
        neonStroke(ctx, '#39ff88', 1.5);
      }
    }

    if (s.burnTime > 0) {
      for (let i = 0; i < 3; i++) {
        const flick = Math.sin(time * 14 + i * 2 + e.id) * 0.25 + 1;
        const fx = x + (i - 1) * r * 0.55;
        const fy = y - r * 0.55;
        flame(ctx, fx, fy, r * 0.32 * flick, 'rgba(255,90,54,0.9)');
        flame(ctx, fx, fy, r * 0.17 * flick, 'rgba(255,211,107,0.95)');
      }
    }

    if (s.poisonStacks > 0) {
      ctx.fillStyle = 'rgba(57,255,136,0.9)';
      for (let i = 0; i < s.poisonStacks; i++) {
        const phase = (time * 0.8 + i / s.poisonStacks + e.id * 0.37) % 1;
        const bx = x + Math.sin(i * 2.4 + e.id) * r * 0.8;
        const by = y + r * 0.3 - phase * r * 1.8;
        ctx.beginPath();
        ctx.arc(bx, by, 1.2 + (1 - phase) * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (s.stunTime > 0) {
      ctx.fillStyle = '#ffe600';
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        star(ctx, x + Math.cos(a) * r * 0.9, y - r * 1.15 + Math.sin(a) * r * 0.3, 3);
      }
    }
  }

  private drawProjectile(p: Projectile): void {
    const ctx = this.ctx;
    const px = p.x * TILE;
    const py = p.y * TILE;
    const weapon = p.source.weapon;
    const element = p.source.element;
    const { core, glow } = FX[element];
    const tail = TILE * (weapon === 'sniper' ? 1.4 : weapon === 'cannon' ? 0.35 : 0.5);
    const width = weapon === 'sniper' ? 2 : weapon === 'cannon' ? 4 : 2.5;
    const r = weapon === 'cannon' ? 4.5 : weapon === 'sniper' ? 2.5 : 3;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(px - p.dirX * tail, py - p.dirY * tail, px, py);
    grad.addColorStop(0, `rgba(${glow},0)`);
    grad.addColorStop(1, `rgba(${glow},0.95)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - p.dirX * tail, py - p.dirY * tail);
    ctx.lineTo(px, py);
    ctx.stroke();
    // Glow halo
    ctx.beginPath();
    ctx.arc(px, py, r * (element === 'fire' ? 2.6 : 2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${glow},0.3)`;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    if (element === 'water') {
      // Ice shard pointing where it flies
      ctx.moveTo(px + p.dirX * r * 2, py + p.dirY * r * 2);
      ctx.lineTo(px - p.dirY * r, py + p.dirX * r);
      ctx.lineTo(px - p.dirX * r, py - p.dirY * r);
      ctx.lineTo(px + p.dirY * r, py - p.dirX * r);
      ctx.closePath();
    } else if (element === 'earth') {
      // Angular rock
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const rr = r * (i % 2 ? 1 : 1.35);
        ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      }
      ctx.closePath();
    } else {
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = core;
    ctx.fill();
  }

  /** Mortar shell: flies in an arc, with a shadow and a target marker on the ground. */
  private drawShell(p: Projectile): void {
    const ctx = this.ctx;
    const t = p.progress;
    const height = Math.sin(Math.PI * t) * TILE * 1.2;
    const { core, glow } = FX[p.source.element];
    ctx.beginPath();
    ctx.arc(p.tx * TILE, p.ty * TILE, p.splashRadius * TILE, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${glow},${0.2 + 0.5 * t})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(p.x * TILE, p.y * TILE, 4, 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x * TILE, p.y * TILE - height, 5, 0, Math.PI * 2);
    ctx.fillStyle = THEME.armorLight;
    ctx.fill();
    neonStroke(ctx, core, 1.5);
  }

  private drawEffects(game: Game): void {
    const ctx = this.ctx;
    for (const fx of game.effects) {
      const t = fx.ttl / fx.maxTtl;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.5);
      switch (fx.kind) {
        case 'shake':
          break;
        case 'pulse': {
          ctx.beginPath();
          ctx.arc(fx.x * TILE, fx.y * TILE, fx.radius * TILE * (1 - t * 0.6), 0, Math.PI * 2);
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }
        case 'spark':
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.arc(fx.x * TILE, fx.y * TILE, (1 - t) * TILE * 0.35 + 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgb(${FX[fx.element].glow})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        case 'blast': {
          ctx.globalCompositeOperation = 'lighter';
          const r = fx.radius * TILE * (0.5 + 0.5 * (1 - t));
          const grad = ctx.createRadialGradient(fx.x * TILE, fx.y * TILE, 0, fx.x * TILE, fx.y * TILE, r);
          const glow = fx.color ? hexRgb(fx.color) : FX[fx.element].glow;
          grad.addColorStop(0, 'rgba(255,255,255,0.9)');
          grad.addColorStop(0.45, `rgba(${glow},0.65)`);
          grad.addColorStop(1, `rgba(${glow},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(fx.x * TILE, fx.y * TILE, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(fx.x * TILE, fx.y * TILE, fx.radius * TILE * (1 - t * 0.3), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${glow},0.8)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          break;
        }
        case 'beam': {
          // Jagged arc between each pair of points.
          ctx.globalCompositeOperation = 'lighter';
          const rng = seededRng(Math.floor(fx.ttl * 60));
          const { core, glow } = fx.color ? { core: '#ffffff', glow: hexRgb(fx.color) } : FX[fx.element];
          for (const [width, color] of [[6, `rgba(${glow},0.45)`], [2, fx.color || core]] as const) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineJoin = 'round';
            ctx.moveTo(fx.points[0].x * TILE, fx.points[0].y * TILE);
            for (let i = 1; i < fx.points.length; i++) {
              const a = fx.points[i - 1];
              const b = fx.points[i];
              for (let k = 1; k <= 4; k++) {
                const f = k / 4;
                const jitter = k === 4 ? 0 : (rng() - 0.5) * TILE * 0.3;
                ctx.lineTo((a.x + (b.x - a.x) * f) * TILE + jitter, (a.y + (b.y - a.y) * f) * TILE + jitter);
              }
            }
            ctx.stroke();
          }
          break;
        }
        case 'text':
          ctx.font = canvasFont('mono', 13);
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.strokeText(fx.text, fx.x * TILE, fx.y * TILE);
          ctx.fillStyle = fx.color;
          ctx.fillText(fx.text, fx.x * TILE, fx.y * TILE);
          break;
      }
      ctx.restore();
    }
  }

  private drawHover(game: Game, view: ViewState): void {
    const { hover, buildChoice } = view;
    if (!hover || view.aiming || !game.inBounds(hover.col, hover.row)) return;
    const ctx = this.ctx;
    if (!buildChoice) {
      if (game.towerAt(hover.col, hover.row)) {
        ctx.strokeStyle = 'rgba(0,240,255,0.5)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, hover.col * TILE + 1, hover.row * TILE + 1, TILE - 2, TILE - 2, 6);
        ctx.stroke();
      }
      return;
    }
    const ok = game.canBuild(hover.col, hover.row) && !game.isLocked(buildChoice);
    const rgb = ok ? THEME.ok : THEME.bad;
    const cx = hover.col + 0.5;
    const cy = hover.row + 0.5;
    this.drawRange(cx, cy, towerStats(buildChoice).range, `rgba(${rgb},0.08)`, `rgba(${rgb},0.75)`);
    ctx.globalAlpha = ok ? 0.8 : 0.35;
    drawTower(ctx, cx * TILE, cy * TILE, TILE, buildChoice.element, buildChoice.weapon, -Math.PI / 2);
    ctx.globalAlpha = 1;
    if (!ok) {
      ctx.fillStyle = `rgba(${rgb},0.3)`;
      ctx.fillRect(hover.col * TILE, hover.row * TILE, TILE, TILE);
    }
  }
}

/** City blocks, neon road, spawn portal and data core, in the battlefield's palette. */
function buildBackground(game: Game, dpr: number): HTMLCanvasElement {
  const pal = game.battlefield.palette;
  const { cols, rows } = game.level;
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE * dpr;
  canvas.height = rows * TILE * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const rng = seededRng(7);
  const w = cols * TILE;
  const h = rows * TILE;

  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 0, w, h);

  // Buildable pads (rooftops), some with lit windows or vents
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (game.isPath(c, r) || game.isObstacle(c, r)) continue;
      const x = c * TILE;
      const y = r * TILE;
      roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 3);
      ctx.fillStyle = pal.pad;
      ctx.fill();
      ctx.strokeStyle = pal.padEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
      const roll = rng();
      if (roll < 0.16) {
        drawDecor(ctx, game.battlefield, x + TILE / 2, y + TILE / 2, rng);
      } else if (roll < 0.3) {
        const color = THEME.windows[Math.floor(rng() * THEME.windows.length)];
        ctx.fillStyle = hexAlpha(color, 0.55);
        const n = 2 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) {
          ctx.fillRect(x + 7 + Math.floor(rng() * 6) * 4.5, y + 7 + Math.floor(rng() * 6) * 4.5, 2.5, 2.5);
        }
      } else if (roll < 0.38) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(x + 10 + rng() * 8, y + 10 + rng() * 8, 8, 8);
      }
    }
  }

  // Faint city grid
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(c * TILE + 0.5, 0);
    ctx.lineTo(c * TILE + 0.5, h);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(0, r * TILE + 0.5);
    ctx.lineTo(w, r * TILE + 0.5);
  }
  ctx.stroke();

  // Obstacles: blocked tiles nobody can build on
  for (const o of game.level.obstacles ?? []) drawObstacle(ctx, o, pal.roadEdge, rng);

  // Neon road: outer glow, bright edges, dark asphalt, magenta center line
  const pts = game.path.points.map((p) => ({ x: p.x * TILE, y: p.y * TILE }));
  const roadPath = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  };
  ctx.lineJoin = 'miter';
  roadPath();
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = pal.roadEdge;
  ctx.lineWidth = TILE + 10;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = pal.roadEdge;
  ctx.lineWidth = TILE;
  ctx.stroke();
  ctx.strokeStyle = pal.road;
  ctx.lineWidth = TILE - 4;
  ctx.stroke();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = pal.roadCenter;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // Air route
  const air = game.airPath.points;
  ctx.beginPath();
  ctx.moveTo(air[0].x * TILE, air[0].y * TILE);
  for (const p of air.slice(1)) ctx.lineTo(p.x * TILE, p.y * TILE);
  ctx.setLineDash([2, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = THEME.airLine;
  ctx.stroke();
  ctx.setLineDash([]);

  // Spawn: magenta portal where the road enters the map
  // The path's first point is off the map; the portal sits on the edge it crosses, facing inward.
  const first = game.path.points[0];
  const px = Math.min(Math.max(first.x, 0), cols) * TILE;
  const py = Math.min(Math.max(first.y, 0), rows) * TILE;
  const facing = first.x < 0 ? 0 : first.x > cols ? Math.PI : first.y < 0 ? Math.PI / 2 : -Math.PI / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, px, py, TILE * 0.9, THEME.portal, THEME.portal);
  ctx.restore();
  for (const [rw, rh] of [[0.45, 0.62], [0.3, 0.45]] as const) {
    ctx.beginPath();
    ctx.ellipse(px, py, TILE * rw, TILE * rh, facing, -Math.PI / 2, Math.PI / 2);
    neonStroke(ctx, THEME.portal, 1.5);
  }

  // Base: data core on the last road tile
  const end = game.path.points[game.path.points.length - 1];
  drawCore(ctx, end.x * TILE, end.y * TILE);
  return canvas;
}

/** A building, canal, or wreck covering its tiles; `accent` is the battlefield's neon. */
function drawObstacle(ctx: CanvasRenderingContext2D, o: ObstacleDef, accent: string, rng: () => number): void {
  const x = o.col * TILE;
  const y = o.row * TILE;
  const w = (o.w ?? 1) * TILE;
  const h = (o.h ?? 1) * TILE;
  ctx.save();
  if (o.kind === 'tower') {
    // Skyscraper seen from above: a shadow, a dark roof with a raised rim, lit windows, an antenna.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + 5, y + 7, w - 4, h - 4);
    roundRect(ctx, x + 2, y + 2, w - 6, h - 6, 3);
    ctx.fillStyle = '#0b0d18';
    ctx.fill();
    neonStroke(ctx, hexAlpha(accent, 0.55), 1.2);
    roundRect(ctx, x + 7, y + 7, w - 16, h - 16, 2);
    ctx.fillStyle = '#121626';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let wy = y + 11; wy < y + h - 12; wy += 6) {
      for (let wx = x + 11; wx < x + w - 12; wx += 6) {
        if (rng() < 0.32) {
          ctx.fillStyle = hexAlpha(THEME.windows[Math.floor(rng() * THEME.windows.length)], 0.5);
          ctx.fillRect(wx, wy, 2.5, 2.5);
        }
      }
    }
    const ax = x + w - 12;
    const ay = y + 12;
    ctx.strokeStyle = THEME.barrel;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax - 4, ay + 4);
    ctx.lineTo(ax + 3, ay - 3);
    ctx.stroke();
    glowDot(ctx, ax + 3, ay - 3, 3, '#ff3864', '#ff3864');
  } else if (o.kind === 'canal') {
    // Coolant canal: dark glowing liquid between concrete lips, with ripples.
    ctx.fillStyle = '#05121a';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(0,229,255,0.18)');
    g.addColorStop(0.5, 'rgba(0,229,255,0.06)');
    g.addColorStop(1, 'rgba(0,229,255,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.strokeStyle = 'rgba(0,229,255,0.35)';
    ctx.lineWidth = 1;
    const n = Math.max(2, Math.round((w * h) / (TILE * TILE)) * 2);
    for (let i = 0; i < n; i++) {
      const cx = x + 8 + rng() * (w - 16);
      const cy = y + 8 + rng() * (h - 16);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy);
      ctx.quadraticCurveTo(cx - 3, cy - 3, cx, cy);
      ctx.quadraticCurveTo(cx + 3, cy + 3, cx + 6, cy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(160,180,210,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  } else {
    // Wreckage: broken slabs inside a hazard-striped barrier.
    ctx.fillStyle = '#0c0b10';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    const slabs = Math.max(3, Math.round((w * h) / (TILE * TILE)) * 3);
    for (let i = 0; i < slabs; i++) {
      const cx = x + 8 + rng() * (w - 16);
      const cy = y + 8 + rng() * (h - 16);
      const s = 4 + rng() * 6;
      const a = rng() * Math.PI;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const ang = a + (k / 4) * Math.PI * 2 + (rng() - 0.5) * 0.6;
        const rr = s * (0.6 + rng() * 0.5);
        ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = rng() < 0.5 ? '#1c1f30' : '#262a3c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,230,0,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineDashOffset = 6;
    ctx.strokeStyle = 'rgba(10,10,14,0.9)';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Small battlefield-themed decoration centered on a pad. */
function drawDecor(ctx: CanvasRenderingContext2D, field: BattlefieldDef, cx: number, cy: number, rng: () => number): void {
  ctx.save();
  ctx.strokeStyle = field.palette.decor;
  ctx.fillStyle = field.palette.decor;
  ctx.lineWidth = 1.5;
  const s = TILE * (0.22 + rng() * 0.1);
  switch (field.id) {
    case 'mars':
      // Crater
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + s * 0.2, cy + s * 0.2, s * 0.55, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
      break;
    case 'ocean':
      // Waves
      for (const dy of [-s * 0.4, s * 0.4]) {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const px = cx - s + (i / 12) * s * 2;
          const py = cy + dy + Math.sin((i / 12) * Math.PI * 3) * s * 0.18;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    case 'jungle':
      // Leaves on a stem
      ctx.beginPath();
      ctx.moveTo(cx - s, cy + s);
      ctx.quadraticCurveTo(cx, cy, cx + s * 0.8, cy - s);
      ctx.stroke();
      for (const t of [0.3, 0.6]) {
        ctx.beginPath();
        ctx.ellipse(cx - s + t * s * 1.8, cy + s - t * s * 2, s * 0.35, s * 0.15, -0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'canyon':
      // Rock crack
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s * 0.6);
      ctx.lineTo(cx - s * 0.2, cy - s * 0.1);
      ctx.lineTo(cx - s * 0.4, cy + s * 0.5);
      ctx.lineTo(cx + s * 0.6, cy + s);
      ctx.moveTo(cx - s * 0.2, cy - s * 0.1);
      ctx.lineTo(cx + s * 0.7, cy - s * 0.4);
      ctx.stroke();
      break;
    case 'factory':
      // Gear
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6);
        ctx.lineTo(cx + Math.cos(a) * s * 0.9, cy + Math.sin(a) * s * 0.9);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Hexagonal data core with a glowing center. */
function drawCore(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const r = TILE * 0.46;
  const hex = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    ctx.closePath();
  };
  hex(r);
  ctx.fillStyle = THEME.armor;
  ctx.fill();
  neonStroke(ctx, THEME.core, 2);
  hex(r * 0.62);
  ctx.strokeStyle = 'rgba(0,240,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  glowDot(ctx, x, y, r * 0.5, '#bff9ff', THEME.core);
}

/** "#rrggbb" → "r,g,b". */
function hexRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

/** "#rrggbb" plus alpha → "rgba(...)". */
function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Small countdown text with a dark outline, centered at (x, y). */
function countdownLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  ctx.save();
  ctx.font = canvasFont('mono', 13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
