import { ELEMENTS } from '../data/elements';
import type { WeaponId } from '../data/weapons';
import { glowDot, levelAura, levelPips, neonStroke } from './sprites';
import { THEME } from './theme';

/** Bark-dark stalks and shells for the bio-tech parts. */
const BARK = '#24402c';
const BARK_LIGHT = '#4f8052';

/**
 * Wood towers: cyberpunk bio-tech, grown rather than built. A round seed-pod hull on four leaf
 * plates (the leaves grow with each upgrade), bio-circuit veins that pulse with light, a bloom
 * of petals at the center, and a grown weapon per type: seed launcher wrapped in a vine
 * (cannon), twin thorn spikes (flak), three tendrils with glowing buds (multi), a thorn needle
 * with leaf nodes (sniper), an open petal pod (mortar), and a spore orb on wavy roots (chain).
 *
 * Same footprint, rotation, recoil, and upgrade cues as every tower. `time` animates it.
 */
export function drawWoodTower(
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
  const el = ELEMENTS.wood;
  const half = size * 0.4;
  if (level >= 3) {
    levelAura(ctx, x, y, half, el.color);
    // A ring of drifting spores
    ctx.fillStyle = el.accent;
    for (let k = 0; k < 10; k++) {
      const a = time * 0.4 + (k * Math.PI * 2) / 10;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * half * 1.25, y + Math.sin(a) * half * 1.25, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Leaf plates out to the four corners, with a neon midrib.
  const grow = 1 + (level - 1) * 0.12;
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + (k * Math.PI) / 2);
    const len = half * 1.3 * grow;
    ctx.beginPath();
    ctx.moveTo(half * 0.35, 0);
    ctx.quadraticCurveTo(len * 0.7, -half * 0.36, len, 0);
    ctx.quadraticCurveTo(len * 0.7, half * 0.36, half * 0.35, 0);
    ctx.fillStyle = el.dark;
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(half * 0.5, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.strokeStyle = `${el.accent}99`;
    ctx.stroke();
    ctx.restore();
  }

  // The pod: a round shell with pulsing bio-circuit veins.
  const R = half * 0.92;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fillStyle = THEME.armor;
  ctx.fill();
  neonStroke(ctx, el.color, 1.5);
  const shell = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 0.85);
  shell.addColorStop(0, '#16301c');
  shell.addColorStop(1, '#0a1f10');
  ctx.beginPath();
  ctx.arc(x, y, R * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = shell;
  ctx.fill();
  if (level >= 2) {
    ctx.strokeStyle = `${el.color}99`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Veins: right-angled traces out from the middle, each ending in a node that pulses in turn.
  const veins: [number, number, number, number][] = [
    [-0.25, -0.2, -0.62, -0.2], [0.2, -0.3, 0.2, -0.66], [0.3, 0.15, 0.62, 0.15], [-0.15, 0.3, -0.15, 0.66],
  ];
  ctx.strokeStyle = `${el.color}55`;
  ctx.lineWidth = 1;
  veins.forEach(([ax, ay, bx, by], i) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ax * R, y + ay * R);
    ctx.lineTo(x + bx * R, y + by * R);
    ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 - i * 1.6);
    ctx.globalAlpha = 0.45 + pulse * 0.55;
    glowDot(ctx, x + bx * R, y + by * R, size * 0.045, el.accent, el.color);
    ctx.globalAlpha = 1;
  });
  levelPips(ctx, x, y + R * 0.95, level, el.accent);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawGrowth(ctx, size, weapon, recoil, level, time);
  ctx.restore();
}

