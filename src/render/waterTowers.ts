import { ELEMENTS } from '../data/elements';
import type { WeaponId } from '../data/weapons';
import { glowDot, neonStroke } from './sprites';
import { THEME } from './theme';

/**
 * Water towers have their own look: cyberpunk hydro-tech instead of the shared armor plate.
 * A hexagonal pressure hull with a glass coolant window (glowing liquid that sloshes, with
 * rising bubbles; the coolant level rises with each upgrade), pipes and valves on the rim, an
 * impeller pump at the center, and a water-specific nozzle per weapon: Hydro Ram (cannon),
 * twin mist jets (flak), spray manifold (multi), cryo lance with coil rings (sniper), depth
 * canister (mortar), and a tide orb with orbiting droplets (chain).
 *
 * Same footprint, rotation, recoil, and upgrade cues (size, pips, level-3 aura) as every other
 * tower, so only the art differs. `time` (seconds) drives the animation; 0 draws a still frame.
 */
export function drawWaterTower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  weapon: WeaponId,
  angle: number,
  recoil: number,
  level: number,
  time: number,
): void {
  const el = ELEMENTS.water;
  const half = size * 0.4;
  const R = half * 1.08;

  if (level >= 3) {
    // Glow under the hull and a slowly turning dashed hex ring
    const aura = ctx.createRadialGradient(x, y, half * 0.6, x, y, half * 1.45);
    aura.addColorStop(0, `${el.color}55`);
    aura.addColorStop(1, `${el.color}00`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, half * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = -time * 6;
    hexPath(ctx, x, y, R * 1.2, Math.PI / 6);
    neonStroke(ctx, el.color, 1);
    ctx.restore();
  }

  // Hull: a flat-topped hexagon of dark armor with neon trim.
  hexPath(ctx, x, y, R, 0);
  ctx.fillStyle = THEME.armor;
  ctx.fill();
  neonStroke(ctx, el.color, 1.5);

  // Coolant window: inner hexagon of glass, liquid filling it from the bottom.
  const r = R * 0.74;
  ctx.save();
  hexPath(ctx, x, y, r, 0);
  ctx.clip();
  const glass = ctx.createLinearGradient(x, y - r, x, y + r);
  glass.addColorStop(0, '#060b14');
  glass.addColorStop(1, '#08202c');
  ctx.fillStyle = glass;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const surface = y + r * (0.62 - level * 0.2);
  ctx.beginPath();
  ctx.moveTo(x - r, y + r);
  for (let i = 0; i <= 12; i++) {
    const px = x - r + (i / 12) * r * 2;
    ctx.lineTo(px, surface + Math.sin(i * 0.9 + time * 3) * r * 0.06);
  }
  ctx.lineTo(x + r, y + r);
  ctx.closePath();
  const liquid = ctx.createLinearGradient(x, surface, x, y + r);
  liquid.addColorStop(0, `${el.color}88`);
  liquid.addColorStop(1, `${el.color}18`);
  ctx.fillStyle = liquid;
  ctx.fill();
  // Bright meniscus line and rising bubbles
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const px = x - r + (i / 12) * r * 2;
    const py = surface + Math.sin(i * 0.9 + time * 3) * r * 0.06;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = `${el.accent}aa`;
  for (let i = 0; i < 4; i++) {
    const rise = (time * 0.6 + i * 0.27) % 1;
    const by = y + r - rise * (y + r - surface);
    ctx.beginPath();
    ctx.arc(x + (i - 1.5) * r * 0.45 + Math.sin(time * 4 + i) * 1, by, 0.8 + (i % 2) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glass glint and scanlines
  ctx.fillStyle = 'rgba(200, 251, 255, 0.04)';
  for (let sy = y - r; sy < y + r; sy += 3) ctx.fillRect(x - r, sy, r * 2, 1);
  ctx.restore();
  hexPath(ctx, x, y, r, 0);
  ctx.strokeStyle = level >= 2 ? el.color : `${el.color}66`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pipes along three rim edges, joined by valve wheels at every other corner.
  const corner = (k: number, rad: number) => [x + Math.cos((k * Math.PI) / 3) * rad, y + Math.sin((k * Math.PI) / 3) * rad] as const;
  const pipeR = (R + r) / 2;
  ctx.strokeStyle = THEME.barrel;
  ctx.lineWidth = size * 0.05;
  ctx.lineCap = 'round';
  for (const k of [0, 2, 4]) {
    const [ax, ay] = corner(k, pipeR);
    const [bx, by] = corner(k + 1, pipeR);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  const valve = size * 0.055 * (1 + (level - 1) * 0.25);
  for (const k of [0, 2, 4]) {
    const [vx, vy] = corner(k, pipeR);
    ctx.beginPath();
    ctx.arc(vx, vy, valve, 0, Math.PI * 2);
    ctx.fillStyle = THEME.armorLight;
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vx - valve * 0.7, vy);
    ctx.lineTo(vx + valve * 0.7, vy);
    ctx.moveTo(vx, vy - valve * 0.7);
    ctx.lineTo(vx, vy + valve * 0.7);
    ctx.strokeStyle = el.accent;
    ctx.stroke();
  }

  if (level >= 2) {
    // Level pips along the bottom edge
    ctx.fillStyle = el.accent;
    for (let i = 0; i < level; i++) ctx.fillRect(x + (i - (level - 1) / 2) * 5 - 1.5, y + R * 0.87 - 3, 3, 2);
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawNozzle(ctx, size, weapon, recoil, level, time);
  ctx.restore();
}

/** Flat-topped hexagon path (rotated by `rot`) around (x, y). */
function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = rot + (k * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** The turret, drawn pointing along +x: a weapon-specific nozzle on an impeller pump. */
function drawNozzle(ctx: CanvasRenderingContext2D, size: number, weapon: WeaponId, recoil: number, level: number, time: number): void {
  const el = ELEMENTS.water;
  const kick = recoil * size * 0.08;

  if (level >= 3) {
    // Radiator fins behind the pump
    ctx.fillStyle = el.color;
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) ctx.fillRect(-size * (0.3 - i * 0.06), side * size * 0.14 - (side < 0 ? size * 0.12 : 0), size * 0.025, size * 0.12);
  }

  // A pipe with a neon outline and coolant stripe; returns nothing, drawn at `offset` across.
  const pipe = (from: number, len: number, w: number, offset = 0) => {
    ctx.fillStyle = THEME.barrel;
    ctx.beginPath();
    ctx.roundRect(from - kick, offset - w / 2, len, w, w / 2);
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = `${el.color}bb`;
    ctx.fillRect(from - kick + w * 0.4, offset - 0.6, len - w * 0.8, 1.2);
  };
  // A cone nozzle opening at `at`, `w` wide at the mouth, with a glowing lip.
  const bell = (at: number, w: number, offset = 0) => {
    ctx.beginPath();
    ctx.moveTo(at - size * 0.08 - kick, offset - w * 0.35);
    ctx.lineTo(at - kick, offset - w / 2);
    ctx.lineTo(at - kick, offset + w / 2);
    ctx.lineTo(at - size * 0.08 - kick, offset + w * 0.35);
    ctx.closePath();
    ctx.fillStyle = THEME.armorLight;
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = el.accent;
    ctx.fillRect(at - kick - 1.5, offset - w / 2, 1.5, w);
  };
  // A coil ring clamped across a pipe at `at`.
  const coil = (at: number, w: number) => {
    ctx.beginPath();
    ctx.ellipse(at - kick, 0, w * 0.22, w * 0.75, 0, 0, Math.PI * 2);
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };

  switch (weapon) {
    case 'cannon':
      // Hydro Ram: a fat pressure barrel with two clamp bands and a flared nozzle.
      pipe(0, size * 0.44, size * 0.2);
      for (const at of [0.22, 0.32]) {
        ctx.fillStyle = el.dark;
        ctx.fillRect(size * at - kick, -size * 0.11, size * 0.03, size * 0.22);
        ctx.strokeStyle = el.color;
        ctx.strokeRect(size * at - kick, -size * 0.11, size * 0.03, size * 0.22);
      }
      bell(size * 0.54, size * 0.26);
      break;
    case 'flak':
      // Twin mist jets with a glass coolant canister across them.
      for (const side of [-1, 1]) {
        pipe(0, size * 0.4, size * 0.08, side * size * 0.1);
        bell(size * 0.48, size * 0.12, side * size * 0.1);
      }
      ctx.beginPath();
      ctx.roundRect(size * 0.18 - kick, -size * 0.16, size * 0.09, size * 0.32, size * 0.04);
      ctx.fillStyle = `${el.color}55`;
      ctx.fill();
      ctx.strokeStyle = el.accent;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'multi': {
      // Spray manifold: a curved header pipe feeding three short jets.
      ctx.beginPath();
      ctx.arc(-kick, 0, size * 0.26, -0.6, 0.6);
      ctx.strokeStyle = THEME.barrel;
      ctx.lineWidth = size * 0.08;
      ctx.stroke();
      ctx.strokeStyle = el.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      for (const a of [-0.45, 0, 0.45]) {
        ctx.save();
        ctx.rotate(a);
        pipe(size * 0.2, size * 0.2, size * 0.07);
        glowDot(ctx, size * 0.42 - kick, 0, size * 0.07, el.accent, el.color);
        ctx.restore();
      }
      break;
    }
    case 'sniper':
      // Cryo lance: a long thin rail through four coil rings, with a crystal tip.
      pipe(0, size * 0.72, size * 0.07);
      for (const at of [0.26, 0.38, 0.5, 0.62]) coil(size * at, size * 0.1);
      ctx.beginPath();
      ctx.moveTo(size * 0.72 - kick, -size * 0.05);
      ctx.lineTo(size * 0.84 - kick, 0);
      ctx.lineTo(size * 0.72 - kick, size * 0.05);
      ctx.closePath();
      ctx.fillStyle = el.accent;
      ctx.fill();
      break;
    case 'mortar': {
      // Depth canister: a glass drum of churning coolant around a dark launch mouth.
      const cx = size * 0.04 - kick * 0.5;
      const rad = size * 0.25;
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI * 2) / 3 + Math.PI / 3);
        ctx.fillStyle = THEME.barrel;
        ctx.fillRect(rad * 0.8, -size * 0.035, rad * 0.4, size * 0.07);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(cx, 0, rad, 0, Math.PI * 2);
      ctx.fillStyle = THEME.armorLight;
      ctx.fill();
      neonStroke(ctx, el.color, 1.5);
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const wr = rad * (0.82 + Math.sin(a * 5 + time * 4) * 0.06);
        ctx.lineTo(cx + Math.cos(a) * wr, Math.sin(a) * wr);
      }
      ctx.closePath();
      ctx.fillStyle = `${el.color}44`;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, 0, size * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = '#04070d';
      ctx.fill();
      ctx.strokeStyle = el.accent;
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }
    case 'chain': {
      // Tide coil: three emitter prongs around a wobbling water orb, droplets orbiting it.
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(size * 0.18, -size * 0.06);
        ctx.lineTo(size * 0.36, -size * 0.025);
        ctx.lineTo(size * 0.36, size * 0.025);
        ctx.lineTo(size * 0.18, size * 0.06);
        ctx.closePath();
        ctx.fillStyle = THEME.barrel;
        ctx.fill();
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = el.accent;
        ctx.fillRect(size * 0.34, -size * 0.025, size * 0.025, size * 0.05);
        ctx.restore();
      }
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const wr = size * (0.23 + Math.sin(a * 6 + time * 5) * 0.015);
        ctx.lineTo(Math.cos(a) * wr, Math.sin(a) * wr);
      }
      ctx.closePath();
      ctx.fillStyle = `${el.dark}cc`;
      ctx.fill();
      neonStroke(ctx, el.color, 1.2);
      glowDot(ctx, 0, 0, size * (0.17 + recoil * 0.08), el.accent, el.color);
      for (let k = 0; k < 3; k++) {
        const a = time * 2.2 + (k * Math.PI * 2) / 3;
        const ox = Math.cos(a) * size * 0.3;
        const oy = Math.sin(a) * size * 0.3;
        ctx.beginPath();
        ctx.arc(ox, oy, size * 0.035, 0, Math.PI * 2);
        ctx.fillStyle = el.accent;
        ctx.fill();
      }
      return;
    }
  }

  // Impeller pump hub: a dark housing with spinning vanes under a glass dome.
  const hub = size * 0.18;
  ctx.beginPath();
  ctx.arc(0, 0, hub, 0, Math.PI * 2);
  ctx.fillStyle = THEME.armorLight;
  ctx.fill();
  neonStroke(ctx, el.color, 1.5);
  ctx.save();
  ctx.rotate(time * (3 + recoil * 8));
  ctx.strokeStyle = `${el.color}aa`;
  ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * hub * 0.25, Math.sin(a) * hub * 0.25);
    ctx.quadraticCurveTo(Math.cos(a + 0.5) * hub * 0.7, Math.sin(a + 0.5) * hub * 0.7, Math.cos(a + 0.9) * hub * 0.9, Math.sin(a + 0.9) * hub * 0.9);
    ctx.stroke();
  }
  ctx.restore();
  glowDot(ctx, 0, 0, size * (0.07 + level * 0.022), el.accent, el.color);
}
