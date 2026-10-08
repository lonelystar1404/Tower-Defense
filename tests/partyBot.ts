import type { ElementId } from '../src/data/elements';
import type { HeroId } from '../src/data/hero';
import type { LevelDef } from '../src/data/levels';
import { BUILD_ELEMENTS, towerStats, type TowerOption } from '../src/data/towers';
import type { WeaponId } from '../src/data/weapons';
import { Game } from '../src/game/Game';
import { seededRng } from '../src/systems/rng';

const STEP = 1 / 60;

const tower = (weapon: WeaponId, element: ElementId): TowerOption => ({ weapon, element });

/** The mixed weapon plan from the single-player balance tests (an element per job). */
export const MIXED_PLAN: TowerOption[] = [
  tower('cannon', 'earth'), tower('multi', 'water'), tower('mortar', 'fire'), tower('flak', 'metal'),
  tower('cannon', 'metal'), tower('chain', 'wood'), tower('flak', 'water'), tower('sniper', 'metal'),
];

/** Route samples (every 0.1 tile) a new tower must cover to be worth building. */
const MIN_USEFUL_COVERAGE = 40;

function coverage(game: Game, col: number, row: number, option: TowerOption): number {
  const { range, targets } = towerStats(option);
  let n = 0;
  for (const [movement, route] of [['ground', game.path], ['air', game.airPath]] as const) {
    if (!targets.includes(movement)) continue;
    for (let d = 0; d < route.length; d += 0.1) {
      const p = route.pointAt(d);
      if ((p.x - col - 0.5) ** 2 + (p.y - row - 0.5) ** 2 <= range * range) n++;
    }
  }
  return n;
}

/** The single-player hero AI from tests/game.test.ts, for any player's hero. */
export function heroAI(game: Game, player: number): void {
  const hero = game.players[player].hero!;
  const alive = game.enemies.filter((e) => e.alive && !e.hidden);
  if (alive.length === 0) return;
  const near = (x: number, y: number, r: number) => alive.filter((e) => Math.hypot(e.x - x, e.y - y) <= r);
  const lead = (reach: number) => near(hero.x, hero.y, reach).sort((a, b) => a.remaining - b.remaining)[0];
  if (hero.def.attack.range < 2) {
    const target = lead(6);
    if (target) game.moveHero(target.x, target.y, player);
  }
  hero.def.abilities.forEach((a, slot) => {
    if (!game.heroAbilityReady(slot, player)) return;
    const eff = a.effect;
    if (eff.kind === 'repair') {
      if (game.lives <= game.level.lives - 3) game.castHero(slot, 0, 0, player);
    } else if (a.target === 'global') {
      if (alive.length >= 4) game.castHero(slot, 0, 0, player);
    } else if (a.target === 'self') {
      if (eff.kind === 'buff') {
        if (near(hero.x, hero.y, hero.def.attack.range).length > 0) game.castHero(slot, 0, 0, player);
      } else if (near(hero.x, hero.y, a.aimRadius).length >= 3) game.castHero(slot, 0, 0, player);
    } else if (eff.kind === 'strike') {
      const crowd = (e: (typeof alive)[number]) => near(e.x, e.y, a.aimRadius).length;
      const best = [...alive].sort((x, y) => crowd(y) - crowd(x))[0];
      if (crowd(best) >= 4) game.castHero(slot, best.x, best.y, player);
    } else {
      const t = lead(a.castRange);
      if (t && (eff.kind !== 'knockback' || t.remaining < 8)) game.castHero(slot, t.x, t.y, player);
    }
  });
}

/**
 * Plays a whole map with one player per hero (a single hero = Single mode, no party). Before each
 * wave every player, in turn, buys towers from the plan with their own gold (each starts at a
 * different point in the plan), each on the free tile that covers the most route. Once no tile
 * is worth a tower, they spend their gold upgrading their own towers, lowest level first.
 */
export function playParty(level: LevelDef, seed: number, heroes: HeroId[], plan = MIXED_PLAN): Game {
  const game = heroes.length > 1
    ? new Game(level, seededRng(seed), heroes[0], { party: { heroes } })
    : new Game(level, seededRng(seed), heroes[0]);
  const next = game.players.map((_, i) => i * 2);
  while (!game.over) {
    let mapFull = false;
    for (let progress = true; progress && !mapFull; ) {
      progress = false;
      for (let p = 0; p < game.players.length; p++) {
        const planned = plan[next[p] % plan.length];
        const element = game.isLocked(planned)
          ? BUILD_ELEMENTS.find((e) => !game.isLocked({ weapon: planned.weapon, element: e }))!
          : planned.element;
        const option = { weapon: planned.weapon, element };
        let best: [number, number] | null = null;
        let bestScore = 0;
        for (let r = 0; r < level.rows; r++) {
          for (let c = 0; c < level.cols; c++) {
            if (!game.canBuild(c, r)) continue;
            const s = coverage(game, c, r, option);
            if (s > bestScore) {
              bestScore = s;
              best = [c, r];
            }
          }
        }
        if (!best || bestScore < MIN_USEFUL_COVERAGE) {
          mapFull = true;
          break;
        }
        if (game.build(best[0], best[1], option, p)) {
          next[p]++;
          progress = true;
        }
      }
    }
    if (mapFull) {
      for (let p = 0; p < game.players.length; p++) {
        for (;;) {
          const t = game.towers
            .filter((tw) => tw.owner === p && game.nextUpgradeCost(tw) !== null && !game.isLocked(tw))
            .sort((a, b) => a.level - b.level)[0];
          if (!t || !game.upgrade(t, p)) break;
        }
      }
    }
    game.startWave();
    for (let i = 0; i < 60 * 600 && game.phase === 'wave'; i++) {
      game.update(STEP);
      if (i % 15 === 0) for (let p = 0; p < game.players.length; p++) if (game.players[p].hero) heroAI(game, p);
    }
  }
  return game;
}
