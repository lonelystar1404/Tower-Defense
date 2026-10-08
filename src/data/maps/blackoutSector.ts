import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.077 per wave) and then checked with the balance bot
// in tests/game.test.ts. Edit freely; re-run `npm test` after changing numbers.

/** Map 6: a powered-down district full of buildings and canals, with a hero. Introduces Disruptors and Prisms. */
export const BLACKOUT_SECTOR: LevelDef = {
  id: 'blackout-sector',
  name: 'Blackout Sector',
  description: 'Hero map. Towers, canals, and wreckage block the best spots. New: Disruptors knock towers offline, Prisms change element.',
  cols: 20,
  rows: 12,
  path: [[-1, 2], [6, 2], [6, 9], [13, 9], [13, 2], [18, 2], [18, 10]],
  obstacles: [
    { kind: 'canal', col: 0, row: 5, w: 5, h: 2 },
    { kind: 'wreck', col: 2, row: 0, w: 2, h: 1 },
    { kind: 'tower', col: 8, row: 4, w: 3, h: 3 },
    { kind: 'wreck', col: 11, row: 7, w: 1, h: 2 },
    { kind: 'tower', col: 15, row: 4, w: 2, h: 3 },
    { kind: 'wreck', col: 15, row: 0, w: 2, h: 1 },
    { kind: 'canal', col: 7, row: 11, w: 6, h: 1 },
    { kind: 'tower', col: 1, row: 9, w: 2, h: 2 },
  ],
  startGold: 160,
  lives: 20,
  /** All enemy HP on this map (see LevelDef.hpScale), tuned with the balance bot under 70% lockdown. */
  hpScale: 1.1,
  heroStart: [9, 7],
  waves: [
    // 1. basics
    {
      groups: [
        { enemy: 'grunt', count: 10, interval: 1.1 },
      ],
      bonus: 23,
    },
    // 2. runners
    {
      groups: [
        { enemy: 'grunt', count: 8, interval: 1.0, hpMult: 1.1 },
        { enemy: 'runner', count: 8, interval: 0.8, delay: 4, hpMult: 1.1 },
      ],
      bonus: 26,
    },
    // 3. first Disruptors
    {
      groups: [
        { enemy: 'disruptor', count: 4, interval: 2.2, hpMult: 1.2 },
        { enemy: 'grunt', count: 9, interval: 1.0, delay: 1, hpMult: 1.2 },
      ],
      bonus: 29,
    },
    // 4. drones
    {
      groups: [
        { enemy: 'drone', count: 11, interval: 0.9, hpMult: 1.2 },
        { enemy: 'grunt', count: 7, interval: 1.0, delay: 3, hpMult: 1.2 },
      ],
      bonus: 32,
    },
    // 5. first Prisms
    {
      groups: [
        { enemy: 'prism', count: 9, interval: 1.2, hpMult: 1.3 },
        { enemy: 'runner', count: 7, interval: 0.7, delay: 4, hpMult: 1.3 },
        { enemy: 'mirror', count: 3, interval: 2, delay: 6, hpMult: 1.3 },
      ],
      bonus: 35,
    },
    // 6. brutes
    {
      groups: [
        { enemy: 'brute', count: 5, interval: 2.2, hpMult: 1.4 },
        { enemy: 'disruptor', count: 4, interval: 2.5, delay: 3, hpMult: 1.4 },
      ],
      bonus: 38,
    },
    // 7. shield wall
    {
      groups: [
        { enemy: 'shielder', count: 10, interval: 1.3, hpMult: 1.6 },
        { enemy: 'prism', count: 5, interval: 1.5, delay: 4, hpMult: 1.6 },
      ],
      bonus: 41,
    },
    // 8. air raid
    {
      groups: [
        { enemy: 'drone', count: 15, interval: 0.7, hpMult: 1.7 },
        { enemy: 'wyvern', count: 4, interval: 2.5, delay: 4, hpMult: 1.7 },
      ],
      bonus: 44,
    },
    // 9. blackout
    {
      groups: [
        { enemy: 'disruptor', count: 10, interval: 1.6, hpMult: 1.8 },
        { enemy: 'runner', count: 13, interval: 0.6, delay: 3, hpMult: 1.8 },
        { enemy: 'jammer', count: 4, interval: 2.5, delay: 2, hpMult: 1.8 },
      ],
      bonus: 47, rewardMult: 0.6,
    },
    // 10. prism parade
    {
      groups: [
        { enemy: 'prism', count: 18, interval: 0.9, hpMult: 1.9 },
        { enemy: 'medic', count: 3, interval: 3, delay: 4, hpMult: 1.9 },
      ],
      bonus: 50, rewardMult: 0.6,
    },
    // 11. ghosts in the dark
    {
      groups: [
        { enemy: 'ghost', count: 14, interval: 1.0, hpMult: 2.1 },
        { enemy: 'disruptor', count: 5, interval: 2.2, delay: 3, hpMult: 2.1 },
      ],
      bonus: 53, rewardMult: 0.6,
    },
    // 12. armored column
    {
      groups: [
        { enemy: 'brute', count: 11, interval: 1.8, hpMult: 2.3 },
        { enemy: 'shielder', count: 8, interval: 1.4, delay: 4, hpMult: 2.3 },
      ],
      bonus: 56, rewardMult: 0.6,
    },
    // 13. swarm storm
    {
      groups: [
        { enemy: 'swarm', count: 85, interval: 0.12, hpMult: 2.4 },
        { enemy: 'prism', count: 9, interval: 1.2, delay: 4, hpMult: 2.4 },
      ],
      bonus: 59, rewardMult: 0.6,
    },
    // 14. carrier group
    {
      groups: [
        { enemy: 'carrier', count: 4, interval: 4, hpMult: 2.6 },
        { enemy: 'drone', count: 15, interval: 0.8, delay: 2, hpMult: 2.6 },
      ],
      bonus: 62, rewardMult: 0.6,
    },
    // 15. grid failure
    {
      groups: [
        { enemy: 'disruptor', count: 18, interval: 1.2, hpMult: 2.8 },
        { enemy: 'brute', count: 6, interval: 2.5, delay: 4, hpMult: 2.8 },
        { enemy: 'grunt', count: 24, interval: 0.6, delay: 2, hpMult: 2.8 },
      ],
      bonus: 65, rewardMult: 0.6,
    },
    // 16. splinters
    {
      groups: [
        { enemy: 'splitter', count: 18, interval: 1.1, hpMult: 3.0 },
        { enemy: 'phaser', count: 12, interval: 1.2, delay: 4, hpMult: 3.0 },
        { enemy: 'mirror', count: 9, interval: 1.6, delay: 2, hpMult: 3.0 },
      ],
      bonus: 68, rewardMult: 0.45,
    },
    // 17. elemental chaos
    {
      groups: [
        { enemy: 'prism', count: 25, interval: 0.8, hpMult: 3.3 },
        { enemy: 'grunt', count: 12, interval: 0.8, delay: 2, hpMult: 3.3, element: 'metal' },
        { enemy: 'grunt', count: 12, interval: 0.8, delay: 6, hpMult: 3.3, element: 'wood' },
      ],
      bonus: 71, rewardMult: 0.45,
    },
    // 18. sky fortress
    {
      groups: [
        { enemy: 'wyvern', count: 16, interval: 1.6, hpMult: 3.5 },
        { enemy: 'carrier', count: 4, interval: 4, delay: 4, hpMult: 3.5 },
      ],
      bonus: 74, rewardMult: 0.45,
    },
    // 19. medic convoy
    {
      groups: [
        { enemy: 'medic', count: 8, interval: 2.0, hpMult: 3.8 },
        { enemy: 'brute', count: 13, interval: 1.6, delay: 1, hpMult: 3.8 },
        { enemy: 'shielder', count: 13, interval: 1.2, delay: 4, hpMult: 3.8 },
      ],
      bonus: 77, rewardMult: 0.45,
    },
    // 20. titans
    {
      groups: [
        { enemy: 'brute', count: 7, interval: 3, hpMult: 10.2 },
        { enemy: 'wyvern', count: 5, interval: 3.5, delay: 3, hpMult: 10.2 },
        { enemy: 'disruptor', count: 10, interval: 1.8, delay: 2, hpMult: 4.1 },
      ],
      bonus: 80, rewardMult: 0.45,
    },
    // 21. blitz
    {
      groups: [
        { enemy: 'runner', count: 51, interval: 0.35, hpMult: 4.4 },
        { enemy: 'phaser', count: 24, interval: 0.8, delay: 3, hpMult: 4.4 },
        { enemy: 'jammer', count: 10, interval: 1.5, delay: 1, hpMult: 4.4 },
      ],
      bonus: 83, rewardMult: 0.45,
    },
    // 22. hive
    {
      groups: [
        { enemy: 'swarm', count: 208, interval: 0.08, hpMult: 4.7 },
        { enemy: 'disruptor', count: 14, interval: 1.5, delay: 3, hpMult: 4.7 },
      ],
      bonus: 86, rewardMult: 0.45,
    },
    // 23. rainbow
    {
      groups: [
        { enemy: 'prism', count: 53, interval: 0.55, hpMult: 5.1 },
      ],
      bonus: 89, rewardMult: 0.45,
    },
    // 24. siege
    {
      groups: [
        { enemy: 'brute', count: 25, interval: 1.4, hpMult: 5.5 },
        { enemy: 'disruptor', count: 18, interval: 1.4, delay: 2, hpMult: 5.5 },
        { enemy: 'medic', count: 7, interval: 2.5, delay: 4, hpMult: 5.5 },
      ],
      bonus: 92, rewardMult: 0.45,
    },
    // 25. stealth op
    {
      groups: [
        { enemy: 'ghost', count: 44, interval: 0.6, hpMult: 5.9 },
        { enemy: 'disruptor', count: 15, interval: 1.5, delay: 3, hpMult: 5.9 },
      ],
      bonus: 95, rewardMult: 0.45,
    },
    // 26. air supremacy
    {
      groups: [
        { enemy: 'drone', count: 75, interval: 0.3, hpMult: 6.4 },
        { enemy: 'wyvern', count: 19, interval: 1.6, delay: 3, hpMult: 6.4 },
        { enemy: 'carrier', count: 6, interval: 4, delay: 6, hpMult: 6.4 },
      ],
      bonus: 98, rewardMult: 0.35,
    },
    // 27. total blackout
    {
      groups: [
        { enemy: 'disruptor', count: 46, interval: 0.8, hpMult: 6.9 },
        { enemy: 'shielder', count: 27, interval: 0.9, delay: 2, hpMult: 6.9 },
        { enemy: 'mirror', count: 19, interval: 1.2, delay: 4, hpMult: 6.9 },
      ],
      bonus: 101, rewardMult: 0.35,
    },
    // 28. fortress
    {
      groups: [
        { enemy: 'brute', count: 39, interval: 1.2, hpMult: 7.4 },
        { enemy: 'wyvern', count: 16, interval: 2, delay: 3, hpMult: 7.4 },
        { enemy: 'prism', count: 19, interval: 1, delay: 5, hpMult: 7.4 },
      ],
      bonus: 104, rewardMult: 0.35,
    },
    // 29. titans II
    {
      groups: [
        { enemy: 'brute', count: 12, interval: 2.5, hpMult: 16.0 },
        { enemy: 'wyvern', count: 10, interval: 3, delay: 3, hpMult: 16.0 },
        { enemy: 'disruptor', count: 20, interval: 1.2, delay: 2, hpMult: 8.0 },
      ],
      bonus: 107, rewardMult: 0.35,
    },
    // 30. sector finale
    {
      groups: [
        { enemy: 'disruptor', count: 28, interval: 0.7, hpMult: 5.3 },
        { enemy: 'prism', count: 32, interval: 0.6, delay: 2, hpMult: 5.3 },
        { enemy: 'brute', count: 20, interval: 1.4, delay: 4, hpMult: 5.3 },
        { enemy: 'carrier', count: 6, interval: 3, delay: 6, hpMult: 5.3 },
        { enemy: 'swarm', count: 121, interval: 0.08, delay: 8, hpMult: 5.3 },
        { enemy: 'wyvern', count: 16, interval: 1.8, delay: 10, hpMult: 5.3 },
        { enemy: 'jammer', count: 12, interval: 1.5, delay: 3, hpMult: 5.3 },
        { enemy: 'mirror', count: 12, interval: 1.5, delay: 7, hpMult: 5.3 },
        { enemy: 'chimera', count: 1, interval: 1, delay: 18, hpMult: 18 },
      ],
      bonus: 0, rewardMult: 0.35,
    },
  ],
};
