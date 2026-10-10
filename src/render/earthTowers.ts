import { ELEMENTS } from '../data/elements';
import type { WeaponId } from '../data/weapons';
import { glowDot, levelAura, levelPips, neonStroke } from './sprites';
import { THEME } from './theme';

/** Basalt-dark slab and block colors. */
const STONE = '#2a2620';
const STONE_LIGHT = '#3d362b';

/**
 * Earth towers: cyberpunk heavy industry, a seismic rig bolted into the street. A thick octagonal
 * slab with a hazard-striped rim, glowing magma fissures across the middle (they pulse, and more
 * open up with each upgrade), and blocky hydraulic weapons: stepped ram with pistons (cannon),
 * twin ribbed stacks (flak), a wedge with three short block barrels (multi), a segmented drill
 * (sniper), a crusher hopper (mortar), and a seismic crystal sending out tremor rings (chain).
 *
 * Same footprint, rotation, recoil, and upgrade cues as every tower. `time` animates it.
 */
export function drawEarthTower(
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
  const el = ELEMENTS.earth;
  const half = size * 0.4;
  if (level >= 3) {
    levelAura(ctx, x, y, half, el.color);
    // A pulsing octagon outline, like a shock front
    const p = (time * 0.7) % 1;
    ctx.globalAlpha = 1 - p;
    octPath(ctx, x, y, half * (1.1 + p * 0.35));
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Slab: an octagon whose rim is hazard-striped, around a dark stone core.
  const R = half * 1.06;
  octPath(ctx, x, y, R);
  ctx.fillStyle = THEME.armor;
  ctx.fill();
  neonStroke(ctx, el.color, 1.5);
  ctx.save();
  octPath(ctx, x, y, R * 0.94);
  ctx.clip();
  ctx.fillStyle = '#15120c';
  ctx.fillRect(x - R, y - R, R * 2, R * 2);
  ctx.fillStyle = `${el.color}cc`;
  for (let i = -8; i <= 8; i++) {
    const o = x + i * size * 0.1;
    ctx.beginPath();
    ctx.moveTo(o, y - R);
    ctx.lineTo(o + size * 0.05, y - R);
    ctx.lineTo(o + size * 0.05 - R * 2, y + R);
    ctx.lineTo(o - R * 2, y + R);
    ctx.fill();
  }
  ctx.restore();
  const r = R * 0.74;
  octPath(ctx, x, y, r);
  const stone = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  stone.addColorStop(0, STONE_LIGHT);
  stone.addColorStop(1, STONE);
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.strokeStyle = level >= 2 ? el.color : '#00000088';
  ctx.lineWidth = level >= 2 ? 1 : 1.5;
  ctx.stroke();

  // Magma fissures: jagged cracks with a hot core; more open with each level.
  const cracks: [number, number][][] = [
    [[-0.9, -0.2], [-0.5, -0.05], [-0.3, -0.35], [0.05, -0.2]],
    [[0.9, 0.3], [0.5, 0.1], [0.35, 0.45], [0.05, 0.3]],
    [[-0.2, 0.9], [-0.1, 0.55], [-0.4, 0.4]],
  ];
  const glow = 0.6 + 0.4 * Math.sin(time * 2.2);
  ctx.save();
  octPath(ctx, x, y, r);
  ctx.clip();
  cracks.slice(0, level).forEach((crack) => {
    ctx.beginPath();
    crack.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(x + cx * r, y + cy * r) : ctx.lineTo(x + cx * r, y + cy * r)));
    ctx.globalAlpha = glow;
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = glow * 0.35;
    ctx.stroke();
    ctx.globalAlpha = glow;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = el.accent;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  ctx.restore();
  levelPips(ctx, x, y + R * 0.83, level, '#ffffff');

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawRig(ctx, size, weapon, recoil, level, time);
  ctx.restore();
}

/** Octagon around (x, y), flat on all four sides. */
function octPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const c = r * 0.414;
  ctx.beginPath();
  ctx.moveTo(x - c, y - r);
  ctx.lineTo(x + c, y - r);
  ctx.lineTo(x + r, y - c);
  ctx.lineTo(x + r, y + c);
  ctx.lineTo(x + c, y + r);
  ctx.lineTo(x - c, y + r);
  ctx.lineTo(x - r, y + c);
  ctx.lineTo(x - r, y - c);
  ctx.closePath();
}

