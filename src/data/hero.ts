/**
 * Heroes (maps with `heroStart` only). Heroes can't be hurt and have no mana: abilities only
 * cost a cooldown. They level up from kills near them. All tuning numbers live here; the rules
 * for each effect kind are in `Game.castHero` / `Game.updateHero`.
 */

import type { ElementId } from './elements';

export type HeroId =
  | 'vex' | 'mateo' | 'leila' | 'arjun' | 'echo'
  // Unlocked by clearing Core Nexus (map 7); each has a passive
  | 'kaito' | 'nalani' | 'ines' | 'rua' | 'zeynep'
  // Unlocked by clearing Overlink (multiplayer map 1); each has a new mechanic
  | 'linh' | 'baraka' | 'oksana' | 'killa' | 'pilar';

/**
 * What an ability does. `point` abilities are aimed at a spot; `self` ones center on the hero;
 * `global` ones need no aim. Damage numbers are at hero level 1.
 */
export type HeroEffect =
  /**
   * Damage everything within `radius`; optional stun (s) and shield strip. `zone` leaves a zone
   * behind (same spot and radius); `shatter` hits the same area again after `delay` s.
   */
  | {
      kind: 'blast'; radius: number; damage: number; stun?: number; stripShields?: boolean;
      zone?: { duration: number; slow?: number; dps?: number }; shatter?: { delay: number; damage: number };
    }
  /**
   * A zone on the ground for `duration` s: slows by `slow` (1 = stops them), deals `dps`, removes
   * armor and/or shields. `suppress`: enemies inside can't use their abilities. `towerRate`:
   * towers inside fire that much faster.
   */
  | {
      kind: 'zone'; radius: number; duration: number; slow?: number; dps?: number; armorBreak?: number; stripShields?: boolean;
      suppress?: boolean; towerRate?: number;
    }
  /** After `delay` s, damage everything within `radius`. */
  | { kind: 'strike'; radius: number; damage: number; delay: number }
  /** The hero leaps to the spot and damages everything within `radius` where it lands. */
  | { kind: 'dash'; radius: number; damage: number }
  /** For `duration` s the hero attacks `attackSpeed`× as fast and hits `damage`× as hard. */
  | { kind: 'buff'; duration: number; attackSpeed: number; damage: number }
  /** A shot from the hero toward the spot, hitting everything along `length` tiles (`width` wide); optional stun. */
  | { kind: 'pierce'; length: number; width: number; damage: number; stun?: number }
  /**
   * Enemies within `radius` take `amp` more damage from everything for `duration` s. With `burst`,
   * a marked enemy that dies in that time explodes (marked enemies caught in it can explode too).
   */
  | { kind: 'mark'; radius: number; duration: number; amp: number; burst?: { radius: number; damage: number } }
  /** Hit the `count` toughest enemies anywhere on the map (fixed damage; never an instant kill). */
  | { kind: 'snipe'; count: number; damage: number }
  /** Throw enemies within `radius` back `distance` tiles along their route. */
  | { kind: 'knockback'; radius: number; distance: number; damage: number }
  /** Lightning from the enemy nearest the spot, jumping up to `jumps` times, −`falloff` each jump. */
  | { kind: 'chain'; jumps: number; jumpRange: number; damage: number; falloff: number; stripShields?: boolean }
  /** Stun every enemy on the map for `duration` s; with `amp`, they then take that much more damage for `ampTime` s. */
  | { kind: 'freeze-all'; duration: number; damage: number; amp?: number; ampTime?: number }
  /** Place `count` turrets around the spot for `duration` s; each shoots on its own. */
  | { kind: 'summon'; count: number; duration: number; damage: number; fireRate: number; range: number }
  /** Towers within `radius` fire `fireRate`× as fast and/or deal `damage`× as much for `duration` s. */
  | { kind: 'tower-boost'; radius: number; duration: number; fireRate?: number; damage?: number }
  /** Restore `lives` lives to the core (never above the map's starting lives). */
  | { kind: 'repair'; lives: number }
  /** Enemies within `radius` (Infinity: the whole map) walk backward along their route for `duration` s. Bosses resist. */
  | { kind: 'reverse'; radius: number; duration: number; damage: number }
  /**
   * Drop `count` mines on the road (`spacing` tiles apart) where it passes nearest the spot, or,
   * with `global`, spread along the whole road. A mine blows when a ground enemy steps within
   * 0.45 tiles, hitting everything within `radius`; unused mines fade after `duration` s.
   */
  | { kind: 'mines'; count: number; damage: number; radius: number; duration: number; spacing: number; global?: boolean }
  /** Stick a bomb on the enemy nearest the spot; it rides along and goes off after `delay` s. */
  | { kind: 'sticky'; radius: number; damage: number; delay: number }
  /** `count` blasts in a line through the spot (along the hero's aim), `interval` s apart. */
  | { kind: 'barrage'; count: number; spacing: number; radius: number; damage: number; interval: number }
  /**
   * Latch onto the toughest enemy within `range` of the hero for `duration` s: `dps` that grows by
   * `ramp` each second; `hold` keeps it in place (not bosses or flyers). Re-latches if it dies.
   */
  | { kind: 'tether'; range: number; duration: number; dps: number; ramp: number; hold: boolean }
  /** The ground enemy nearest the core and the one farthest back trade places (not bosses). */
  | { kind: 'swap'; damage: number };