/** The turret, drawn pointing along +x. */
function drawGrowth(ctx: CanvasRenderingContext2D, size: number, weapon: WeaponId, recoil: number, level: number, time: number): void {
  const el = ELEMENTS.wood;
  const kick = recoil * size * 0.08;

  // A stalk from `from` for `len`, `w` thick, with a vine winding around it.
  const stalk = (from: number, len: number, w: number, offset = 0) => {
    ctx.beginPath();
    ctx.roundRect(from - kick, offset - w / 2, len, w, w / 2);
    ctx.fillStyle = BARK;
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const px = from - kick + (i / 16) * len;
      const py = offset + Math.sin(i * 1.4 + time * 2) * w * 0.38;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = el.accent;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  // A tapered thorn from `from` for `len`, `w` wide at the base, with side barbs.
  const thorn = (from: number, len: number, w: number, offset = 0) => {
    ctx.beginPath();
    ctx.moveTo(from - kick, offset - w / 2);
    ctx.lineTo(from + len - kick, offset);
    ctx.lineTo(from - kick, offset + w / 2);
    ctx.closePath();
    ctx.fillStyle = BARK_LIGHT;
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = el.accent;
    for (const t of [0.35, 0.6]) {
      const bx = from + len * t - kick;
      const bw = (w / 2) * (1 - t);
      ctx.beginPath();
      ctx.moveTo(bx, offset - bw);
      ctx.lineTo(bx + size * 0.04, offset - bw - size * 0.035);
      ctx.lineTo(bx + size * 0.03, offset - bw);
      ctx.fill();
    }
  };
  // A small leaf on a stem, at `at` along the turret, pointing to `side` (−1 / 1).
  const leaf = (at: number, side: number, len: number) => {
    ctx.beginPath();
    ctx.moveTo(at - kick, 0);
    ctx.quadraticCurveTo(at + len * 0.6 - kick, side * len * 0.55, at + len * 0.2 - kick, side * len);
    ctx.quadraticCurveTo(at - len * 0.1 - kick, side * len * 0.5, at - kick, 0);
    ctx.fillStyle = `${el.color}aa`;
    ctx.fill();
  };

  switch (weapon) {
    case 'cannon':
      // Seed launcher: a thick vine-wrapped stalk ending in a glowing seed pod.
      stalk(0, size * 0.42, size * 0.18);
      ctx.beginPath();
      ctx.ellipse(size * 0.47 - kick, 0, size * 0.08, size * 0.11, 0, 0, Math.PI * 2);
      ctx.fillStyle = BARK_LIGHT;
      ctx.fill();
      ctx.strokeStyle = el.color;
      ctx.stroke();
      glowDot(ctx, size * 0.5 - kick, 0, size * 0.07, el.accent, el.color);
      break;
    case 'flak':
      // Twin thorn spikes.
      thorn(0, size * 0.5, size * 0.11, -size * 0.09);
      thorn(0, size * 0.5, size * 0.11, size * 0.09);
      break;
    case 'multi':
      // Three tendrils curling out, each ending in a glowing bud.
      for (const [a, curl] of [[-0.5, 1], [0, -1], [0.5, -1]] as const) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.22 - kick, curl * size * 0.08 * Math.sin(time * 2 + a * 3), size * 0.4 - kick, 0);
        ctx.strokeStyle = BARK_LIGHT;
        ctx.lineWidth = size * 0.07;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.lineCap = 'butt';
        glowDot(ctx, size * 0.42 - kick, 0, size * 0.075, el.accent, el.color);
        ctx.restore();
      }
      break;
    case 'sniper':
      // Thorn needle: one long tapered spike with leaf nodes along it.
      for (const [at, side] of [[0.3, -1], [0.45, 1], [0.6, -1]] as const) leaf(size * at, side, size * 0.1);
      thorn(0, size * 0.82, size * 0.09);
      break;
    case 'mortar': {
      // Open pod: petals around a dark seed mouth; they flex open when it fires.
      const open = 1 + recoil * 0.15;
      for (let k = 0; k < 6; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 3 + 0.3);
        ctx.beginPath();
        ctx.ellipse(size * 0.17 * open, 0, size * 0.11, size * 0.07, 0, 0, Math.PI * 2);
        ctx.fillStyle = BARK_LIGHT;
        ctx.fill();
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#050a06';
      ctx.fill();
      ctx.strokeStyle = el.accent;
      ctx.stroke();
      return;
    }
    case 'chain': {
      // Spore orb: wavy root filaments out to glowing tips, spores circling.
      ctx.strokeStyle = `${el.color}cc`;
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const d = size * (0.12 + (i / 8) * 0.22);
          const wob = Math.sin(i * 1.3 + time * 3 + k) * size * 0.025;
          const px = Math.cos(a) * d - Math.sin(a) * wob;
          const py = Math.sin(a) * d + Math.cos(a) * wob;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        glowDot(ctx, Math.cos(a) * size * 0.34, Math.sin(a) * size * 0.34, size * 0.045, el.accent, el.color);
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = BARK;
      ctx.fill();
      neonStroke(ctx, el.color, 1.2);
      glowDot(ctx, 0, 0, size * (0.15 + recoil * 0.08), el.accent, el.color);
      return;
    }
  }

  // Bloom hub: five petals that breathe around a glowing core.
  const breathe = 1 + Math.sin(time * 2) * 0.06;
  for (let k = 0; k < 5; k++) {
    ctx.save();
    ctx.rotate((k * Math.PI * 2) / 5 + time * 0.3);
    ctx.beginPath();
    ctx.ellipse(size * 0.075 * breathe, 0, size * 0.075, size * 0.045, 0, 0, Math.PI * 2);
    ctx.fillStyle = BARK_LIGHT;
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  glowDot(ctx, 0, 0, size * (0.05 + level * 0.018), el.accent, el.color);
}
