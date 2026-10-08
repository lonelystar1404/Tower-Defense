import { dist } from '../systems/dmath';
import type { Enemy } from './Enemy';
import type { Tower } from './Tower';

/** Distance from the tower center to the barrel tip, in tiles. */
const MUZZLE_OFFSET = 0.4;

/**
 * A shot in flight. Homing shots follow their target; if it dies first they fly to the last
 * known spot and fizzle. Splash shells fly to a fixed point and hit everything near it.
 */
export class Projectile {
  x: number;
  y: number;
  readonly startX: number;
  readonly startY: number;
  /** Where the shot is heading: the target's last known position, or the shell's landing point. */
  tx: number;
  ty: number;
  /** Unit direction of travel, for drawing the tracer. */
  dirX: number;
  dirY: number;
  readonly homing: boolean;
  done = false;

  constructor(
    readonly source: Tower,
    readonly target: Enemy,
    /** Fixed landing point for splash shells; omit for homing shots. */
    landing?: { x: number; y: number },
    /** Sideways offset of the muzzle in tiles (multi-barrel weapons). */
    muzzleSide = 0,
  ) {
    this.dirX = source.aimX;
    this.dirY = source.aimY;
    this.x = this.startX = source.x + this.dirX * MUZZLE_OFFSET - this.dirY * muzzleSide;
    this.y = this.startY = source.y + this.dirY * MUZZLE_OFFSET + this.dirX * muzzleSide;
    this.tx = landing?.x ?? target.x;
    this.ty = landing?.y ?? target.y;
    this.homing = !landing;
  }

  /** Splash radius in tiles, or 0 for single-target shots. */
  get splashRadius(): number {
    const a = this.source.stats.attack;
    return a.kind === 'splash' ? a.radius : 0;
  }

  /** 0 at launch, 1 on arrival. Used to draw the mortar arc. */
  get progress(): number {
    const total = dist(this.tx - this.startX, this.ty - this.startY);
    if (total < 1e-6) return 1;
    return 1 - dist(this.tx - this.x, this.ty - this.y) / total;
  }
}