/**
 * Always-on hero effects (rules in `Game`: heroDamage, updateHero, hit, reward):
 * - finisher: the hero's hits deal `bonus` more damage to enemies at or below `threshold` of max HP.
 *   (No skill kills outright regardless of HP: everything deals damage.)
 * - slow-aura: enemies within `radius` tiles of the hero move `slow` slower (not Mirrors).
 * - tower-aura: towers within `radius` tiles of the hero deal `damage` more (0.2 = +20%).
 * - element-hits: the hero's hits apply its element's status effect at `power` (like a level-1 tower = 1).
 * - bounty: enemies dying within `radius` tiles of the hero pay `gold` more (0.3 = +30%).
 * - vulnerable-aura: enemies within `radius` tiles take `amp` more damage from everything.
 * - every-nth-stun: every `every`-th attack stuns everything it hits for `stun` s.
 * - crit-mult: the hero's critical hits deal `mult`× damage instead of 2×.
 * - death-burst: enemies the hero kills explode for `damage` to enemies within `radius` tiles
 *   (explosion kills don't explode again).
 * - tower-rate-aura: towers within `radius` tiles fire `rate` faster (0.15 = +15%).
 */
export type HeroPassiveEffect =
  /** Each enemy the hero kills cuts `seconds` off every ability cooldown. */
  | { kind: 'cooldown-on-kill'; seconds: number }
  /** Enemies the hero kills leave burning ground (`dps` for `duration` s in `radius`). */
  | { kind: 'death-zone'; radius: number; duration: number; dps: number }
  /** Enemies the hero hits take `amp` more damage from everything for `duration` s. */
  | { kind: 'mark-on-hit'; amp: number; duration: number }
  /** Ability cooldowns run `rate`× as fast while the hero stands still. */
  | { kind: 'still-recharge'; rate: number }
  /** Enemies within `radius` tiles of the hero lose `armor` armor. */
  | { kind: 'armor-aura'; radius: number; armor: number }
  | { kind: 'finisher'; threshold: number; bonus: number }
  | { kind: 'slow-aura'; radius: number; slow: number }
  | { kind: 'tower-aura'; radius: number; damage: number }
  | { kind: 'element-hits'; power: number }
  | { kind: 'bounty'; radius: number; gold: number }
  | { kind: 'vulnerable-aura'; radius: number; amp: number }
  | { kind: 'every-nth-stun'; every: number; stun: number }
  | { kind: 'crit-mult'; mult: number }
  | { kind: 'death-burst'; radius: number; damage: number }
  | { kind: 'tower-rate-aura'; radius: number; rate: number };

export interface HeroPassive {
  name: string;
  description: string;
  effect: HeroPassiveEffect;
}

export interface HeroAbilityDef {
  id: string;
  name: string;
  /** Hero level needed to learn it (Z X C: 1; the ultimate V: 6). */
  unlockLevel: number;
  /** Seconds between uses at level 1 (shorter as the hero levels up). */
  cooldown: number;
  target: 'point' | 'self' | 'global';
  /** Max distance from the hero to the aimed spot, in tiles (point abilities). */
  castRange: number;
  /** Area shown while aiming, in tiles. */
  aimRadius: number;
  effect: HeroEffect;
  description: string;
}

export interface HeroAttackDef {
  damage: number;
  fireRate: number;
  range: number;
  armorPierce: number;
  critChance: number;
  /** Melee: also hits enemies within this many tiles of the target. */
  cleave?: number;
  /** Magic: the bolt jumps to this many more enemies (−25% each jump). */
  chain?: number;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  /** Short call sign shown on the hero bar. */
  callsign: string;
  pronouns: string;
  race: string;
  origin: string;
  role: string;
  bio: string;
  /** Signature neon color. */
  color: string;
  /**
   * Element of every hit the hero deals (attacks, abilities, zones, drones). It uses the same
   * weakness cycle and battlefield shift as towers, but heroes apply no element status effects.
   */
  element: ElementId;
  /** Tiles per second. */
  speed: number;
  attack: HeroAttackDef;
  /** Four abilities used with Z X C V, learned with skill points (see SKILLS). */
  abilities: readonly [HeroAbilityDef, HeroAbilityDef, HeroAbilityDef, HeroAbilityDef];
  /** Always-on effect (every hero has one). */
  passive?: HeroPassive;
  /** Map id that must be cleared before this hero can be picked (always available if unset). */
  unlockedBy?: string;
}

/** Shared leveling rules for every hero. */
export const HERO_LEVELS = {
  /** Enemies dying within this many tiles of the hero count toward its level. */
  xpRadius: 3,
  /** Total nearby kills needed for levels 2, 3, … 10. */
  levelKills: [8, 20, 36, 56, 80, 110, 145, 185, 230],
  /** Per level above 1: damage +8% (attack and abilities), cooldowns −4%. */
  damagePerLevel: 0.08,
  cooldownPerLevel: 0.04,
} as const;

export const MAX_HERO_LEVEL = HERO_LEVELS.levelKills.length + 1;

/**
 * Skill points: the hero gets one per level (10 in all) and spends them to learn or upgrade
 * abilities. Z, X, C have three ranks; the numbers in the data are rank 3, lower ranks are
 * weaker. V (the ultimate) has one rank at full power and can be learned from its
 * `unlockLevel` (6). 3 + 3 + 3 + 1 = 10, so a level-10 hero has everything maxed.
 */
export const SKILLS = {
  basicRanks: 3,
  /** Hero level needed for rank 1, 2, 3 of a basic ability. */
  rankLevels: [1, 3, 5],
  /** Damage and bonuses at rank 1, 2, 3 (durations and stuns use the halfway point, e.g. 0.75 → 0.875). */
  rankPower: [0.75, 0.875, 1],
  /** Cooldown multiplier at rank 1, 2, 3. */
  rankCooldown: [1.1, 1.05, 1],
} as const;

/** Ranks an ability slot can reach: three for Z X C, one for the ultimate. */
export function maxRank(slot: number): number {
  return slot === 3 ? 1 : SKILLS.basicRanks;
}