/** The turret, drawn pointing along +x. */
function drawRig(ctx: CanvasRenderingContext2D, size: number, weapon: WeaponId, recoil: number, level: number, time: number): void {
  const el = ELEMENTS.earth;
  const kick = recoil * size * 0.08;

  if (level >= 3) {
    // Stabilizer feet out to the sides
    ctx.fillStyle = el.color;
    for (const side of [-1, 1]) ctx.fillRect(-size * 0.2, side > 0 ? size * 0.2 : -size * 0.26, size * 0.14, size * 0.06);
  }

  // A square-cut block barrel with ribs; `w` across.
  const block = (from: number, len: number, w: number, offset = 0) => {
    ctx.fillStyle = STONE_LIGHT;
    ctx.fillRect(from - kick, offset - w / 2, len, w);
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(from - kick + 0.5, offset - w / 2 + 0.5, len - 1, w - 1);
    ctx.strokeStyle = '#00000099';
    for (let rx = from + size * 0.08; rx < from + len - size * 0.03; rx += size * 0.07) {
      ctx.beginPath();
      ctx.moveTo(rx - kick, offset - w / 2 + 1);
      ctx.lineTo(rx - kick, offset + w / 2 - 1);
      ctx.stroke();
    }
    ctx.fillStyle = el.accent;
    ctx.fillRect(from + len - kick - size * 0.035, offset - w / 2, size * 0.035, w);
  };

  switch (weapon) {
    case 'cannon': {
      // Stepped ram: a wide base block, a narrower ram, and pistons that slide with the recoil.
      block(0, size * 0.3, size * 0.26);
      block(size * 0.28, size * 0.24, size * 0.17);
      ctx.strokeStyle = THEME.barrel;
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(size * 0.1, side * size * 0.16);
        ctx.lineTo(size * 0.42 - kick, side * size * 0.11);
        ctx.stroke();
      }
      break;
    }
    case 'flak':
      // Twin ribbed stacks.
      block(0, size * 0.48, size * 0.12, -size * 0.1);
      block(0, size * 0.48, size * 0.12, size * 0.1);
      break;
    case 'multi':
      // A wedge carrying three short block barrels.
      ctx.beginPath();
      ctx.moveTo(size * 0.05 - kick, -size * 0.14);
      ctx.lineTo(size * 0.28 - kick, -size * 0.24);
      ctx.lineTo(size * 0.28 - kick, size * 0.24);
      ctx.lineTo(size * 0.05 - kick, size * 0.14);
      ctx.closePath();
      ctx.fillStyle = STONE;
      ctx.fill();
      ctx.strokeStyle = el.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      for (const o of [-0.15, 0, 0.15]) block(size * 0.26, size * 0.17, size * 0.08, o * size);
      break;
    case 'sniper': {
      // Segmented drill: blocks narrowing out to a striped drill bit that spins.
      block(0, size * 0.25, size * 0.13);
      block(size * 0.24, size * 0.24, size * 0.1);
      block(size * 0.47, size * 0.18, size * 0.075);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(size * 0.65 - kick, -size * 0.05);
      ctx.lineTo(size * 0.84 - kick, 0);
      ctx.lineTo(size * 0.65 - kick, size * 0.05);
      ctx.closePath();
      ctx.fillStyle = el.color;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = '#00000088';
      ctx.lineWidth = 1.5;
      const spin = (time * 30) % (size * 0.05);
      for (let sx = size * 0.6; sx < size * 0.86; sx += size * 0.05) {
        ctx.beginPath();
        ctx.moveTo(sx + spin - kick, -size * 0.06);
        ctx.lineTo(sx + spin - size * 0.03 - kick, size * 0.06);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'mortar': {
      // Crusher hopper: a square bin, hazard rim, and a dark square mouth.
      const s = size * 0.26;
      const cx = size * 0.03 - kick * 0.5;
      ctx.fillStyle = STONE_LIGHT;
      ctx.fillRect(cx - s, -s, s * 2, s * 2);
      ctx.beginPath();
      ctx.rect(cx - s, -s, s * 2, s * 2);
      neonStroke(ctx, el.color, 1.5);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - s, -s, s * 2, s * 2);
      ctx.rect(cx - s * 0.62, -s * 0.62, s * 1.24, s * 1.24);
      ctx.clip('evenodd');
      ctx.fillStyle = `${el.color}88`;
      for (let i = -6; i <= 6; i++) {
        const o = cx + i * size * 0.07;
        ctx.beginPath();
        ctx.moveTo(o, -s);
        ctx.lineTo(o + size * 0.035, -s);
        ctx.lineTo(o + size * 0.035 - s * 2, s);
        ctx.lineTo(o - s * 2, s);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#0a0805';
      ctx.fillRect(cx - s * 0.5, -s * 0.5, s, s);
      ctx.strokeStyle = el.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - s * 0.5, -s * 0.5, s, s);
      return;
    }
    case 'chain': {
      // Seismic crystal: a glowing diamond with square tremor rings rolling outward.
      for (let k = 0; k < 2; k++) {
        const p = (time * 0.8 + k * 0.5) % 1;
        const d = size * (0.18 + p * 0.2);
        ctx.globalAlpha = 1 - p;
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(-d / 1.414, -d / 1.414, (d * 2) / 1.414, (d * 2) / 1.414);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(size * 0.2, 0);
      ctx.lineTo(0, -size * 0.24);
      ctx.lineTo(-size * 0.2, 0);
      ctx.lineTo(0, size * 0.24);
      ctx.closePath();
      ctx.fillStyle = STONE_LIGHT;
      ctx.fill();
      neonStroke(ctx, el.color, 1.5);
      ctx.beginPath();
      ctx.moveTo(-size * 0.2, 0);
      ctx.lineTo(size * 0.2, 0);
      ctx.moveTo(0, -size * 0.24);
      ctx.lineTo(0, size * 0.24);
      ctx.strokeStyle = `${el.color}66`;
      ctx.lineWidth = 1;
      ctx.stroke();
      glowDot(ctx, 0, 0, size * (0.13 + recoil * 0.08), el.accent, el.color);
      return;
    }
  }

  // Turret block: a square housing with a glowing vision slit.
  const h = size * 0.16;
  ctx.fillStyle = STONE_LIGHT;
  ctx.fillRect(-h, -h, h * 2, h * 2);
  ctx.beginPath();
  ctx.rect(-h, -h, h * 2, h * 2);
  neonStroke(ctx, el.color, 1.5);
  ctx.fillStyle = el.color;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 2.2);
  ctx.fillRect(h * 0.2, -h * 0.65, h * 0.35, h * 1.3);
  ctx.globalAlpha = 1;
  glowDot(ctx, -h * 0.3, 0, size * (0.05 + level * 0.018), el.accent, el.color);
}
