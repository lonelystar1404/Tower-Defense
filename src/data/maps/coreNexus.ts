import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.079 per wave) and then checked with the balance bot
// in tests/game.test.ts. Edit freely; re-run `npm test` after changing numbers.

/** Map 7: the final map, a crowded core district, with a hero. Introduces Burrowers and Wardens. */
export const CORE_NEXUS: LevelDef = {
  id: 'core-nexus',
  name: 'Core Nexus',
  description: 'Hero map, the last stand: few free rooftops and 35 waves. New: Burrowers dig under your fire, Wardens armor their escorts.',
  cols: 20,
  rows: 12,
  path: [[20, 1], [2, 1], [2, 10], [10, 10], [10, 4], [16, 4], [16, 8], [13, 8]],
  obstacles: [
    { kind: 'canal', col: 5, row: 0, w: 10, h: 1 },
    { kind: 'tower', col: 4, row: 3, w: 2, h: 2 },
    { kind: 'tower', col: 7, row: 6, w: 2, h: 2 },
    { kind: 'wreck', col: 3, row: 7, w: 2, h: 2 },
    { kind: 'canal', col: 12, row: 6, w: 2, h: 1 },
    { kind: 'tower', col: 18, row: 5, w: 2, h: 3 },
    { kind: 'wreck', col: 4, row: 11, w: 4, h: 1 },
    { kind: 'wreck', col: 14, row: 10, w: 3, h: 2 },
  ],
  startGold: 160,
  lives: 20,
  /** All enemy HP on this map (see LevelDef.hpScale), tuned with the balance bot under 70% lockdown. */
  hpScale: 0.88,
  heroStart: [12, 5],
  waves: [
    // 1. basics
    {
      groups: [
        { enemy: 'grunt', count: 10, interval: 1.1 },
      ],
      bonus: 23,
    },
    // 2. first Burrowers
    {
      groups: [
        { enemy: 'burrower', count: 6, interval: 1.5, hpMult: 1.1 },
        { enemy: 'grunt', count: 8, interval: 1.0, delay: 2, hpMult: 1.1 },
      ],
      bonus: 26,
    },
    // 3. drones
    {
      groups: [
        { enemy: 'drone', count: 11, interval: 0.9, hpMult: 1.2 },
        { enemy: 'runner', count: 6, interval: 0.8, delay: 3, hpMult: 1.2 },
      ],
      bonus: 29,
    },
    // 4. first Wardens
    {
      groups: [
        { enemy: 'warden', count: 2, interval: 4, hpMult: 1.3 },
        { enemy: 'grunt', count: 13, interval: 0.8, delay: 1, hpMult: 1.3 },
      ],
      bonus: 32,
    },
    // 5. dig and shield
    {
      groups: [
        { enemy: 'shielder', count: 7, interval: 1.4, hpMult: 1.4 },
        { enemy: 'burrower', count: 7, interval: 1.4, delay: 3, hpMult: 1.4 },
      ],
      bonus: 35,
    },
    // 6. fast lane
    {
      groups: [
        { enemy: 'runner', count: 14, interval: 0.6, hpMult: 1.5 },
        { enemy: 'phaser', count: 7, interval: 1.3, delay: 3, hpMult: 1.5 },
        { enemy: 'jammer', count: 4, interval: 2.5, delay: 1, hpMult: 1.5 },
      ],
      bonus: 38,
    },
    // 7. escorted wyverns
    {
      groups: [
        { enemy: 'wyvern', count: 5, interval: 2.2, hpMult: 1.6 },
        { enemy: 'warden', count: 2, interval: 4, delay: 1, hpMult: 1.6 },
        { enemy: 'brute', count: 4, interval: 2.5, delay: 2, hpMult: 1.6 },
      ],
      bonus: 41,
    },
    // 8. underground
    {
      groups: [
        { enemy: 'burrower', count: 17, interval: 0.9, hpMult: 1.7 },
      ],
      bonus: 44,
    },
    // 9. iron guard
    {
      groups: [
        { enemy: 'warden', count: 4, interval: 3, hpMult: 1.8 },
        { enemy: 'brute', count: 8, interval: 1.8, delay: 1, hpMult: 1.8 },
      ],
      bonus: 47, rewardMult: 0.6,
    },
    // 10. air raid
    {
      groups: [
        { enemy: 'drone', count: 21, interval: 0.6, hpMult: 2.0 },
        { enemy: 'wyvern', count: 5, interval: 2.2, delay: 4, hpMult: 2.0 },
        { enemy: 'mirror', count: 5, interval: 2, delay: 2, hpMult: 2.0 },
      ],
      bonus: 50, rewardMult: 0.6,
    },
    // 11. splinter guard
    {
      groups: [
        { enemy: 'splitter', count: 14, interval: 1.1, hpMult: 2.1 },
        { enemy: 'warden', count: 4, interval: 3, delay: 2, hpMult: 2.1 },
      ],
      bonus: 53, rewardMult: 0.6,
    },
    // 12. blackout
    {
      groups: [
        { enemy: 'prism', count: 14, interval: 1.0, hpMult: 2.3 },
        { enemy: 'disruptor', count: 8, interval: 1.8, delay: 3, hpMult: 2.3 },
      ],
      bonus: 56, rewardMult: 0.6,
    },
    // 13. guarded swarm
    {
      groups: [
        { enemy: 'swarm', count: 85, interval: 0.12, hpMult: 2.5 },
        { enemy: 'warden', count: 4, interval: 3, delay: 2, hpMult: 2.5 },
      ],
      bonus: 59, rewardMult: 0.6,
    },
    // 14. ghost tunnels
    {
      groups: [
        { enemy: 'ghost', count: 15, interval: 1.0, hpMult: 2.7 },
        { enemy: 'burrower', count: 15, interval: 1.0, delay: 3, hpMult: 2.7 },
      ],
      bonus: 62, rewardMult: 0.6,
    },
    // 15. carrier fleet
    {
      groups: [
        { enemy: 'carrier', count: 5, interval: 3.5, hpMult: 2.9 },
        { enemy: 'drone', count: 15, interval: 0.8, delay: 2, hpMult: 2.9 },
      ],
      bonus: 65, rewardMult: 0.6,
    },
    // 16. phalanx
    {
      groups: [
        { enemy: 'warden', count: 9, interval: 2.2, hpMult: 3.1 },
        { enemy: 'shielder', count: 18, interval: 0.9, delay: 1, hpMult: 3.1 },
        { enemy: 'mirror', count: 9, interval: 1.6, delay: 3, hpMult: 3.1 },
      ],
      bonus: 68, rewardMult: 0.45,
    },
    // 17. tunnelers
    {
      groups: [
        { enemy: 'burrower', count: 37, interval: 0.6, hpMult: 3.4 },
        { enemy: 'runner', count: 16, interval: 0.6, delay: 4, hpMult: 3.4 },
      ],
      bonus: 71, rewardMult: 0.45,
    },
    // 18. elemental chaos
    {
      groups: [
        { enemy: 'prism', count: 22, interval: 0.8, hpMult: 3.6 },
        { enemy: 'burrower', count: 13, interval: 1.0, delay: 3, hpMult: 3.6, element: 'fire' },
        { enemy: 'grunt', count: 16, interval: 0.7, delay: 5, hpMult: 3.6, element: 'metal' },
      ],
      bonus: 74, rewardMult: 0.45,
    },
    // 19. armored hospital
    {
      groups: [
        { enemy: 'medic', count: 8, interval: 2.0, hpMult: 3.9 },
        { enemy: 'warden', count: 7, interval: 2.5, delay: 1, hpMult: 3.9 },
        { enemy: 'brute', count: 13, interval: 1.6, delay: 2, hpMult: 3.9 },
      ],
      bonus: 77, rewardMult: 0.45,
    },
    // 20. titans
    {
      groups: [
        { enemy: 'brute', count: 7, interval: 3, hpMult: 10.6 },
        { enemy: 'wyvern', count: 5, interval: 3.5, delay: 3, hpMult: 10.6 },
        { enemy: 'warden', count: 7, interval: 2.5, delay: 1, hpMult: 4.2 },
      ],
      bonus: 80, rewardMult: 0.45,
    },
    // 21. blackout II
    {
      groups: [
        { enemy: 'disruptor', count: 20, interval: 1.2, hpMult: 4.6 },
        { enemy: 'burrower', count: 17, interval: 1.0, delay: 3, hpMult: 4.6 },
        { enemy: 'jammer', count: 10, interval: 1.5, delay: 1, hpMult: 4.6 },
      ],
      bonus: 83, rewardMult: 0.45,
    },
    // 22. blitz
    {
      groups: [
        { enemy: 'runner', count: 52, interval: 0.35, hpMult: 4.9 },
        { enemy: 'phaser', count: 24, interval: 0.8, delay: 3, hpMult: 4.9 },
      ],
      bonus: 86, rewardMult: 0.45,
    },
    // 23. hive
    {
      groups: [
        { enemy: 'swarm', count: 248, interval: 0.07, hpMult: 5.3 },
        { enemy: 'warden', count: 7, interval: 3, delay: 2, hpMult: 5.3 },
      ],
      bonus: 89, rewardMult: 0.45,
    },
    // 24. sky fortress
    {
      groups: [
        { enemy: 'wyvern', count: 22, interval: 1.4, hpMult: 5.7 },
        { enemy: 'carrier', count: 6, interval: 3.5, delay: 4, hpMult: 5.7 },
      ],
      bonus: 92, rewardMult: 0.45,
    },
    // 25. deep strike
    {
      groups: [
        { enemy: 'burrower', count: 55, interval: 0.5, hpMult: 6.2 },
        { enemy: 'phaser', count: 26, interval: 0.8, delay: 3, hpMult: 6.2 },
      ],
      bonus: 95, rewardMult: 0.45,
    },
    // 26. siege
    {
      groups: [
        { enemy: 'brute', count: 26, interval: 1.4, hpMult: 6.7 },
        { enemy: 'warden', count: 11, interval: 2.0, delay: 2, hpMult: 6.7 },
        { enemy: 'disruptor', count: 15, interval: 1.5, delay: 4, hpMult: 6.7 },
      ],
      bonus: 98, rewardMult: 0.35,
    },
    // 27. rainbow guard
    {
      groups: [
        { enemy: 'prism', count: 46, interval: 0.6, hpMult: 7.2 },
        { enemy: 'warden', count: 10, interval: 2.4, delay: 2, hpMult: 7.2 },
      ],
      bonus: 101, rewardMult: 0.35,
    },
    // 28. air supremacy
    {
      groups: [
        { enemy: 'drone', count: 86, interval: 0.28, hpMult: 7.8 },
        { enemy: 'wyvern', count: 19, interval: 1.6, delay: 3, hpMult: 7.8 },
        { enemy: 'carrier', count: 6, interval: 4, delay: 6, hpMult: 7.8 },
      ],
      bonus: 104, rewardMult: 0.35,
    },
    // 29. iron wall
    {
      groups: [
        { enemy: 'warden', count: 20, interval: 1.5, hpMult: 8.4 },
        { enemy: 'brute', count: 32, interval: 1.1, delay: 1, hpMult: 8.4 },
        { enemy: 'mirror', count: 20, interval: 1.2, delay: 3, hpMult: 8.4 },
      ],
      bonus: 107, rewardMult: 0.35,
    },
    // 30. stealth
    {
      groups: [
        { enemy: 'ghost', count: 60, interval: 0.5, hpMult: 9.1 },
        { enemy: 'burrower', count: 28, interval: 0.8, delay: 3, hpMult: 9.1 },
      ],
      bonus: 110, rewardMult: 0.35,
    },
    // 31. swarm singularity
    {
      groups: [
        { enemy: 'swarm', count: 205, interval: 0.06, hpMult: 9.8, element: 'wood' },
        { enemy: 'swarm', count: 123, interval: 0.06, delay: 4, hpMult: 9.8, element: 'fire' },
        { enemy: 'warden', count: 12, interval: 2, delay: 2, hpMult: 9.8 },
      ],
      bonus: 113, rewardMult: 0.35,
    },
    // 32. carrier armada
    {
      groups: [
        { enemy: 'carrier', count: 6, interval: 3, hpMult: 8.4 },
        { enemy: 'wyvern', count: 17, interval: 1.8, delay: 3, hpMult: 8.4 },
      ],
      bonus: 116, rewardMult: 0.35,
    },
    // 33. titans II
    {
      groups: [
        { enemy: 'brute', count: 13, interval: 2.5, hpMult: 17.1 },
        { enemy: 'wyvern', count: 11, interval: 3, delay: 3, hpMult: 17.1 },
        { enemy: 'warden', count: 13, interval: 1.8, delay: 1, hpMult: 11.4 },
        { enemy: 'burrower', count: 25, interval: 0.8, delay: 4, hpMult: 11.4 },
      ],
      bonus: 119, rewardMult: 0.3,
    },
    // 34. overclock
    {
      groups: [
        { enemy: 'runner', count: 65, interval: 0.3, hpMult: 12.3, element: 'earth' },
        { enemy: 'phaser', count: 39, interval: 0.6, delay: 2, hpMult: 12.3, element: 'water' },
        { enemy: 'burrower', count: 43, interval: 0.5, delay: 4, hpMult: 12.3, element: 'metal' },
        { enemy: 'prism', count: 34, interval: 0.6, delay: 6, hpMult: 12.3 },
      ],
      bonus: 122, rewardMult: 0.3,
    },
    // 35. nexus finale
    {
      groups: [
        { enemy: 'warden', count: 18, interval: 1.5, hpMult: 8.2 },
        { enemy: 'burrower', count: 44, interval: 0.5, delay: 2, hpMult: 8.2 },
        { enemy: 'brute', count: 26, interval: 1.3, delay: 4, hpMult: 8.2 },
        { enemy: 'disruptor', count: 22, interval: 1.0, delay: 5, hpMult: 8.2 },
        { enemy: 'carrier', count: 8, interval: 3, delay: 6, hpMult: 8.2 },
        { enemy: 'swarm', count: 131, interval: 0.08, delay: 8, hpMult: 8.2 },
        { enemy: 'wyvern', count: 18, interval: 1.8, delay: 10, hpMult: 8.2 },
        { enemy: 'jammer', count: 13, interval: 1.5, delay: 3, hpMult: 8.2 },
        { enemy: 'mirror', count: 13, interval: 1.5, delay: 7, hpMult: 8.2 },
        { enemy: 'leviathan', count: 1, interval: 1, delay: 18, hpMult: 8 },
      ],
      bonus: 0, rewardMult: 0.3,
    },
  ],
};
