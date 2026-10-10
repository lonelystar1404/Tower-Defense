import { ELEMENTS } from '../data/elements';
import type { WeaponId } from '../data/weapons';
import { glowDot, levelAura, levelPips, neonStroke } from './sprites';
import { THEME } from './theme';

/**
 * Metal towers: cyberpunk precision chrome, a factory-fresh weapons platform. A gear-toothed
 * turntable of polished steel with a dial of tick marks and a scanner arc sweeping round it,
 * a chrome dome with a targeting reticle, and machined guns: a tapered barrel with a slotted
 * muzzle brake (cannon), twin autocannons with heat-sink rings (flak), a three-barrel rotary
 * (multi), a twin-rail railgun with a charged beam between the rails (sniper), an aperture
 * iris that opens to fire (mortar), and a tesla sphere inside gyro rings (chain).
 *
 * Same footprint, rotation, recoil, and upgrade cues as every tower. `time` animates it.
 */
export function drawMetalTower(
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
  const el = ELEMENTS.metal;
  const half = size * 0.4;
  if (level >= 3) {
    levelAura(ctx, x, y, half, el.color);
    // An outer dial of tick marks turning slowly
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1;
    for (let k = 0; k < 24; k++) {
      const a = -time * 0.3 + (k * Math.PI) / 12;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * half * 1.2, y + Math.sin(a) * half * 1.2);
      ctx.lineTo(x + Math.cos(a) * half * (k % 3 === 0 ? 1.35 : 1.27), y + Math.sin(a) * half * (k % 3 === 0 ? 1.35 : 1.27));
      ctx.stroke();
    }
  }

  // Turntable: a twelve-toothed gear of brushed steel.
  const R = half * 1.04;
  ctx.beginPath();
  for (let k = 0; k < 24; k++) {
    const a0 = (k * Math.PI) / 12 - 0.1;
    const a1 = (k * Math.PI) / 12 + 0.1;
    const rad = k % 2 === 0 ? R : R * 0.88;
    ctx.lineTo(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad);
    ctx.lineTo(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad);
  }
  ctx.closePath();
  const steel = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
  steel.addColorStop(0, '#59607e');
  steel.addColorStop(0.5, '#2b3049');
  steel.addColorStop(1, '#4a5170');
  ctx.fillStyle = steel;
  ctx.fill();
  neonStroke(ctx, el.color, 1.2);

  // Dial: a dark plate with tick marks, and a scanner arc sweeping round.
  const r = R * 0.72;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = THEME.armor;
  ctx.fill();
  ctx.strokeStyle = level >= 2 ? el.color : `${el.color}55`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = `${el.color}66`;
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    ctx.lineTo(x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  const sweep = time * 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, sweep, sweep + 0.9);
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  levelPips(ctx, x, y + r * 0.75, level, el.accent);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawGun(ctx, size, weapon, recoil, level, time);
  ctx.restore();
}

