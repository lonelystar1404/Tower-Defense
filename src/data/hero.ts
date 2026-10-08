/**
 * Heroes (maps with `heroStart` only). Heroes can't be hurt and have no mana: abilities only
 * cost a cooldown. They level up from kills near them. All tuning numbers live here; the rules
 * for each effect kind are in `Game.castHero` / `Game.updateHero`.
 */

import type { ElementId } from './elements';

export type HeroId =
  | 'vex' | 'mateo' | 'leila' | 'arjun' | 'echo'
  // Unlocked by clearing Core Nexus (map 7); each has a passive
  | 'kaito' | 'nalani' | 'ines' | 'rua' | 'zeynep';

/**
 * What an ability does. `point` abilities are aimed at a spot; `self` ones center on the hero;
 * `global` ones need no aim. Damage numbers are at hero level 1.
 */
export type HeroEffect =
  /** Damage everything within `radius`; optional stun (s) and shield strip. */
  | { kind: 'blast'; radius: number; damage: number; stun?: number; stripShields?: boolean }
  /** A zone on the ground for `duration` s: slows by `slow`, deals `dps`, removes armor and/or shields. */
  | { kind: 'zone'; radius: number; duration: number; slow?: number; dps?: number; armorBreak?: number; stripShields?: boolean }
  /** After `delay` s, damage everything within `radius`. */
  | { kind: 'strike'; radius: number; damage: number; delay: number }
  /** The hero leaps to the spot and damages everything within `radius` where it lands. */
  | { kind: 'dash'; radius: number; damage: number }
  /** For `duration` s the hero attacks `attackSpeed`× as fast and hits `damage`× as hard. */
  | { kind: 'buff'; duration: number; attackSpeed: number; damage: number }
  /** A shot from the hero toward the spot, hitting everything along `length` tiles (`width` wide). */
  | { kind: 'pierce'; length: number; width: number; damage: number }
  /** Enemies within `radius` take `amp` more damage from everything for `duration` s. */
  | { kind: 'mark'; radius: number; duration: number; amp: number }
  /** Hit the `count` toughest enemies anywhere on the map. */
  | { kind: 'execute'; count: number; damage: number }
  /** Throw enemies within `radius` back `distance` tiles along their route. */
  | { kind: 'knockback'; radius: number; distance: number; damage: number }
  /** Lightning from the enemy nearest the spot, jumping up to `jumps` times, −`falloff` each jump. */
  | { kind: 'chain'; jumps: number; jumpRange: number; damage: number; falloff: number; stripShields?: boolean }
  /** Stun every enemy on the map for `duration` s. */
  | { kind: 'freeze-all'; duration: number; damage: number }
  /** Place `count` turrets around the spot for `duration` s; each shoots on its own. */
  | { kind: 'summon'; count: number; duration: number; damage: number; fireRate: number; range: number }
  /** Towers within `radius` fire `fireRate`× as fast and/or deal `damage`× as much for `duration` s. */
  | { kind: 'tower-boost'; radius: number; duration: number; fireRate?: number; damage?: number }
  /** Restore `lives` lives to the core (never above the map's starting lives). */
  | { kind: 'repair'; lives: number };

/**
 * Always-on hero effects (rules in `Game`: heroDamage, updateHero, hit, reward):
 * - execute: the hero's hits finish non-boss enemies left at or below `threshold` of max HP.
 * - slow-aura: enemies within `radius` tiles of the hero move `slow` slower (not Mirrors).
 * - tower-aura: towers within `radius` tiles of the hero deal `damage` more (0.2 = +20%).
 * - element-hits: the hero's hits apply its element's status effect at `power` (like a level-1 tower = 1).
 * - bounty: enemies dying within `radius` tiles of the hero pay `gold` more (0.3 = +30%).
 */
export type HeroPassiveEffect =
  | { kind: 'execute'; threshold: number }
  | { kind: 'slow-aura'; radius: number; slow: number }
  | { kind: 'tower-aura'; radius: number; damage: number }
  | { kind: 'element-hits'; power: number }
  | { kind: 'bounty'; radius: number; gold: number };

