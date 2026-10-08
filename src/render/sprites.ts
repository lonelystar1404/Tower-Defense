import { ELEMENTS, type ElementId } from '../data/elements';
import type { WeaponId } from '../data/weapons';
import { THEME } from './theme';

/**
 * Vector tower art, cyberpunk style: dark armor with neon trim. Color comes from the element,
 * shape from the weapon type, so both read at a glance. Drawn centered at (x, y) inside a
 * square of `size` pixels.
 *
 * Upgrades show: each level is a bit bigger; level 2 adds an inner neon frame and larger
 * element motifs; level 3 adds a glowing ring around the base and fins on the turret.
 * Levels 2+ show one pip per level along the bottom edge.
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
): void {
  const el = ELEMENTS[element];
  size *= 1 + (level - 1) * 0.08;
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

/** Element motif on the plate: flame chevrons, ice crystals, circuit vines, hazard blocks, or bolts. */
function drawElementAccent(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, element: ElementId, grow: number): void {
  const el = ELEMENTS[element];
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
  const inset = half * 0.7;
  // `grow` enlarges the motifs on upgraded towers; positions stay put.
  const m = half * grow;
  ctx.save();
  switch (element) {
    case 'metal':
      // Chrome bolts in the corners
      for (const [dx, dy] of corners) {
        ctx.beginPath();
        ctx.arc(x + dx * inset, y + dy * inset, m * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = el.accent;
        ctx.fill();
        ctx.strokeStyle = el.dark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + dx * inset - half * 0.06, y + dy * inset);
        ctx.lineTo(x + dx * inset + half * 0.06, y + dy * inset);
        ctx.stroke();
      }
      break;
    case 'fire':
      // Flames in the corners
      for (const [dx, dy] of corners) {
        const fx = x + dx * inset;
        const fy = y + dy * inset + half * 0.08;
        flame(ctx, fx, fy, m * 0.2, el.color);
        flame(ctx, fx, fy, m * 0.1, el.accent);
      }
      break;
    case 'water':
      // Ice crystals in the corners
      ctx.fillStyle = el.accent;
      for (const [dx, dy] of corners) {
        const cx = x + dx * inset;
        const cy = y + dy * inset;
        const r = m * 0.16;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 1.3);
        ctx.lineTo(cx + r * 0.7, cy);
        ctx.lineTo(cx, cy + r * 1.3);
        ctx.lineTo(cx - r * 0.7, cy);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'wood': {
      // Bio-circuit: a vine traced like a circuit board, with glowing nodes
      const r = half * 0.78;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.4);
      ctx.lineTo(x - r * 0.6, y - r);
      ctx.lineTo(x + r * 0.2, y - r);
      ctx.moveTo(x + r, y - r * 0.2);
      ctx.lineTo(x + r, y + r * 0.5);
      ctx.lineTo(x + r * 0.5, y + r);
      ctx.moveTo(x - r * 0.3, y + r);
      ctx.lineTo(x - r, y + r * 0.3);
      neonStroke(ctx, el.color, 1.2 * grow);
      ctx.fillStyle = el.accent;
      for (const [nx, ny] of [[0.2, -1], [0.5, 1], [-1, 0.3], [-1, -0.4]] as const) {
        ctx.beginPath();
        ctx.arc(x + nx * r, y + ny * r, m * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'earth':
      // Hazard-striped corner blocks
      ctx.fillStyle = el.color;
      for (const [dx, dy] of corners) {
        const bx = x + dx * inset;
        const by = y + dy * inset;
        const w = m * 0.28;
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx - w / 2, by - w / 2, w, w);
        ctx.clip();
        for (let i = -2; i <= 2; i++) {
          const o = bx + i * w * 0.5;
          ctx.beginPath();
          ctx.moveTo(o - w, by + w);
          ctx.lineTo(o, by - w);
          ctx.lineTo(o + w * 0.25, by - w);
          ctx.lineTo(o - w * 0.75, by + w);
          ctx.fill();
        }
        ctx.restore();
      }
      break;
  }
  ctx.restore();
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