/** The turret, drawn pointing along +x. */
function drawGun(ctx: CanvasRenderingContext2D, size: number, weapon: WeaponId, recoil: number, level: number, time: number): void {
  const el = ELEMENTS.metal;
  const kick = recoil * size * 0.08;

  if (level >= 3) {
    // Swept stabilizer blades
    ctx.fillStyle = el.color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.08, side * size * 0.15);
      ctx.lineTo(-size * 0.34, side * size * 0.26);
      ctx.lineTo(-size * 0.22, side * size * 0.12);
      ctx.closePath();
      ctx.fill();
    }
  }

  // A polished cylinder: dark edges, bright center line, tapering from `w0` to `w1`.
  const chrome = (from: number, len: number, w0: number, w1 = w0, offset = 0) => {
    const g = ctx.createLinearGradient(0, offset - w0 / 2, 0, offset + w0 / 2);
    g.addColorStop(0, '#3a4060');
    g.addColorStop(0.45, '#e8ecff');
    g.addColorStop(1, '#3a4060');
    ctx.beginPath();
    ctx.moveTo(from - kick, offset - w0 / 2);
    ctx.lineTo(from + len - kick, offset - w1 / 2);
    ctx.lineTo(from + len - kick, offset + w1 / 2);
    ctx.lineTo(from - kick, offset + w0 / 2);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#1a1e30';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  // Dark bands clamped round a barrel at `at`.
  const band = (at: number, w: number, offset = 0) => {
    ctx.fillStyle = '#1a1e30';
    ctx.fillRect(at - kick, offset - w / 2, size * 0.025, w);
  };

  switch (weapon) {
    case 'cannon':
      // Tapered barrel ending in a slotted muzzle brake.
      chrome(0, size * 0.44, size * 0.17, size * 0.12);
      chrome(size * 0.42, size * 0.1, size * 0.17);
      ctx.fillStyle = '#1a1e30';
      for (const o of [-0.05, 0.05]) ctx.fillRect(size * 0.45 - kick, o * size - size * 0.012, size * 0.05, size * 0.024);
      ctx.fillStyle = el.accent;
      ctx.fillRect(size * 0.51 - kick, -size * 0.085, size * 0.012, size * 0.17);
      break;
    case 'flak':
      // Twin autocannons with heat-sink rings.
      for (const o of [-0.09, 0.09]) {
        chrome(0, size * 0.5, size * 0.09, size * 0.07, o * size);
        for (const at of [0.2, 0.26, 0.32]) band(size * at, size * 0.11, o * size);
      }
      break;
    case 'multi': {
      // Rotary: three barrels side by side, spun by a ring at the front.
      const spin = Math.sin(time * 6 + recoil * 4);
      for (const o of [-1, 0, 1]) chrome(size * 0.05, size * 0.4, size * 0.065, size * 0.06, (o * 0.075 + spin * 0.01) * size);
      band(size * 0.36, size * 0.28);
      ctx.strokeStyle = el.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(size * 0.36 - kick, -size * 0.14, size * 0.025, size * 0.28);
      break;
    }
    case 'sniper': {
      // Railgun: two rails with a charged beam between them, capacitors at the back.
      chrome(0, size * 0.8, size * 0.05, size * 0.04, -size * 0.06);
      chrome(0, size * 0.8, size * 0.05, size * 0.04, size * 0.06);
      const charge = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.globalAlpha = 0.4 + charge * 0.6;
      ctx.fillStyle = el.accent;
      ctx.fillRect(size * 0.2 - kick, -0.75, size * 0.58, 1.5);
      ctx.globalAlpha = 1;
      for (const at of [0.12, 0.2]) {
        ctx.fillStyle = THEME.armorLight;
        ctx.fillRect(size * at - kick, -size * 0.11, size * 0.06, size * 0.22);
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(size * at - kick, -size * 0.11, size * 0.06, size * 0.22);
      }
      break;
    }
    case 'mortar': {
      // Aperture iris: steel blades around a dark mouth; they open wider as it fires.
      const cx = size * 0.03 - kick * 0.5;
      const rad = size * 0.25;
      ctx.beginPath();
      ctx.arc(cx, 0, rad, 0, Math.PI * 2);
      ctx.fillStyle = '#05060a';
      ctx.fill();
      const open = 0.35 + recoil * 0.25;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + time * 0.2;
        ctx.save();
        ctx.translate(cx, 0);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(rad, 0);
        ctx.arc(0, 0, rad, 0, Math.PI / 3 + 0.05);
        ctx.lineTo(rad * open * Math.cos(1.6), rad * open * Math.sin(1.6));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, rad, 0);
        g.addColorStop(0, '#2b3049');
        g.addColorStop(1, '#8a92b8');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#1a1e30';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(cx, 0, rad, 0, Math.PI * 2);
      neonStroke(ctx, el.color, 1.5);
      return;
    }
    case 'chain': {
      // Tesla sphere: a chrome ball inside three gyro rings that tumble.
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 3 + time * 0.8);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.3, size * 0.3 * Math.abs(Math.sin(time * 1.3 + k)) + 1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = k === 0 ? el.accent : `${el.color}aa`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      const ball = ctx.createRadialGradient(-size * 0.05, -size * 0.05, 1, 0, 0, size * 0.17);
      ball.addColorStop(0, '#ffffff');
      ball.addColorStop(0.5, '#9aa3cc');
      ball.addColorStop(1, '#2b3049');
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = ball;
      ctx.fill();
      neonStroke(ctx, el.color, 1);
      glowDot(ctx, 0, 0, size * (0.1 + recoil * 0.1), el.accent, el.color);
      return;
    }
  }

  // Chrome dome with a targeting reticle.
  const dome = ctx.createRadialGradient(-size * 0.05, -size * 0.05, 1, 0, 0, size * 0.18);
  dome.addColorStop(0, '#ffffff');
  dome.addColorStop(0.45, '#9aa3cc');
  dome.addColorStop(1, '#2b3049');
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = dome;
  ctx.fill();
  neonStroke(ctx, el.color, 1.2);
  ctx.strokeStyle = '#1a1e30';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
  ctx.moveTo(-size * 0.13, 0);
  ctx.lineTo(size * 0.13, 0);
  ctx.moveTo(0, -size * 0.13);
  ctx.lineTo(0, size * 0.13);
  ctx.stroke();
  glowDot(ctx, 0, 0, size * (0.035 + level * 0.015), el.accent, el.color);
}