export interface HeroPassive {
  name: string;
  description: string;
  effect: HeroPassiveEffect;
}

export interface HeroAbilityDef {
  id: string;
  name: string;
  /** Hero level needed to use it. */
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
  /** Four abilities, unlocked at levels 1, 3, 5, 8, used with Z X C V. */
  abilities: readonly [HeroAbilityDef, HeroAbilityDef, HeroAbilityDef, HeroAbilityDef];
  /** Always-on effect (the second roster has one each). */
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

/** Ability keys, by slot. */
export const ABILITY_KEYS = ['Z', 'X', 'C', 'V'] as const;

export const HEROES: Record<HeroId, HeroDef> = {
  vex: {
    id: 'vex', name: 'Vex Adeyemi', callsign: 'Vex',
    pronouns: 'she/her', race: 'Human', origin: 'Lagos, Nigeria', role: 'Tactician',
    bio: 'A drone engineer who rewired a decommissioned defense satellite to answer only to her. Calm under fire, always three moves ahead.',
    color: '#ffe600', element: 'water', speed: 3,
    attack: { damage: 10, fireRate: 1.6, range: 2.6, armorPierce: 0.3, critChance: 0.1 },
    abilities: [
      {
        id: 'vex-pulse', name: 'Pulse Blast', unlockLevel: 1, cooldown: 8, target: 'point', castRange: 4.5, aimRadius: 1.4,
        effect: { kind: 'blast', radius: 1.4, damage: 70 },
        description: 'Blast every enemy in a small area near the hero.',
      },
      {
        id: 'vex-emp', name: 'EMP', unlockLevel: 3, cooldown: 18, target: 'self', castRange: 0, aimRadius: 2.6,
        effect: { kind: 'blast', radius: 2.6, damage: 25, stun: 1.5, stripShields: true },
        description: 'Stun everything around the hero for 1.5s and strip enemy shields.',
      },
      {
        id: 'vex-cryo', name: 'Cryo Field', unlockLevel: 5, cooldown: 22, target: 'point', castRange: 5.5, aimRadius: 2,
        effect: { kind: 'zone', radius: 2, duration: 6, slow: 0.5 },
        description: 'A freezing zone for 6s: enemies inside move 50% slower.',
      },
      {
        id: 'vex-orbital', name: 'Orbital Strike', unlockLevel: 8, cooldown: 55, target: 'point', castRange: Infinity, aimRadius: 2.2,
        effect: { kind: 'strike', radius: 2.2, damage: 450, delay: 1 },
        description: 'After 1s, a satellite beam hits anywhere on the map for massive damage.',
      },
    ],
  },
  mateo: {
    id: 'mateo', name: 'Mateo "Brick" Ruiz', callsign: 'Brick',
    pronouns: 'he/him', race: 'Cyborg', origin: 'Mexico City, Mexico', role: 'Melee',
    bio: 'A former demolition worker who kept the hydraulic arms after the job tried to replace him. Loud, loyal, and happiest in the middle of the crowd.',
    color: '#ff8a3d', element: 'earth', speed: 3.4,
    attack: { damage: 13, fireRate: 0.85, range: 1.1, armorPierce: 0.5, critChance: 0.1, cleave: 0.6 },
    abilities: [
      {
        id: 'mateo-slam', name: 'Ground Slam', unlockLevel: 1, cooldown: 11, target: 'self', castRange: 0, aimRadius: 1.6,
        effect: { kind: 'blast', radius: 1.6, damage: 40, stun: 0.8 },
        description: 'Smash the ground: damage and stun everything around the hero for 0.8s.',
      },
      {
        id: 'mateo-leap', name: 'Rocket Leap', unlockLevel: 3, cooldown: 14, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'dash', radius: 1.4, damage: 55 },
        description: 'Rocket to a spot and crash down on everything there.',
      },
      {
        id: 'mateo-overdrive', name: 'Overdrive', unlockLevel: 5, cooldown: 25, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 6, attackSpeed: 1.6, damage: 1.25 },
        description: 'For 6s, punch 60% faster and 25% harder.',
      },
      {
        id: 'mateo-quake', name: 'Seismic Quake', unlockLevel: 8, cooldown: 55, target: 'self', castRange: 0, aimRadius: 3.5,
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
    attack: { damage: 22, fireRate: 1, range: 4.5, armorPierce: 0.6, critChance: 0.2 },
    abilities: [
      {
        id: 'leila-pierce', name: 'Piercing Round', unlockLevel: 1, cooldown: 7, target: 'point', castRange: 8, aimRadius: 0.5,
        effect: { kind: 'pierce', length: 8, width: 0.5, damage: 110 },
        description: 'A round that passes through everything in a straight line toward the spot.',
      },
      {
        id: 'leila-mark', name: 'Mark Target', unlockLevel: 3, cooldown: 16, target: 'point', castRange: 6, aimRadius: 2,
        effect: { kind: 'mark', radius: 2, duration: 6, amp: 0.35 },
        description: 'Tag enemies in an area: they take 35% more damage from everything for 6s.',
      },
      {
        id: 'leila-rapid', name: 'Rapid Fire', unlockLevel: 5, cooldown: 20, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 5, attackSpeed: 3, damage: 1 },
        description: 'For 5s, fire three times as fast.',
      },
      {
        id: 'leila-headhunter', name: 'Headhunter', unlockLevel: 8, cooldown: 55, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'execute', count: 6, damage: 380 },
        description: 'Six shots at the six toughest enemies anywhere on the map.',
      },
    ],
  },
  arjun: {
    id: 'arjun', name: 'Arjun Mehta', callsign: 'Arjun',
    pronouns: 'he/him', race: 'Hologram (uploaded mind)', origin: 'Mumbai, India', role: 'Mage',
    bio: 'A physics teacher who uploaded himself to keep his research alive. He now bends the city network like a lecture hall full of equations.',
    color: '#b388ff', element: 'fire', speed: 3,
    attack: { damage: 11, fireRate: 1.2, range: 3, armorPierce: 0.2, critChance: 0.05, chain: 2 },
    abilities: [
      {
        id: 'arjun-firewall', name: 'Firewall', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 5, aimRadius: 1.6,
        effect: { kind: 'zone', radius: 1.6, duration: 5, dps: 30 },
        description: 'A burning code wall for 5s: 30 damage per second to everything inside.',
      },
      {
        id: 'arjun-gravity', name: 'Gravity Well', unlockLevel: 3, cooldown: 18, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'knockback', radius: 1.8, distance: 3, damage: 40 },
        description: 'Fold space: throw enemies in an area 3 tiles back along their route.',
      },
      {
        id: 'arjun-storm', name: 'Chain Storm', unlockLevel: 5, cooldown: 20, target: 'point', castRange: 5, aimRadius: 1.5,
        effect: { kind: 'chain', jumps: 9, jumpRange: 2.2, damage: 90, falloff: 0.08, stripShields: true },
        description: 'Lightning that jumps through up to 10 enemies near the spot and overloads their shields.',
      },
      {
        id: 'arjun-timelock', name: 'Time Lock', unlockLevel: 8, cooldown: 60, target: 'global', castRange: 0, aimRadius: 0,
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
    attack: { damage: 9, fireRate: 2.2, range: 2.8, armorPierce: 0.2, critChance: 0.05 },
    abilities: [
      {
        id: 'echo-drone', name: 'Deploy Drone', unlockLevel: 1, cooldown: 12, target: 'point', castRange: 4, aimRadius: 2.5,
        effect: { kind: 'summon', count: 1, duration: 12, damage: 17, fireRate: 2, range: 2.5 },
        description: 'Place a combat drone for 12s that shoots on its own.',
      },
      {
        id: 'echo-overclock', name: 'Overclock Towers', unlockLevel: 3, cooldown: 16, target: 'point', castRange: 6, aimRadius: 3.5,
        effect: { kind: 'tower-boost', radius: 3.5, duration: 8, fireRate: 2 },
        description: 'Towers in an area fire twice as fast for 8s.',
      },
      {
        id: 'echo-nanites', name: 'Nanite Cloud', unlockLevel: 5, cooldown: 22, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'zone', radius: 1.8, duration: 6, dps: 25, armorBreak: 4, stripShields: true },
        description: 'A nanite cloud for 6s: 25 damage per second, −4 armor, and shields eaten away.',
      },
      {
        id: 'echo-swarm', name: 'Drone Swarm', unlockLevel: 8, cooldown: 60, target: 'point', castRange: 6, aimRadius: 2.5,
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
    attack: { damage: 13, fireRate: 1.1, range: 1.2, armorPierce: 0.5, critChance: 0.2 },
    passive: {
      name: 'Execution', effect: { kind: 'execute', threshold: 0.12 },
      description: 'His hits instantly finish any enemy (not bosses) left at 12% HP or less.',
    },
    abilities: [
      {
        id: 'kaito-step', name: 'Flash Step', unlockLevel: 1, cooldown: 9, target: 'point', castRange: 4.5, aimRadius: 1,
        effect: { kind: 'dash', radius: 1, damage: 70 },
        description: 'Blink to a spot and cut everything around where he lands.',
      },
      {
        id: 'kaito-iaido', name: 'Iaido', unlockLevel: 3, cooldown: 12, target: 'point', castRange: 5, aimRadius: 0.6,
        effect: { kind: 'pierce', length: 5, width: 0.6, damage: 130 },
        description: 'One quick-draw slash that cuts through everything in a 5-tile line.',
      },
      {
        id: 'kaito-dance', name: 'Blade Dance', unlockLevel: 5, cooldown: 22, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 6, attackSpeed: 2.2, damage: 1.2 },
        description: 'For 6s, strike 2.2× as fast and 20% harder.',
      },
      {
        id: 'kaito-cuts', name: 'Thousand Cuts', unlockLevel: 8, cooldown: 55, target: 'global', castRange: 0, aimRadius: 0,
        effect: { kind: 'execute', count: 8, damage: 240 },
        description: 'Eight strikes at the eight toughest enemies anywhere on the map.',
      },
    ],
  },
  nalani: {
    id: 'nalani', name: 'Nalani "Tide" Kahale', callsign: 'Tide',
    pronouns: 'she/her', race: 'Human (deep-dive rig)', origin: 'Honolulu, Hawaiʻi', role: 'Controller',
    bio: 'A salvage diver who learned to move whole currents with a pressure rig built for the ocean floor. Patient, playful, and impossible to rush.',
    color: '#3ab8ff', element: 'water', speed: 3, unlockedBy: 'core-nexus',
    attack: { damage: 9, fireRate: 1.4, range: 3, armorPierce: 0.2, critChance: 0.05 },
    passive: {
      name: 'Undertow', effect: { kind: 'slow-aura', radius: 2.5, slow: 0.25 },
      description: 'Enemies within 2.5 tiles of her move 25% slower.',
    },
    abilities: [
      {
        id: 'nalani-riptide', name: 'Riptide', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 5, aimRadius: 1.6,
        effect: { kind: 'zone', radius: 1.6, duration: 6, slow: 0.45, dps: 14 },
        description: 'A churning pool for 6s: enemies inside move 45% slower and take 14 damage per second.',
      },
      {
        id: 'nalani-wave', name: 'Rogue Wave', unlockLevel: 3, cooldown: 16, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'knockback', radius: 1.8, distance: 2.5, damage: 45 },
        description: 'A wall of water that washes enemies in an area 2.5 tiles back along their route.',
      },
      {
        id: 'nalani-dive', name: 'Pressure Dive', unlockLevel: 5, cooldown: 18, target: 'self', castRange: 0, aimRadius: 2.2,
        effect: { kind: 'blast', radius: 2.2, damage: 60, stun: 1 },
        description: 'Slam a pressure wave around her: damage and a 1s stun.',
      },
      {
        id: 'nalani-tsunami', name: 'Tsunami', unlockLevel: 8, cooldown: 55, target: 'point', castRange: Infinity, aimRadius: 3,
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
    attack: { damage: 10, fireRate: 1, range: 2.6, armorPierce: 0.3, critChance: 0.05 },
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
        id: 'ines-surge', name: 'Power Surge', unlockLevel: 3, cooldown: 18, target: 'point', castRange: 6, aimRadius: 3.5,
        effect: { kind: 'tower-boost', radius: 3.5, duration: 8, damage: 1.4 },
        description: 'Towers in an area deal 40% more damage for 8s.',
      },
      {
        id: 'ines-barricade', name: 'Barricade', unlockLevel: 5, cooldown: 20, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'zone', radius: 1.4, duration: 7, slow: 0.6, armorBreak: 3 },
        description: 'Drop scrap barriers for 7s: enemies inside move 60% slower and lose 3 armor.',
      },
      {
        id: 'ines-patch', name: 'Core Patch', unlockLevel: 8, cooldown: 90, target: 'global', castRange: 0, aimRadius: 0,
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
    attack: { damage: 8, fireRate: 1.5, range: 3, armorPierce: 0.1, critChance: 0.05, chain: 1 },
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
        id: 'rua-bramble', name: 'Bramble Field', unlockLevel: 3, cooldown: 16, target: 'point', castRange: 5, aimRadius: 1.8,
        effect: { kind: 'zone', radius: 1.8, duration: 6, slow: 0.35, dps: 18 },
        description: 'A bramble patch for 6s: enemies inside move 35% slower and take 18 damage per second.',
      },
      {
        id: 'rua-spores', name: 'Spore Cloud', unlockLevel: 5, cooldown: 18, target: 'point', castRange: 6, aimRadius: 2.2,
        effect: { kind: 'mark', radius: 2.2, duration: 6, amp: 0.3 },
        description: 'Spores cling to enemies in an area: they take 30% more damage from everything for 6s.',
      },
      {
        id: 'rua-worldroot', name: 'Worldroot', unlockLevel: 8, cooldown: 55, target: 'point', castRange: 6, aimRadius: 3.2,
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
    attack: { damage: 12, fireRate: 1.2, range: 3.2, armorPierce: 0.3, critChance: 0.15 },
    passive: {
      name: 'Bounty', effect: { kind: 'bounty', radius: 3, gold: 0.3 },
      description: 'Enemies that die within 3 tiles of her pay 30% more gold.',
    },
    abilities: [
      {
        id: 'zeynep-napalm', name: 'Napalm', unlockLevel: 1, cooldown: 10, target: 'point', castRange: 5, aimRadius: 1.4,
        effect: { kind: 'zone', radius: 1.4, duration: 4, dps: 34 },
        description: 'Burning fuel for 4s: 34 damage per second to everything inside.',
      },
      {
        id: 'zeynep-flash', name: 'Flashbang', unlockLevel: 3, cooldown: 16, target: 'point', castRange: 5, aimRadius: 2,
        effect: { kind: 'blast', radius: 2, damage: 20, stun: 1.2 },
        description: 'A blinding flash that stuns everything in an area for 1.2s.',
      },
      {
        id: 'zeynep-incendiary', name: 'Incendiary Rounds', unlockLevel: 5, cooldown: 22, target: 'self', castRange: 0, aimRadius: 0,
        effect: { kind: 'buff', duration: 6, attackSpeed: 1.5, damage: 1.5 },
        description: 'For 6s, shoot 50% faster and 50% harder.',
      },
      {
        id: 'zeynep-sunfall', name: 'Sunfall', unlockLevel: 8, cooldown: 55, target: 'point', castRange: Infinity, aimRadius: 2.6,
        effect: { kind: 'strike', radius: 2.6, damage: 480, delay: 1.2 },
        description: 'After 1.2s, a column of fire hits anywhere on the map.',
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
    case 'strike':
      return effect.delay;
    case 'blast':
      return effect.stun ?? 0.4;
    default:
      return 0.4;
  }
}