/**
 * An ability's effect at a power (1 = the data, i.e. max rank): damage, damage over time, and
 * damage-taken bonuses scale with `power`; durations, stuns, and knockback distance with
 * (1 + power) / 2; buff and tower-boost bonuses scale their bonus part. Slows, radii, counts,
 * and delays don't change.
 */
export function scaleEffect<E extends HeroEffect>(effect: E, power: number): E {
  if (power === 1) return effect;
  const time = (1 + power) / 2;
  const out: Record<string, unknown> = { ...effect };
  const scale = (o: Record<string, unknown>) => {
    for (const key of ['damage', 'dps', 'amp']) if (typeof o[key] === 'number') o[key] = (o[key] as number) * power;
    for (const key of ['duration', 'stun', 'ampTime', 'distance']) if (typeof o[key] === 'number' && Number.isFinite(o[key])) o[key] = (o[key] as number) * time;
  };
  scale(out);
  for (const key of ['zone', 'shatter', 'burst']) if (out[key]) out[key] = { ...(out[key] as object) };
  for (const key of ['zone', 'shatter', 'burst']) if (out[key]) scale(out[key] as Record<string, unknown>);
  if (effect.kind === 'buff' || effect.kind === 'tower-boost') {
    for (const key of ['attackSpeed', 'fireRate', 'damage']) {
      const v = (effect as Record<string, unknown>)[key];
      if (typeof v === 'number') out[key] = 1 + (v - 1) * power;
    }
  }
  return out as E;
}

/** Ability keys, by slot. */
export const ABILITY_KEYS = ['Z', 'X', 'C', 'V'] as const;

