import { ELEMENTS, type ElementId } from '../data/elements';
import type { WeaponId } from '../data/weapons';
import { THEME } from './theme';
import { drawEarthTower } from './earthTowers';
import { drawMetalTower } from './metalTowers';
import { drawWaterTower } from './waterTowers';
import { drawWoodTower } from './woodTowers';

/**
 * Vector tower art, cyberpunk style: dark armor with neon trim. Each element has its own set
 * (its own hull silhouette and parts), the weapon type sets the turret, so both read at a
 * glance. Drawn centered at (x, y) inside a square of `size` pixels.
 *
 * Fire is drawn here: a square armor plate with flames in the corners. Water (hexagonal
 * hydro-tech), Wood (bio-tech seed pod on leaves), Earth (octagonal hazard-striped seismic
 * rig), and Metal (chrome gear turntable) live in their own files.
 *
 * Upgrades show: each level is a bit bigger; level 2 adds an inner neon frame and larger
 * element motifs; level 3 adds a glowing ring around the base and fins on the turret.
 * Levels 2+ show one pip per level along the bottom edge.
 *
 * `time` (seconds) animates the other elements' sets; leave it at 0 for still pictures.
 */
export function drawTower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  element: ElementId,
  weapon: WeaponId,
  angle: number,
  recoil = 0,
  level = 1,
  time = 0,
): void {
  const el = ELEMENTS[element];
  size *= 1 + (level - 1) * 0.08;
  if (element === 'water') return drawWaterTower(ctx, x, y, size, weapon, angle, recoil, level, time);
  if (element === 'wood') return drawWoodTower(ctx, x, y, size, weapon, angle, recoil, level, time);
  if (element === 'earth') return drawEarthTower(ctx, x, y, size, weapon, angle, recoil, level, time);
  if (element === 'metal') return drawMetalTower(ctx, x, y, size, weapon, angle, recoil, level, time);
  const half = size * 0.4;

  if (level >= 3) {
    // Glowing ring around the base
    const aura = ctx.createRadialGradient(x, y, half * 0.6, x, y, half * 1.4);
    aura.addColorStop(0, `${el.color}55`);
    aura.addColorStop(1, `${el.color}00`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, half * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, half * 1.22, 0, Math.PI * 2);
    neonStroke(ctx, el.color, 1.2);
  }

  // Armor plate with a beveled inner panel and neon trim (wide faint stroke = glow).
  roundRect(ctx, x - half, y - half, half * 2, half * 2, size * 0.1);
  ctx.fillStyle = THEME.armor;
  ctx.fill();
  neonStroke(ctx, el.color, 1.5);
  const grad = ctx.createLinearGradient(x - half, y - half, x + half, y + half);
  grad.addColorStop(0, THEME.armorLight);
  grad.addColorStop(1, el.dark);
  ctx.fillStyle = grad;
  roundRect(ctx, x - half + 4, y - half + 4, half * 2 - 8, half * 2 - 8, size * 0.06);
  ctx.fill();
  if (level >= 2) {
    ctx.strokeStyle = `${el.color}99`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawElementAccent(ctx, x, y, half, element, 1 + (level - 1) * 0.25);

  if (level >= 2) {
    // Level pips along the bottom edge
    ctx.fillStyle = el.accent;
    for (let i = 0; i < level; i++) {
      ctx.fillRect(x + (i - (level - 1) / 2) * 5 - 1.5, y + half - 3.5, 3, 2);
    }
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawWeapon(ctx, size, weapon, element, recoil, level);
  ctx.restore();
}

/** Strokes the current path as a neon line: a wide faint glow under a thin bright core. */
export function neonStroke(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.save();
  ctx.strokeStyle = color;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * 0.25;
  ctx.lineWidth = width * 4;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** Fire's motif on the plate: flames in the corners (`grow` enlarges them on upgraded towers). */
function drawElementAccent(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, element: ElementId, grow: number): void {
  const el = ELEMENTS[element];
  const inset = half * 0.7;
  const m = half * grow;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const fx = x + dx * inset;
    const fy = y + dy * inset + half * 0.08;
    flame(ctx, fx, fy, m * 0.2, el.color);
    flame(ctx, fx, fy, m * 0.1, el.accent);
  }
}

/** Level 3: a soft glow under the tower, out to 1.4× its half-size. */
export function levelAura(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, color: string): void {
  const aura = ctx.createRadialGradient(x, y, half * 0.6, x, y, half * 1.45);
  aura.addColorStop(0, `${color}55`);
  aura.addColorStop(1, `${color}00`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, half * 1.45, 0, Math.PI * 2);
  ctx.fill();
}

/** Levels 2+: one pip per level, centered on (x, y). */
export function levelPips(ctx: CanvasRenderingContext2D, x: number, y: number, level: number, color: string): void {
  if (level < 2) return;
  ctx.fillStyle = color;
  for (let i = 0; i < level; i++) ctx.fillRect(x + (i - (level - 1) / 2) * 5 - 1.5, y - 1, 3, 2);
}

function drawWeapon(ctx: CanvasRenderingContext2D, size: number, weapon: WeaponId, element: ElementId, recoil: number, level: number): void {
  const el = ELEMENTS[element];
  const kick = recoil * size * 0.08;
  if (level >= 3) {
    // Top piece: swept fins behind the turret
    ctx.fillStyle = el.color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.12, side * size * 0.12);
      ctx.lineTo(-size * 0.36, side * size * 0.3);
      ctx.lineTo(-size * 0.26, side * size * 0.08);
      ctx.closePath();
      ctx.fill();
    }
  }
  // A dark barrel from the turret center outward, with a neon stripe and a glowing muzzle.
  const barrel = (offset: number, len: number, w: number, angle = 0) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = THEME.barrel;
    ctx.fillRect(-kick, offset - w / 2, len, w);
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(-kick + 0.5, offset - w / 2 + 0.5, len - 1, w - 1);
    ctx.fillStyle = el.color;
    ctx.fillRect(-kick + len * 0.3, offset - 0.75, len * 0.55, 1.5);
    ctx.fillStyle = el.accent;
    ctx.fillRect(len - kick - size * 0.05, offset - w / 2, size * 0.05, w);
    ctx.restore();
  };

  switch (weapon) {
    case 'cannon':
      // One thick barrel.
      barrel(0, size * 0.5, size * 0.2);
      break;
    case 'flak':
      // Two thin parallel barrels.
      barrel(-size * 0.09, size * 0.48, size * 0.1);
      barrel(size * 0.09, size * 0.48, size * 0.1);
      break;
    case 'multi':
      // Three barrels fanned out.
      for (const a of [-0.35, 0, 0.35]) barrel(0, size * 0.44, size * 0.09, a);
      break;
    case 'sniper':
      // Very long thin rail.
      barrel(0, size * 0.78, size * 0.08);
      break;
    case 'mortar': {
      // Wide launch tube pointing up: a ring with a dark mouth and a glowing rim.
      const cx = size * 0.04 - kick * 0.5;
      ctx.beginPath();
      ctx.arc(cx, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = THEME.armorLight;
      ctx.fill();
      neonStroke(ctx, el.color, 1.5);
      ctx.beginPath();
      ctx.arc(cx, 0, size * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = '#05060a';
      ctx.fill();
      ctx.strokeStyle = el.accent;
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }
    case 'chain': {
      // Tesla coil: rings around a glowing orb that sparks between targets.
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);
      neonStroke(ctx, el.color, 1.5);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.17, 0, Math.PI * 2);
      ctx.strokeStyle = el.dark;
      ctx.lineWidth = 2;
      ctx.stroke();
      glowDot(ctx, 0, 0, size * (0.2 + recoil * 0.08), el.accent, el.color);
      return;
    }
  }
  // Turret dome with a neon ring and a glowing core
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.19, 0, Math.PI * 2);
  ctx.fillStyle = THEME.armorLight;
  ctx.fill();
  neonStroke(ctx, el.color, 1.5);
  glowDot(ctx, 0, 0, size * (0.08 + level * 0.025), el.accent, el.color);
}

