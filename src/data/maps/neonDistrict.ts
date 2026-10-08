import type { LevelDef } from '../levels';

/** Map 1: the original winding road. Introduces the six base enemies. */
export const NEON_DISTRICT: LevelDef = {
  id: 'neon-district',
  name: 'Neon District',
  description: 'A winding neon road through the city. Meet the six base enemies.',
  cols: 20,
  rows: 12,
  path: [[-1, 2], [5, 2], [5, 8], [10, 8], [10, 3], [15, 3], [15, 9], [18, 9]],
  startGold: 150,
  lives: 20,
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
    // 15. Onslaught
    {
      groups: [
        { enemy: 'swarm', count: 40, interval: 0.1, hpMult: 6.1 },
        { enemy: 'brute', count: 6, interval: 2.2, delay: 2, hpMult: 7.0 },
        { enemy: 'drone', count: 20, interval: 0.45, delay: 4, hpMult: 6.1 },
        { enemy: 'wyvern', count: 6, interval: 2, delay: 8, hpMult: 5.8 },
        { enemy: 'runner', count: 20, interval: 0.35, delay: 12, hpMult: 6.1 },
        { enemy: 'grunt', count: 20, interval: 0.4, delay: 16, hpMult: 7.0, element: 'metal' },
      ],
      bonus: 55, rewardMult: 0.5,
    },
    // 16. Night shift: fast enemies on the ground and in the air
    {
      groups: [
        { enemy: 'runner', count: 30, interval: 0.3, hpMult: 2.9 },
        { enemy: 'drone', count: 20, interval: 0.4, delay: 3, hpMult: 2.9, element: 'fire' },
        { enemy: 'runner', count: 15, interval: 0.3, delay: 12, hpMult: 2.9, element: 'wood' },
      ],
      bonus: 60, rewardMult: 0.4,
    },
    // 17. Iron curtain: armor everywhere: bring Earth and Metal
    {
      groups: [
        { enemy: 'brute', count: 10, interval: 1.8, hpMult: 3.6 },
        { enemy: 'brute', count: 6, interval: 2, delay: 4, hpMult: 3.6, element: 'earth' },
        { enemy: 'grunt', count: 25, interval: 0.5, delay: 2, hpMult: 3.2, element: 'wood' },
      ],
      bonus: 60, rewardMult: 0.4,
    },
    // 18. Hive: huge swarms in three elements
    {
      groups: [
        { enemy: 'swarm', count: 35, interval: 0.1, hpMult: 3.6 },
        { enemy: 'swarm', count: 35, interval: 0.1, delay: 5, hpMult: 3.6, element: 'metal' },
        { enemy: 'swarm', count: 35, interval: 0.1, delay: 10, hpMult: 3.6, element: 'water' },
      ],
      bonus: 65, rewardMult: 0.4,
    },
    // 19. Storm front: armored flyers that resist different elements
    {
      groups: [
        { enemy: 'wyvern', count: 6, interval: 1.8, hpMult: 3.9, element: 'water' },
        { enemy: 'wyvern', count: 6, interval: 1.8, delay: 4, hpMult: 3.9, element: 'earth' },
        { enemy: 'drone', count: 25, interval: 0.4, delay: 2, hpMult: 3.9, element: 'fire' },
      ],
      bonus: 65, rewardMult: 0.4,
    },
    // 20. Titans: milestone: a few enormous brutes and wyverns with escorts
    {
      groups: [
        { enemy: 'brute', count: 4, interval: 4, hpMult: 12.9 },
        { enemy: 'wyvern', count: 3, interval: 5, delay: 6, hpMult: 11.2 },
        { enemy: 'grunt', count: 30, interval: 0.5, delay: 1, hpMult: 4.3, element: 'fire' },
        { enemy: 'drone', count: 15, interval: 0.6, delay: 8, hpMult: 4.3 },
      ],
      bonus: 80, rewardMult: 0.4,
    },
    // 21. Blitz: everything fast, all at once
    {
      groups: [
        { enemy: 'runner', count: 40, interval: 0.2, hpMult: 4.7 },
        { enemy: 'swarm', count: 40, interval: 0.1, delay: 3, hpMult: 4.7, element: 'earth' },
        { enemy: 'drone', count: 25, interval: 0.3, delay: 6, hpMult: 4.7, element: 'wood' },
      ],
      bonus: 70, rewardMult: 0.4,
    },
    // 22. Elemental chaos: every type in an unusual element
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 2, hpMult: 5.7, element: 'fire' },
        { enemy: 'runner', count: 20, interval: 0.3, delay: 2, hpMult: 5.2, element: 'earth' },
        { enemy: 'swarm', count: 40, interval: 0.1, delay: 5, hpMult: 5.2, element: 'metal' },
        { enemy: 'drone', count: 20, interval: 0.4, delay: 7, hpMult: 5.2, element: 'water' },
        { enemy: 'wyvern', count: 5, interval: 2, delay: 10, hpMult: 5.2, element: 'wood' },
      ],
      bonus: 70, rewardMult: 0.4,
    },
    // 23. Air supremacy: the sky is full
    {
      groups: [
        { enemy: 'drone', count: 45, interval: 0.25, hpMult: 5.7 },
        { enemy: 'wyvern', count: 10, interval: 1.5, delay: 3, hpMult: 5.7 },
        { enemy: 'wyvern', count: 4, interval: 2, delay: 14, hpMult: 6.9, element: 'metal' },
      ],
      bonus: 75, rewardMult: 0.4,
    },
    // 24. Siege: the heaviest armor yet
    {
      groups: [
        { enemy: 'brute', count: 14, interval: 1.5, hpMult: 7.6 },
        { enemy: 'brute', count: 6, interval: 2, delay: 6, hpMult: 7.6, element: 'water' },
        { enemy: 'wyvern', count: 8, interval: 2, delay: 4, hpMult: 6.3 },
        { enemy: 'grunt', count: 30, interval: 0.4, delay: 2, hpMult: 6.3, element: 'metal' },
      ],
      bonus: 75, rewardMult: 0.4,
    },
    // 25. Last stand: everything, in every element, at full strength
    {
      groups: [
        { enemy: 'swarm', count: 50, interval: 0.08, hpMult: 6.9 },
        { enemy: 'brute', count: 10, interval: 1.6, delay: 2, hpMult: 8.3 },
        { enemy: 'drone', count: 30, interval: 0.3, delay: 4, hpMult: 6.9 },
        { enemy: 'wyvern', count: 8, interval: 1.6, delay: 8, hpMult: 7.6 },
        { enemy: 'runner', count: 30, interval: 0.25, delay: 12, hpMult: 6.9, element: 'earth' },
        { enemy: 'grunt', count: 30, interval: 0.3, delay: 16, hpMult: 8.3, element: 'wood' },
        { enemy: 'brute', count: 4, interval: 3, delay: 20, hpMult: 13.9, element: 'fire' },
      ],
      bonus: 80, rewardMult: 0.4,
    },
    // 26. Overclock: fast enemies in every element
    {
      groups: [
        { enemy: 'runner', count: 40, interval: 0.2, hpMult: 3.8, element: 'fire' },
        { enemy: 'drone', count: 30, interval: 0.3, delay: 3, hpMult: 3.8, element: 'water' },
        { enemy: 'runner', count: 30, interval: 0.2, delay: 8, hpMult: 3.8, element: 'metal' },
        { enemy: 'drone', count: 20, interval: 0.3, delay: 12, hpMult: 3.8, element: 'wood' },
      ],
      bonus: 85, rewardMult: 0.35,
    },
    // 27. Fortress: armored walls on the ground and in the sky
    {
      groups: [
        { enemy: 'brute', count: 18, interval: 1.4, hpMult: 5.0 },
        { enemy: 'wyvern', count: 10, interval: 1.6, delay: 4, hpMult: 4.6, element: 'earth' },
        { enemy: 'brute', count: 6, interval: 2, delay: 14, hpMult: 5.0, element: 'wood' },
      ],
      bonus: 85, rewardMult: 0.35,
    },
    // 28. Swarm singularity: 150 swarm units in all five elements
    {
      groups: [
        { enemy: 'swarm', count: 30, interval: 0.08, hpMult: 4.6, element: 'fire' },
        { enemy: 'swarm', count: 30, interval: 0.08, delay: 3, hpMult: 4.6, element: 'water' },
        { enemy: 'swarm', count: 30, interval: 0.08, delay: 6, hpMult: 4.6, element: 'wood' },
        { enemy: 'swarm', count: 30, interval: 0.08, delay: 9, hpMult: 4.6, element: 'earth' },
        { enemy: 'swarm', count: 30, interval: 0.08, delay: 12, hpMult: 4.6, element: 'metal' },
      ],
      bonus: 90, rewardMult: 0.35,
    },
    // 29. Titans II: enormous brutes and wyverns in pairs, with escorts
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 3, hpMult: 15.2 },
        { enemy: 'wyvern', count: 6, interval: 3.5, delay: 5, hpMult: 13.2, element: 'water' },
        { enemy: 'grunt', count: 40, interval: 0.4, delay: 1, hpMult: 5.1 },
        { enemy: 'drone', count: 25, interval: 0.4, delay: 8, hpMult: 5.1, element: 'earth' },
      ],
      bonus: 95, rewardMult: 0.35,
    },
    // 30. Grand finale: the whole army, every element, at full strength
    {
      groups: [
        { enemy: 'swarm', count: 60, interval: 0.07, hpMult: 5.6 },
        { enemy: 'runner', count: 40, interval: 0.2, delay: 2, hpMult: 5.6, element: 'earth' },
        { enemy: 'brute', count: 14, interval: 1.3, delay: 4, hpMult: 7.3 },
        { enemy: 'drone', count: 40, interval: 0.25, delay: 6, hpMult: 5.6 },
        { enemy: 'wyvern', count: 12, interval: 1.4, delay: 10, hpMult: 6.7, element: 'water' },
        { enemy: 'grunt', count: 40, interval: 0.25, delay: 14, hpMult: 6.7, element: 'wood' },
        { enemy: 'brute', count: 5, interval: 3, delay: 22, hpMult: 13.4, element: 'fire' },
        { enemy: 'wyvern', count: 4, interval: 3, delay: 26, hpMult: 13.4, element: 'metal' },
      ],
      bonus: 0, rewardMult: 0.35,
    },
  ],
};