export const HEROES: Record<HeroId, HeroDef> = {
  vex: {
    id: 'vex', name: 'Vex Adeyemi', callsign: 'Vex',
    pronouns: 'she/her', race: 'Human', origin: 'Lagos, Nigeria', role: 'Tactician',
    bio: 'A drone engineer who rewired a decommissioned defense satellite to answer only to her. Calm under fire, always three moves ahead.',
    color: '#ffe600', element: 'water', speed: 3,
    attack: { damage: 9, fireRate: 1.6, range: 2.6, armorPierce: 0.3, critChance: 0.1 },
    passive: {
      name: 'Spotter Uplink', effect: { kind: 'vulnerable-aura', radius: 2.5, amp: 0.15 },
      description: 'Her drones paint targets: enemies within 2.5 tiles of her take 15% more damage from everything.',
    },
    abilities: [
      {
        id: 'vex-pulse', name: 'Pulse Blast', unlockLevel: 1, cooldown: 7, target: 'point', castRange: 4.5, aimRadius: 1.4,
        effect: { kind: 'blast', radius: 1.4, damage: 65 },
        description: 'Blast every enemy in a small area near the hero.',
      },
      {
        id: 'vex-emp', name: 'EMP', unlockLevel: 1, cooldown: 16, target: 'self', castRange: 0, aimRadius: 2.6,
        effect: { kind: 'blast', radius: 2.6, damage: 25, stun: 1.5, stripShields: true },
        description: 'Stun everything around the hero for 1.5s and strip enemy shields.',
      },
      {
        id: 'vex-cryo', name: 'Cryo Field', unlockLevel: 1, cooldown: 22, target: 'point', castRange: 5.5, aimRadius: 2,
        effect: { kind: 'zone', radius: 2, duration: 6, slow: 0.5 },
        description: 'A freezing zone for 6s: enemies inside move 50% slower.',
      },
      {
        id: 'vex-orbital', name: 'Orbital Strike', unlockLevel: 6, cooldown: 55, target: 'point', castRange: Infinity, aimRadius: 2.2,
        effect: { kind: 'strike', radius: 2.2, damage: 520, delay: 1 },
        description: 'After 1s, a satellite beam hits anywhere on the map for massive damage.',
      },
    ],
  },
  mateo: {
    id: 'mateo', name: 'Mateo "Brick" Ruiz', callsign: 'Brick',
    pronouns: 'he/him', race: 'Cyborg', origin: 'Mexico City, Mexico', role: 'Melee',
    bio: 'A former demolition worker who kept the hydraulic arms after the job tried to replace him. Loud, loyal, and happiest in the middle of the crowd.',
    color: '#ff8a3d', element: 'earth', speed: 3.4,
    attack: { damage: 19, fireRate: 0.85, range: 1.1, armorPierce: 0.5, critChance: 0.1, cleave: 0.6 },
    passive: {
      name: 'Aftershock', effect: { kind: 'every-nth-stun', every: 3, stun: 0.6 },
      description: 'Every third punch stuns everything it hits for 0.6s.',
    },
    abilities: [
      {
        id: 'mateo-slam', name: 'Ground Slam', unlockLevel: 1, cooldown: 11, target: 'self', castRange: 0, aimRadius: 1.6,
        effect: { kind: 'blast', radius: 1.6, damage: 45, stun: 0.8 },
        description: 'Smash the ground: damage and stun everything around the hero for 0.8s.',
      },
      {
        id: 'mateo-leap', name: 'Rocket Leap', unlockLevel: 1, cooldown: 14, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'dash', radius: 1.4, damage: 55 },
        description: 'Rocket to a spot and crash down on everything there.',
      },
      {
        id: 'mateo-overdrive', name: 'Overdrive', unlockLevel: 1, cooldown: 25, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 6, attackSpeed: 1.8, damage: 1.3 },
        description: 'For 6s, punch 80% faster and 30% harder.',
      },
      {
        id: 'mateo-quake', name: 'Seismic Quake', unlockLevel: 6, cooldown: 55, target: 'self', castRange: 0, aimRadius: 3.5,
        effect: { kind: 'blast', radius: 3.5, damage: 150, stun: 2.5, stripShields: true },
        description: 'Split the street: huge damage around the hero, 2.5s stun, shields stripped.',
      },
    ],
  },
  leila: {
    id: 'leila', name: 'Leila Haddad', callsign: 'Leila',
    pronouns: 'she/her', race: 'Human (ocular implant)', origin: 'Beirut, Lebanon', role: 'Ranged',
    bio: 'A competition marksman whose implant reads wind, heat, and heartbeat. She counts every shot and rarely needs a second one.',
    color: '#ff6fae', element: 'metal', speed: 2.8,
    attack: { damage: 23, fireRate: 1, range: 4.5, armorPierce: 0.6, critChance: 0.2 },
    passive: {
      name: 'Headshot', effect: { kind: 'crit-mult', mult: 3 },
      description: 'Her critical hits deal 3× damage instead of 2×.',
    },
    abilities: [
      {
        id: 'leila-pierce', name: 'Piercing Round', unlockLevel: 1, cooldown: 7, target: 'point', castRange: 8, aimRadius: 0.5,
        effect: { kind: 'pierce', length: 8, width: 0.5, damage: 95 },
        description: 'A round that passes through everything in a straight line toward the spot.',
      },
      {
        id: 'leila-mark', name: 'Mark Target', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 6, aimRadius: 2,
        effect: { kind: 'mark', radius: 2, duration: 6, amp: 0.35 },
        description: 'Tag enemies in an area: they take 35% more damage from everything for 6s.',
      },
      {
        id: 'leila-rapid', name: 'Rapid Fire', unlockLevel: 1, cooldown: 20, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 5, attackSpeed: 3, damage: 1 },
        description: 'For 5s, fire three times as fast.',
      },
      {
        id: 'leila-headhunter', name: 'Headhunter', unlockLevel: 6, cooldown: 55, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'snipe', count: 6, damage: 380 },
        description: 'Six shots at the six toughest enemies anywhere on the map.',
      },
    ],
  },
  arjun: {
    id: 'arjun', name: 'Arjun Mehta', callsign: 'Arjun',
    pronouns: 'he/him', race: 'Hologram (uploaded mind)', origin: 'Mumbai, India', role: 'Mage',
    bio: 'A physics teacher who uploaded himself to keep his research alive. He now bends the city network like a lecture hall full of equations.',
    color: '#b388ff', element: 'fire', speed: 3,
    attack: { damage: 9, fireRate: 1.2, range: 3, armorPierce: 0.2, critChance: 0.05, chain: 2 },
    passive: {
      name: 'Combustion', effect: { kind: 'death-burst', radius: 1, damage: 12 },
      description: 'Enemies he kills explode, dealing 12 damage to enemies within 1 tile.',
    },
    abilities: [
      {
        id: 'arjun-firewall', name: 'Firewall', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 5, aimRadius: 1.6,
        effect: { kind: 'zone', radius: 1.6, duration: 5, dps: 26 },
        description: 'A burning code wall for 5s: 26 damage per second to everything inside.',
      },
      {
        id: 'arjun-gravity', name: 'Gravity Well', unlockLevel: 1, cooldown: 18, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'knockback', radius: 1.8, distance: 3, damage: 40 },
        description: 'Fold space: throw enemies in an area 3 tiles back along their route.',
      },
      {
        id: 'arjun-storm', name: 'Chain Storm', unlockLevel: 1, cooldown: 20, target: 'point', castRange: 5, aimRadius: 1.5,
        effect: { kind: 'chain', jumps: 9, jumpRange: 2.2, damage: 90, falloff: 0.08, stripShields: true },
        description: 'Lightning that jumps through up to 10 enemies near the spot and overloads their shields.',
      },
      {
        id: 'arjun-timelock', name: 'Time Lock', unlockLevel: 6, cooldown: 60, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'freeze-all', duration: 3.5, damage: 60 },
        description: 'Stop the clock: every enemy on the map is stunned for 3.5s.',
      },
    ],
  },
  echo: {
    id: 'echo', name: 'Echo', callsign: 'Echo',
    pronouns: 'they/them', race: 'Android', origin: 'Built in Seoul, South Korea', role: 'Summoner',
    bio: 'A maintenance android that taught itself to build. Echo names every drone it deploys and remembers each one that came back.',
    color: '#5dffb1', element: 'wood', speed: 3.2,
    attack: { damage: 8, fireRate: 2.2, range: 2.8, armorPierce: 0.2, critChance: 0.05 },
    passive: {
      name: 'Auto-Loader', effect: { kind: 'tower-rate-aura', radius: 2.5, rate: 0.15 },
      description: 'Towers within 2.5 tiles of Echo fire 15% faster.',
    },
    abilities: [
      {
        id: 'echo-drone', name: 'Deploy Drone', unlockLevel: 1, cooldown: 12, target: 'point', castRange: 4, aimRadius: 2.5,
        effect: { kind: 'summon', count: 1, duration: 12, damage: 20, fireRate: 2, range: 2.5 },
        description: 'Place a combat drone for 12s that shoots on its own.',
      },
      {
        id: 'echo-overclock', name: 'Overclock Towers', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 6, aimRadius: 3.5,
        effect: { kind: 'tower-boost', radius: 3.5, duration: 8, fireRate: 2 },
        description: 'Towers in an area fire twice as fast for 8s.',
      },
      {
        id: 'echo-nanites', name: 'Nanite Cloud', unlockLevel: 1, cooldown: 22, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'zone', radius: 1.8, duration: 6, dps: 25, armorBreak: 4, stripShields: true },
        description: 'A nanite cloud for 6s: 25 damage per second, −4 armor, and shields eaten away.',
      },
      {
        id: 'echo-swarm', name: 'Drone Swarm', unlockLevel: 6, cooldown: 60, target: 'point', castRange: 6, aimRadius: 2.5,
        effect: { kind: 'summon', count: 4, duration: 15, damage: 26, fireRate: 2, range: 2.8 },
        description: 'Deploy four heavy drones around the spot for 15s.',
      },
    ],
  },

  // --- Second roster: unlocked by clearing Core Nexus, each with a passive ---
  kaito: {
    id: 'kaito', name: 'Kaito "Ronin" Sato', callsign: 'Ronin',
    pronouns: 'he/him', race: 'Human (cybernetic arm)', origin: 'Osaka, Japan', role: 'Duelist',
    bio: 'A kendo champion who lost his arm to a factory press and rebuilt it with a monoblade inside. Quiet, exact, and never wastes a cut.',
    color: '#e6ecff', element: 'metal', speed: 3.6, unlockedBy: 'core-nexus',
    attack: { damage: 19, fireRate: 1.1, range: 1.2, armorPierce: 0.5, critChance: 0.2 },
    passive: {
      name: 'Finisher', effect: { kind: 'finisher', threshold: 0.3, bonus: 0.6 },
      description: 'His hits deal 60% more damage to enemies below 30% HP.',
    },
    abilities: [
      {
        id: 'kaito-step', name: 'Flash Step', unlockLevel: 1, cooldown: 9, target: 'point', castRange: 4.5, aimRadius: 1,
        effect: { kind: 'dash', radius: 1, damage: 85 },
        description: 'Blink to a spot and cut everything around where he lands.',
      },
      {
        id: 'kaito-iaido', name: 'Iaido', unlockLevel: 1, cooldown: 12, target: 'point', castRange: 5, aimRadius: 0.6,
        effect: { kind: 'pierce', length: 5, width: 0.6, damage: 115 },
        description: 'One quick-draw slash that cuts through everything in a 5-tile line.',
      },
      {
        id: 'kaito-dance', name: 'Blade Dance', unlockLevel: 1, cooldown: 22, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 6, attackSpeed: 2.2, damage: 1.2 },
        description: 'For 6s, strike 2.2× as fast and 20% harder.',
      },
      {
        id: 'kaito-cuts', name: 'Thousand Cuts', unlockLevel: 6, cooldown: 55, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'snipe', count: 8, damage: 240 },
        description: 'Eight strikes at the eight toughest enemies anywhere on the map.',
      },
    ],
  },
  nalani: {
    id: 'nalani', name: 'Nalani "Tide" Kahale', callsign: 'Tide',
    pronouns: 'she/her', race: 'Human (deep-dive rig)', origin: 'Honolulu, Hawaiʻi', role: 'Controller',
    bio: 'A salvage diver who learned to move whole currents with a pressure rig built for the ocean floor. Patient, playful, and impossible to rush.',
    color: '#3ab8ff', element: 'water', speed: 3, unlockedBy: 'core-nexus',
    attack: { damage: 6, fireRate: 1.4, range: 3, armorPierce: 0.2, critChance: 0.05 },
    passive: {
      name: 'Undertow', effect: { kind: 'slow-aura', radius: 2.5, slow: 0.3 },
      description: 'Enemies within 2.5 tiles of her move 30% slower.',
    },
    abilities: [
      {
        id: 'nalani-riptide', name: 'Riptide', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 5, aimRadius: 1.6,
        effect: { kind: 'zone', radius: 1.6, duration: 6, slow: 0.45, dps: 14 },
        description: 'A churning pool for 6s: enemies inside move 45% slower and take 14 damage per second.',
      },
      {
        id: 'nalani-wave', name: 'Rogue Wave', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'knockback', radius: 1.8, distance: 2.5, damage: 45 },
        description: 'A wall of water that washes enemies in an area 2.5 tiles back along their route.',
      },
      {
        id: 'nalani-dive', name: 'Pressure Dive', unlockLevel: 1, cooldown: 18, target: 'self', castRange: 0, aimRadius: 2.2,
        effect: { kind: 'blast', radius: 2.2, damage: 50, stun: 1 },
        description: 'Slam a pressure wave around her: damage and a 1s stun.',
      },
      {
        id: 'nalani-tsunami', name: 'Tsunami', unlockLevel: 6, cooldown: 55, target: 'point', castRange: Infinity, aimRadius: 3,
        effect: { kind: 'strike', radius: 3, damage: 320, delay: 1.5 },
        description: 'After 1.5s, a huge wave crashes down on a wide area anywhere on the map.',
      },
    ],
  },
  ines: {
    id: 'ines', name: 'Inês "Forge" Duarte', callsign: 'Forge',
    pronouns: 'she/her', race: 'Human (exo-frame)', origin: 'São Paulo, Brazil', role: 'Engineer',
    bio: 'A street mechanic who tunes turrets the way other people tune engines. Wherever she stands, the defenses run hotter.',
    color: '#f5d08a', element: 'earth', speed: 2.9, unlockedBy: 'core-nexus',
    attack: { damage: 13, fireRate: 1, range: 2.6, armorPierce: 0.3, critChance: 0.05 },
    passive: {
      name: 'Field Engineer', effect: { kind: 'tower-aura', radius: 3, damage: 0.2 },
      description: 'Towers within 3 tiles of her deal 20% more damage.',
    },
    abilities: [
      {
        id: 'ines-charge', name: 'Seismic Charge', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 4.5, aimRadius: 1.5,
        effect: { kind: 'blast', radius: 1.5, damage: 55, stun: 0.6 },
        description: 'Throw a charge that damages and briefly stuns everything in a small area.',
      },
      {
        id: 'ines-surge', name: 'Power Surge', unlockLevel: 1, cooldown: 18, target: 'point', castRange: 6, aimRadius: 3.5,
        effect: { kind: 'tower-boost', radius: 3.5, duration: 8, damage: 1.4 },
        description: 'Towers in an area deal 40% more damage for 8s.',
      },
      {
        id: 'ines-barricade', name: 'Barricade', unlockLevel: 1, cooldown: 20, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'zone', radius: 1.4, duration: 7, slow: 0.6, armorBreak: 3 },
        description: 'Drop scrap barriers for 7s: enemies inside move 60% slower and lose 3 armor.',
      },
      {
        id: 'ines-patch', name: 'Core Patch', unlockLevel: 6, cooldown: 90, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'repair', lives: 4 },
        description: 'Patch the data core: restore 4 lives (up to the starting amount).',
      },
    ],
  },
  rua: {
    id: 'rua', name: 'Rua Tane', callsign: 'Rua',
    pronouns: 'he/him', race: 'Human (bio-grafts)', origin: 'Tāmaki Makaurau (Auckland), Aotearoa New Zealand', role: 'Grower',
    bio: 'A botanist who grafted a living circuit garden into his own skin. Where he walks, the concrete cracks and something green comes through.',
    color: '#a6ff4d', element: 'wood', speed: 3, unlockedBy: 'core-nexus',
    attack: { damage: 5, fireRate: 1.5, range: 3, armorPierce: 0.1, critChance: 0.05, chain: 1 },
    passive: {
      name: 'Overgrowth', effect: { kind: 'element-hits', power: 1 },
      description: 'His hits root ground enemies and poison them, just like a Wood tower (other heroes apply no effects).',
    },
    abilities: [
      {
        id: 'rua-thorns', name: 'Thorn Burst', unlockLevel: 1, cooldown: 8, target: 'point', castRange: 4.5, aimRadius: 1.4,
        effect: { kind: 'blast', radius: 1.4, damage: 50 },
        description: 'Thorns burst out of the ground in a small area.',
      },
      {
        id: 'rua-bramble', name: 'Bramble Field', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'zone', radius: 1.8, duration: 6, slow: 0.35, dps: 18 },
        description: 'A bramble patch for 6s: enemies inside move 35% slower and take 18 damage per second.',
      },
      {
        id: 'rua-spores', name: 'Spore Cloud', unlockLevel: 1, cooldown: 18, target: 'point', castRange: 6, aimRadius: 2.2,
        effect: { kind: 'mark', radius: 2.2, duration: 6, amp: 0.3 },
        description: 'Spores cling to enemies in an area: they take 30% more damage from everything for 6s.',
      },
      {
        id: 'rua-worldroot', name: 'Worldroot', unlockLevel: 6, cooldown: 55, target: 'point', castRange: 6, aimRadius: 3.2,
        effect: { kind: 'zone', radius: 3.2, duration: 8, slow: 0.7, dps: 30, armorBreak: 4 },
        description: 'Giant roots erupt for 8s: enemies in a wide area move 70% slower, take 30 damage per second, and lose 4 armor.',
      },
    ],
  },
  zeynep: {
    id: 'zeynep', name: 'Zeynep "Flare" Demir', callsign: 'Flare',
    pronouns: 'she/her', race: 'Human (pyro rig)', origin: 'Istanbul, Türkiye', role: 'Bounty Hunter',
    bio: 'A contract hunter who works the rooftops for whoever pays best this week. Every drone she drops comes with a receipt.',
    color: '#ff5d3a', element: 'fire', speed: 3.1, unlockedBy: 'core-nexus',
    attack: { damage: 13, fireRate: 1.2, range: 3.2, armorPierce: 0.3, critChance: 0.15 },
    passive: {
      name: 'Bounty', effect: { kind: 'bounty', radius: 3, gold: 0.3 },
      description: 'Enemies that die within 3 tiles of her pay 30% more gold.',
    },
    abilities: [
      {
        id: 'zeynep-napalm', name: 'Napalm', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'zone', radius: 1.4, duration: 4, dps: 30 },
        description: 'Burning fuel for 4s: 30 damage per second to everything inside.',
      },
      {
        id: 'zeynep-flash', name: 'Flashbang', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 5, aimRadius: 2,
        effect: { kind: 'blast', radius: 2, damage: 20, stun: 1.2 },
        description: 'A blinding flash that stuns everything in an area for 1.2s.',
      },
      {
        id: 'zeynep-incendiary', name: 'Incendiary Rounds', unlockLevel: 1, cooldown: 22, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 7, attackSpeed: 1.6, damage: 1.6 },
        description: 'For 7s, shoot 60% faster and 60% harder.',
      },
      {
        id: 'zeynep-sunfall', name: 'Sunfall', unlockLevel: 6, cooldown: 55, target: 'point', castRange: Infinity, aimRadius: 2.4,
        effect: { kind: 'strike', radius: 2.4, damage: 420, delay: 1.2 },
        description: 'After 1.2s, a column of fire hits anywhere on the map.',
      },
    ],
  },

  // --- Third roster: unlocked by clearing Overlink, each built on a new mechanic ---
  linh: {
    id: 'linh', name: 'Linh "Glitch" Trần', callsign: 'Glitch',
    pronouns: 'she/her', race: 'Human (neural jack)', origin: 'Hồ Chí Minh City, Việt Nam', role: 'Hacker',
    bio: "A street hacker from Saigon's neon alleys who was rewriting drone firmware at fourteen. She doesn't fight the machines; she talks them into turning around.",
    color: '#ff38f0', element: 'metal', speed: 3.2, unlockedBy: 'overlink',
    attack: { damage: 10, fireRate: 1.4, range: 3, armorPierce: 0.4, critChance: 0.1 },
    passive: {
      name: 'Backdoor', effect: { kind: 'cooldown-on-kill', seconds: 0.5 },
      description: 'Every enemy she finishes off cuts 0.5s from all her cooldowns.',
    },
    abilities: [
      {
        id: 'linh-reprogram', name: 'Reprogram', unlockLevel: 1, cooldown: 12, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'reverse', radius: 1.4, duration: 2.5, damage: 25 },
        description: 'Hack the enemies in a small area: they walk backward along their route for 2.5s. Bosses resist.',
      },
      {
        id: 'linh-dos', name: 'Denial of Service', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'zone', radius: 1.8, duration: 6, slow: 0.25, suppress: true },
        description: 'Flood an area with junk data for 6s: enemies inside move 25% slower and their abilities shut off (no heals, blinks, burrowing, auras, or jamming; hidden enemies are exposed).',
      },
      {
        id: 'linh-logicbomb', name: 'Logic Bomb', unlockLevel: 1, cooldown: 18, target: 'point', castRange: 5.5, aimRadius: 2,
        effect: { kind: 'mark', radius: 2, duration: 6, amp: 0.15, burst: { radius: 1.2, damage: 35 } },
        description: 'Plant code in enemies in an area for 6s: they take 15% more damage, and any that die explode (which can set off the others).',
      },
      {
        id: 'linh-zeroday', name: 'Zero Day', unlockLevel: 6, cooldown: 55, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'reverse', radius: Infinity, duration: 2, damage: 50 },
        description: 'An exploit nobody patched: every enemy on the map takes damage and walks backward for 2s. Bosses resist.',
      },
    ],
  },
  baraka: {
    id: 'baraka', name: 'Baraka "Fuse" Otieno', callsign: 'Fuse',
    pronouns: 'he/him', race: 'Human (blast plating)', origin: 'Nairobi, Kenya', role: 'Demolitionist',
    bio: 'A former mining engineer who knows exactly how much charge it takes to move a mountain, and exactly how little. Cheerful, careful, and always counting down.',
    color: '#ff2f55', element: 'fire', speed: 2.9, unlockedBy: 'overlink',
    attack: { damage: 12, fireRate: 0.9, range: 3.2, armorPierce: 0.2, critChance: 0.05, cleave: 0.8 },
    passive: {
      name: 'Scorched Earth', effect: { kind: 'death-zone', radius: 0.8, duration: 2, dps: 8 },
      description: 'Enemies he kills leave burning ground for 2s (8 damage per second).',
    },
    abilities: [
      {
        id: 'baraka-mines', name: 'Proximity Mines', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 6, aimRadius: 1.2,
        effect: { kind: 'mines', count: 3, damage: 45, radius: 1, duration: 25, spacing: 1 },
        description: 'Drop three mines on the road nearest the spot. Each blows when a ground enemy steps on it.',
      },
      {
        id: 'baraka-sticky', name: 'Sticky Bomb', unlockLevel: 1, cooldown: 14, target: 'point', castRange: 6, aimRadius: 1.3,
        effect: { kind: 'sticky', radius: 1.3, damage: 110, delay: 1.5 },
        description: 'Stick a bomb on the enemy nearest the spot. It rides along for 1.5s, then goes off.',
      },
      {
        id: 'baraka-carpet', name: 'Carpet Bomb', unlockLevel: 1, cooldown: 18, target: 'point', castRange: 6, aimRadius: 0.9,
        effect: { kind: 'barrage', count: 5, spacing: 1, radius: 0.9, damage: 35, interval: 0.2 },
        description: 'Five blasts walk along a line through the spot, one after another.',
      },
      {
        id: 'baraka-demolition', name: 'Demolition Run', unlockLevel: 6, cooldown: 55, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'mines', count: 8, damage: 100, radius: 1.2, duration: 30, spacing: 0, global: true },
        description: 'Wire the whole road: eight heavy mines spread from the portal to the core.',
      },
    ],
  },
  oksana: {
    id: 'oksana', name: 'Oksana "Stasis" Kovalenko', callsign: 'Stasis',
    pronouns: 'she/her', race: 'Human (cryo-lattice)', origin: 'Kyiv, Ukraine', role: 'Chronomancer',
    bio: 'A cryo-physicist whose slowed-time experiment went sideways and left her able to bend a few seconds at will. Precise, patient, and dryly funny about it.',
    color: '#a8f0ff', element: 'water', speed: 3, unlockedBy: 'overlink',
    attack: { damage: 14, fireRate: 1.5, range: 3, armorPierce: 0.2, critChance: 0.05 },
    passive: {
      name: 'Brittle', effect: { kind: 'mark-on-hit', amp: 0.15, duration: 2 },
      description: 'Enemies she hits take 15% more damage from everything for 2s.',
    },
    abilities: [
      {
        id: 'oksana-wall', name: 'Glacier Wall', unlockLevel: 1, cooldown: 11, target: 'point', castRange: 5, aimRadius: 0.9,
        effect: { kind: 'zone', radius: 0.9, duration: 2.5, slow: 1 },
        description: 'Raise a wall of ice on the road: enemies that reach it are stopped for 2.5s.',
      },
      {
        id: 'oksana-flash', name: 'Flash Freeze', unlockLevel: 1, cooldown: 16, target: 'point', castRange: 5, aimRadius: 1.6,
        effect: { kind: 'blast', radius: 1.6, damage: 20, stun: 1.5, shatter: { delay: 1.5, damage: 130 } },
        description: 'Freeze enemies in an area solid for 1.5s, then shatter them for heavy damage.',
      },
      {
        id: 'oksana-dilation', name: 'Time Dilation', unlockLevel: 1, cooldown: 20, target: 'point', castRange: 6, aimRadius: 2.2,
        effect: { kind: 'zone', radius: 2.2, duration: 6, slow: 0.4, towerRate: 1.4 },
        description: 'Bend time in an area for 6s: enemies inside move 40% slower while towers inside fire 40% faster.',
      },
      {
        id: 'oksana-zero', name: 'Absolute Zero', unlockLevel: 6, cooldown: 60, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'freeze-all', duration: 2, damage: 70, amp: 0.25, ampTime: 6 },
        description: 'Freeze every enemy on the map for 2s; they stay brittle, taking 25% more damage for 6s.',
      },
    ],
  },
  killa: {
    id: 'killa', name: 'Killa "Canopy" Mamani', callsign: 'Canopy',
    pronouns: 'they/them', race: 'Human (mycelium lace)', origin: 'Cusco, Peru', role: 'Symbiont',
    bio: 'A forest guardian from the Andes who wove a living fungal network through their nerves. They talk to towers the way gardeners talk to plants, and the towers listen.',
    color: '#14c9a0', element: 'wood', speed: 3, unlockedBy: 'overlink',
    attack: { damage: 10, fireRate: 1.6, range: 3.4, armorPierce: 0.1, critChance: 0.05 },
    passive: {
      name: 'Photosynthesis', effect: { kind: 'still-recharge', rate: 1.35 },
      description: 'While they stand still, their abilities recharge 35% faster.',
    },
    abilities: [
      {
        id: 'killa-vine', name: 'Strangler Vine', unlockLevel: 1, cooldown: 12, target: 'self', castRange: 0, aimRadius: 4.5,
        effect: { kind: 'tether', range: 4.5, duration: 5, dps: 30, ramp: 0.25, hold: true },
        description: 'A vine latches onto the toughest enemy within 4.5 tiles for 5s, holding it in place and squeezing harder every second. Bosses and flyers are not held.',
      },
      {
        id: 'killa-seed', name: 'Seed Bomb', unlockLevel: 1, cooldown: 14, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'blast', radius: 1.4, damage: 60, zone: { duration: 4, slow: 0.3, dps: 18 } },
        description: 'A seed pod bursts in an area and sprouts brambles for 4s: 30% slower and 18 damage per second.',
      },
      {
        id: 'killa-symbiosis', name: 'Symbiosis', unlockLevel: 1, cooldown: 20, target: 'point', castRange: 6, aimRadius: 2.5,
        effect: { kind: 'tower-boost', radius: 2.5, duration: 8, fireRate: 1.35, damage: 1.15 },
        description: 'Grow into the towers in an area for 8s: they fire 35% faster and hit 15% harder.',
      },
      {
        id: 'killa-bloom', name: 'Great Bloom', unlockLevel: 6, cooldown: 60, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'tower-boost', radius: Infinity, duration: 8, damage: 1.25 },
        description: 'The whole network blooms: every tower on the map deals 25% more damage for 8s.',
      },
    ],
  },
  pilar: {
    id: 'pilar', name: 'Pilar "Atlas" Villanueva', callsign: 'Atlas',
    pronouns: 'she/her', race: 'Cyborg (graviton spine)', origin: 'Manila, Philippines', role: 'Gravity Warden',
    bio: 'A crane operator who came out of a site accident with a graviton spine fused to her back. Steady as bedrock, and when the street moves too fast, she moves the street.',
    color: '#7f7bff', element: 'earth', speed: 2.8, unlockedBy: 'overlink',
    attack: { damage: 27, fireRate: 0.75, range: 1.3, armorPierce: 0.5, critChance: 0.1, cleave: 0.7 },
    passive: {
      name: 'Heavy Footing', effect: { kind: 'armor-aura', radius: 2, armor: 3 },
      description: 'Enemies within 2 tiles of her lose 3 armor.',
    },
    abilities: [
      {
        id: 'pilar-fault', name: 'Fault Line', unlockLevel: 1, cooldown: 9, target: 'point', castRange: 5, aimRadius: 0.7,
        effect: { kind: 'pierce', length: 5, width: 0.7, damage: 90, stun: 0.5 },
        description: 'Crack the ground in a 5-tile line: damage and a 0.5s stun to everything on it.',
      },
      {
        id: 'pilar-drift', name: 'Continental Drift', unlockLevel: 1, cooldown: 22, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'swap', damage: 50 },
        description: 'The ground enemy closest to the core and the one farthest back trade places, and both take damage. Bosses can\'t be moved.',
      },
      {
        id: 'pilar-anchor', name: 'Gravity Anchor', unlockLevel: 1, cooldown: 18, target: 'point', castRange: 5, aimRadius: 1.5,
        effect: { kind: 'zone', radius: 1.5, duration: 5, slow: 0.55, armorBreak: 4 },
        description: 'Crank up gravity in an area for 5s: enemies inside move 55% slower and lose 4 armor.',
      },
      {
        id: 'pilar-upheaval', name: 'Upheaval', unlockLevel: 6, cooldown: 55, target: 'point', castRange: 6, aimRadius: 2.4,
        effect: { kind: 'blast', radius: 2.4, damage: 280, zone: { duration: 3, slow: 1 } },
        description: 'Raise a mountain from the road: heavy damage in a wide area, and the rock stops everything there for 3s.',
      },
    ],
  },
};

export const HERO_IDS = Object.keys(HEROES) as HeroId[];

/** How long an ability's effect lasts after a cast, for countdown displays (0.4 for instant ones). */
export function effectLength(effect: HeroEffect): number {
  switch (effect.kind) {
    case 'zone':
    case 'buff':
    case 'mark':
    case 'freeze-all':
    case 'summon':
    case 'tower-boost':
      return effect.duration;
    case 'repair':
      return 0;
    case 'reverse':
    case 'mines':
    case 'tether':
      return effect.duration;
    case 'strike':
    case 'sticky':
      return effect.delay;
    case 'barrage':
      return 0.4 + effect.count * effect.interval;
    case 'blast':
      return effect.stun ?? 0.4;
    default:
      return 0.4;
  }
}
