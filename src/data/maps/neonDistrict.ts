import type { LevelDef } from '../levels';

/** Map 1: the original winding road, 15 waves. Introduces the six base enemies and the first boss. */
export const NEON_DISTRICT: LevelDef = {
  id: 'neon-district',
  name: 'Neon District',
  description: 'A winding neon road through the city. Meet the six base enemies.',
  cols: 20,
  rows: 12,
  path: [[-1, 2], [5, 2], [5, 8], [10, 8], [10, 3], [15, 3], [15, 9], [18, 9]],
  startGold: 150,
  lives: 20,
  /** All enemy HP on this map (see LevelDef.hpScale). */
  hpScale: 0.5, // first map: kept easy for new players
  /** No lockdown on the first map: every tower can be built and upgraded while players learn. */
  lockFraction: 0,
  waves: [
    // 1. Basics
    { groups: [{ enemy: 'grunt', count: 8, interval: 1.2 }], bonus: 20 },
    // 2. Fast runners mixed in
    {
      groups: [
        { enemy: 'grunt', count: 8, interval: 1.1 },
        { enemy: 'runner', count: 6, interval: 0.9, delay: 4 },
      ],
      bonus: 25,
    },
    // 3. Swarms: splash, chain, and multi-shot shine
    {
      groups: [
        { enemy: 'swarm', count: 12, interval: 0.2 },
        { enemy: 'swarm', count: 12, interval: 0.2, delay: 7 },
        { enemy: 'grunt', count: 6, interval: 1, delay: 3, element: 'earth' },
      ],
      bonus: 30,
    },
    // 4. First flyers: they ignore the path
    {
      groups: [
        { enemy: 'drone', count: 8, interval: 1.2, delay: 2 },
        { enemy: 'grunt', count: 8, interval: 1, element: 'water' },
      ],
      bonus: 35,
    },
    // 5. Armor
    {
      groups: [
        { enemy: 'brute', count: 4, interval: 3.5 },
        { enemy: 'grunt', count: 10, interval: 0.9, delay: 2, hpMult: 1.3, element: 'fire' },
      ],
      bonus: 40,
    },
    // 6. Everything fast
    {
      groups: [
        { enemy: 'runner', count: 10, interval: 0.7, hpMult: 1.3 },
        { enemy: 'drone', count: 10, interval: 0.9, delay: 3, hpMult: 1.3 },
        { enemy: 'swarm', count: 20, interval: 0.15, delay: 8, hpMult: 1.3 },
      ],
      bonus: 45,
    },
    // 7. Armored flyers
    {
      groups: [
        { enemy: 'wyvern', count: 4, interval: 3, delay: 2 },
        { enemy: 'brute', count: 3, interval: 4, hpMult: 1.3 },
        { enemy: 'grunt', count: 14, interval: 0.8, delay: 1, hpMult: 1.6, element: 'metal' },
      ],
      bonus: 50,
    },
    // 8. Everything at once
    {
      groups: [
        { enemy: 'swarm', count: 30, interval: 0.15, hpMult: 1.6 },
        { enemy: 'brute', count: 4, interval: 3, delay: 3, hpMult: 1.6 },
        { enemy: 'drone', count: 12, interval: 0.8, delay: 5, hpMult: 1.6 },
        { enemy: 'wyvern', count: 4, interval: 3, delay: 10, hpMult: 1.4 },
        { enemy: 'runner', count: 10, interval: 0.6, delay: 14, hpMult: 1.6 },
      ],
      bonus: 55,
    },
    // 9. Air raid: anti-air or bust
    {
      groups: [
        { enemy: 'drone', count: 20, interval: 0.55, hpMult: 2.6 },
        { enemy: 'wyvern', count: 5, interval: 2.5, delay: 4, hpMult: 2.2 },
        { enemy: 'drone', count: 10, interval: 0.4, delay: 14, hpMult: 2.6, element: 'water' },
      ],
      bonus: 35, rewardMult: 0.5,
    },
    // 10. Armored column
    {
      groups: [
        { enemy: 'brute', count: 8, interval: 2.2, hpMult: 2.8 },
        { enemy: 'brute', count: 3, interval: 3, delay: 6, hpMult: 2.8, element: 'earth' },
        { enemy: 'grunt', count: 20, interval: 0.6, delay: 2, hpMult: 3.4, element: 'water' },
      ],
      bonus: 40, rewardMult: 0.5,
    },
    // 11. Swarm storm
    {
      groups: [
        { enemy: 'swarm', count: 25, interval: 0.12, hpMult: 3.6 },
        { enemy: 'runner', count: 15, interval: 0.45, delay: 4, hpMult: 3.4 },
        { enemy: 'swarm', count: 25, interval: 0.12, delay: 9, hpMult: 3.6, element: 'fire' },
        { enemy: 'runner', count: 10, interval: 0.45, delay: 13, hpMult: 3.4, element: 'metal' },
      ],
      bonus: 40, rewardMult: 0.5,
    },
    // 12. Elemental mix: every element at once, so no single tower element covers all
    {
      groups: [
        { enemy: 'grunt', count: 8, interval: 0.7, hpMult: 4.8, element: 'fire' },
        { enemy: 'grunt', count: 8, interval: 0.7, delay: 2, hpMult: 4.8, element: 'water' },
        { enemy: 'grunt', count: 8, interval: 0.7, delay: 4, hpMult: 4.8, element: 'wood' },
        { enemy: 'grunt', count: 8, interval: 0.7, delay: 6, hpMult: 4.8, element: 'earth' },
        { enemy: 'grunt', count: 8, interval: 0.7, delay: 8, hpMult: 4.8, element: 'metal' },
        { enemy: 'drone', count: 10, interval: 0.8, delay: 5, hpMult: 3.9, element: 'wood' },
      ],
      bonus: 45, rewardMult: 0.5,
    },
    // 13. Sky fortress
    {
      groups: [
        { enemy: 'wyvern', count: 8, interval: 2, hpMult: 3.8 },
        { enemy: 'drone', count: 16, interval: 0.5, delay: 3, hpMult: 4.5 },
        { enemy: 'wyvern', count: 4, interval: 2.5, delay: 12, hpMult: 3.8, element: 'metal' },
      ],
      bonus: 45, rewardMult: 0.5,
    },
    // 14. Juggernauts
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 2.5, hpMult: 5.9 },
        { enemy: 'swarm', count: 30, interval: 0.12, delay: 2, hpMult: 5.1 },
        { enemy: 'wyvern', count: 5, interval: 2.5, delay: 6, hpMult: 4.7 },
        { enemy: 'brute', count: 4, interval: 2.5, delay: 12, hpMult: 5.9, element: 'wood' },
      ],
      bonus: 50, rewardMult: 0.5,
    },
    // 15. Onslaught, and the Siege Colossus
    {
      groups: [
        { enemy: 'swarm', count: 40, interval: 0.1, hpMult: 6.1 },
        { enemy: 'brute', count: 6, interval: 2.2, delay: 2, hpMult: 7.0 },
        { enemy: 'drone', count: 20, interval: 0.45, delay: 4, hpMult: 6.1 },
        { enemy: 'wyvern', count: 6, interval: 2, delay: 8, hpMult: 5.8 },
        { enemy: 'runner', count: 20, interval: 0.35, delay: 12, hpMult: 6.1 },
        { enemy: 'grunt', count: 20, interval: 0.4, delay: 16, hpMult: 7.0, element: 'metal' },
        { enemy: 'colossus', count: 1, interval: 1, delay: 22, hpMult: 5, element: 'fire' },
      ],
      bonus: 0, rewardMult: 0.5,
    },
  ],
};
