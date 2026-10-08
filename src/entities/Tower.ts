import type { ElementId } from '../data/elements';
import { towerStats, type TowerOption, type TowerStats } from '../data/towers';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { TargetPriority } from '../systems/targeting';

let nextId = 1;

export class Tower {
  readonly id = nextId++;
  readonly weapon: WeaponId;
  readonly element: ElementId;
  /** Current stats for `level`; replaced on upgrade. */
  stats: TowerStats;
  /** Center in tile units. */
  readonly x: number;
  readonly y: number;
  level = 1;
  /** Total gold spent on this tower (build + upgrades), used for the sell refund. */
  spent: number;
  priority: TargetPriority;
  /** Seconds until the next shot. */
  cooldown = 0;
  /** Barrel angle in radians (0 = pointing right). */
  angle = -Math.PI / 2;
  /** 1 right after firing, decays to 0; drives the barrel kick animation. */
  recoil = 0;
  /** Overclocked by a hero (Echo): recharges `boostMult`× as fast while `boostTime` > 0. */
  boostTime = 0;
  boostMult = 1;
  /** Knocked out by a Disruptor: doesn't aim, recharge, or fire while > 0. */
  disabledTime = 0;

  constructor(readonly col: number, readonly row: number, option: TowerOption, cost: number) {
    this.weapon = option.weapon;
    this.element = option.element;
    this.stats = towerStats(option);
    this.x = col + 0.5;
    this.y = row + 0.5;
    this.spent = cost;
    this.priority = WEAPONS[option.weapon].defaultPriority;
  }
}