/** A soft glowing dot: white-hot center through `inner`, fading out in `color` (a #rrggbb hex). */
export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, inner);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A small teardrop flame pointing up, centered on its base. */
export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.6);
  ctx.quadraticCurveTo(x + size, y - size * 0.3, x, y + size * 0.5);
  ctx.quadraticCurveTo(x - size, y - size * 0.3, x, y - size * 1.6);
  ctx.fill();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * A hero's figure, centered at (x, y) with body radius `r`, facing `angle`. Each hero has its own
 * silhouette in its signature color: Vex a caped arrow, Brick a bulky frame with big fists,
 * Leila a slim body with a long rifle, Arjun a flickering hologram, Echo a round android.
 */
export function drawHeroSprite(
  ctx: CanvasRenderingContext2D,
  heroId: string,
  color: string,
  x: number,
  y: number,
  r: number,
  angle: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const body = () => {
    ctx.fillStyle = THEME.hull;
    ctx.fill();
    neonStroke(ctx, color, 1.8);
  };
  switch (heroId) {
    case 'mateo':
      // Wide torso and two hydraulic fists out front
      roundRect(ctx, -r * 0.8, -r * 0.75, r * 1.3, r * 1.5, r * 0.3);
      body();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(r * 0.75, side * r * 0.62, r * 0.38, 0, Math.PI * 2);
        body();
      }
      glowDot(ctx, -r * 0.1, 0, r * 0.4, '#ffd2b0', color);
      break;
    case 'leila':
      // Slim body with a long rifle
      ctx.fillStyle = color;
      ctx.fillRect(0, -1.5, r * 2, 3);
      ctx.beginPath();
      ctx.ellipse(-r * 0.15, 0, r * 0.75, r * 0.5, 0, 0, Math.PI * 2);
      body();
      // Ocular implant
      glowDot(ctx, r * 0.25, -r * 0.18, r * 0.28, '#ffe0ef', color);
      break;
    case 'arjun': {
      // Hologram: translucent rings with scanlines, flickering
      ctx.globalAlpha = 0.75 + Math.sin(time * 23) * 0.12;
      for (const k of [1, 0.7]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * k, 0, Math.PI * 2);
        ctx.fillStyle = `${color}22`;
        ctx.fill();
        neonStroke(ctx, color, 1.2);
      }
      ctx.strokeStyle = `${color}88`;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, i * r * 0.3);
        ctx.lineTo(r * 0.8, i * r * 0.3);
        ctx.stroke();
      }
      // Orbiting glyphs
      for (let i = 0; i < 3; i++) {
        const a = time * 2.5 + (i * Math.PI * 2) / 3;
        glowDot(ctx, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, r * 0.22, '#ffffff', color);
      }
      break;
    }
    case 'echo':
      // Round android with an antenna and a visor
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      body();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.6);
      ctx.lineTo(-r * 0.9, -r * 1.2);
      ctx.stroke();
      glowDot(ctx, -r * 0.9, -r * 1.2, r * 0.22, '#ffffff', color);
      ctx.fillStyle = color;
      ctx.fillRect(r * 0.2, -r * 0.35, r * 0.4, r * 0.7);
      break;
    case 'kaito':
      // Slim duelist with a long monoblade held forward
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, r * 0.35);
      ctx.lineTo(r * 1.9, -r * 0.25);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, 0, r * 0.65, r * 0.55, 0, 0, Math.PI * 2);
      body();
      // Visor slit
      ctx.fillStyle = color;
      ctx.fillRect(r * 0.15, -r * 0.3, r * 0.3, r * 0.6);
      break;
    case 'nalani':
      // Round diver with trailing current arcs
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const k = ((time * 0.8 + i / 3) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(-r * (0.6 + k * 0.9), 0, r * (0.5 + k * 0.6), -1.1, 1.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      body();
      glowDot(ctx, r * 0.25, 0, r * 0.35, '#d8f4ff', color);
      break;
    case 'ines':
      // Square exo-frame with a big wrench arm
      roundRect(ctx, -r * 0.75, -r * 0.7, r * 1.35, r * 1.4, r * 0.15);
      body();
      ctx.fillStyle = color;
      ctx.fillRect(r * 0.4, r * 0.3, r * 0.9, r * 0.22);
      ctx.beginPath();
      ctx.arc(r * 1.35, r * 0.41, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // Hex core
      ctx.beginPath();
      for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i / 6) * Math.PI * 2) * r * 0.32 - r * 0.05, Math.sin((i / 6) * Math.PI * 2) * r * 0.32);
      ctx.closePath();
      ctx.fillStyle = '#fff3d6';
      ctx.fill();
      break;
    case 'rua':
      // Round body with three leaf fronds that sway
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.75 + i * 0.25) + Math.sin(time * 2 + i) * 0.12;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(r * 1.05, 0, r * 0.55, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `${color}55`;
        ctx.fill();
        neonStroke(ctx, color, 1);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      body();
      glowDot(ctx, r * 0.2, 0, r * 0.32, '#eaffd0', color);
      break;
    case 'zeynep':
      // Hooded triangle with twin pistols and a hot muzzle glow
      ctx.fillStyle = color;
      for (const side of [-1, 1]) ctx.fillRect(r * 0.3, side * r * 0.42 - 1.5, r * 0.95, 3);
      ctx.beginPath();
      ctx.moveTo(r * 0.75, 0);
      ctx.lineTo(-r * 0.75, r * 0.8);
      ctx.lineTo(-r * 0.75, -r * 0.8);
      ctx.closePath();
      body();
      glowDot(ctx, r * 1.3, Math.sin(time * 9) * r * 0.42, r * 0.18, '#fff0c0', color);
      glowDot(ctx, -r * 0.1, 0, r * 0.3, '#ffd2c4', color);
      break;
    case 'linh': {
      // Hooded diamond that glitches: slices of it jump sideways now and then, a visor of code
      const jitter = Math.sin(time * 37) > 0.85 ? r * 0.18 : 0;
      ctx.beginPath();
      ctx.moveTo(r * 0.95, 0);
      ctx.lineTo(0, r * 0.85);
      ctx.lineTo(-r * 0.8, 0);
      ctx.lineTo(0, -r * 0.85);
      ctx.closePath();
      body();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-r * 0.5 + jitter, -r * 0.35, r * 0.9, 2);
      ctx.fillRect(-r * 0.4 - jitter, r * 0.25, r * 0.7, 2);
      ctx.globalAlpha = 1;
      // Floating holo-keys orbiting
      for (let i = 0; i < 4; i++) {
        const a = time * 1.8 + (i * Math.PI) / 2;
        ctx.fillStyle = `${color}cc`;
        ctx.fillRect(Math.cos(a) * r * 1.35 - 1.5, Math.sin(a) * r * 1.35 - 1.5, 3, 3);
      }
      glowDot(ctx, r * 0.2, 0, r * 0.38, '#ffd0fb', color);
      break;
    }
    case 'baraka':
      // Stocky plated body, a stubby grenade launcher, and a bandolier of blinking charges
      ctx.fillStyle = color;
      ctx.fillRect(r * 0.3, -r * 0.18, r * 0.95, r * 0.36);
      roundRect(ctx, -r * 0.85, -r * 0.8, r * 1.4, r * 1.6, r * 0.25);
      body();
      for (let i = 0; i < 4; i++) {
        const on = Math.floor(time * 3 + i) % 4 === 0;
        glowDot(ctx, -r * 0.55 + i * r * 0.32, -r * 0.45 + i * r * 0.3, r * (on ? 0.2 : 0.12), on ? '#fff0c0' : `${color}`, color);
      }
      glowDot(ctx, r * 1.3, 0, r * 0.18, '#ffd0c0', color);
      break;
    case 'oksana': {
      // Ice-crystal hexagon with a clock hand sweeping around it
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        else ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      }
      ctx.closePath();
      body();
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const hand = -time * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(hand) * r * 1.3, Math.sin(hand) * r * 1.3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      glowDot(ctx, 0, 0, r * 0.42, '#ffffff', color);
      break;
    }
    case 'killa':
      // Round body crowned with three leaf fronds, spores drifting around
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.rotate(i * 0.7 + Math.sin(time * 2) * 0.08);
        ctx.beginPath();
        ctx.moveTo(r * 0.4, 0);
        ctx.quadraticCurveTo(r * 1.1, -r * 0.4, r * 1.45, 0);
        ctx.quadraticCurveTo(r * 1.1, r * 0.4, r * 0.4, 0);
        ctx.fillStyle = `${color}aa`;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      body();
      for (let i = 0; i < 3; i++) {
        const a = -time * 1.4 + (i * Math.PI * 2) / 3;
        glowDot(ctx, Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25, r * 0.16, '#d8fff2', color);
      }
      glowDot(ctx, 0, 0, r * 0.38, '#d8fff2', color);
      break;
    case 'pilar': {
      // Broad frame with a gravity hammer out front, rings orbiting the spine
      ctx.fillStyle = color;
      ctx.fillRect(r * 0.2, -r * 0.08, r * 0.9, r * 0.16);
      roundRect(ctx, r * 0.95, -r * 0.45, r * 0.45, r * 0.9, r * 0.1);
      body();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.6);
      ctx.lineTo(r * 0.5, r * 0.6);
      ctx.lineTo(-r * 0.85, r * 0.9);
      ctx.lineTo(-r * 0.85, -r * 0.9);
      ctx.closePath();
      body();
      for (let k = 0; k < 2; k++) {
        ctx.save();
        ctx.rotate(time * (k ? -0.9 : 1.1));
        ctx.beginPath();
        ctx.ellipse(-r * 0.15, 0, r * 1.2, r * 0.45, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}77`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      glowDot(ctx, -r * 0.15, 0, r * 0.4, '#e2e0ff', color);
      break;
    }
    default:
      // Vex: a caped arrow pointing where she faces
      ctx.beginPath();
      ctx.moveTo(r * 1.1, 0);
      ctx.lineTo(-r * 0.7, r * 0.85);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, -r * 0.85);
      ctx.closePath();
      body();
      glowDot(ctx, r * 0.15, 0, r * 0.45, '#fff6b0', color);
  }
  ctx.restore();
}
