import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.090 per wave) and then checked with the balance bot
// in tests/game.test.ts. Edit freely; re-run `npm test` after changing numbers.

/** Map 5: the hero map. Introduces Jammers (they stop hero cooldowns) and Mirrors (immune to the hero). */
export const ZERO_POINT: LevelDef = {
  id: 'zero-point',
  name: 'Zero Point',
  description: 'Command the hero Vex: move with right-click, abilities on Z X C V. New: Jammers and Mirrors.',
  cols: 20,
  rows: 12,
  path: [[-1, 6], [3, 6], [3, 2], [8, 2], [8, 9], [12, 9], [12, 3], [16, 3], [16, 8], [18, 8]],
  startGold: 170,
  lives: 20,
  heroStart: [10, 5],
  // Temporarily playable without clearing the earlier maps. Remove to restore the unlock order.
  unlocked: true,
  waves: [
    // 1. meet Vex
    {
      groups: [
        { enemy: 'grunt', count: 10, interval: 1.1 },
      ],
      bonus: 23,
    },
    // 2. mixed patrol
    {
      groups: [
        { enemy: 'grunt', count: 8, interval: 1.0, hpMult: 1.1 },
        { enemy: 'runner', count: 8, interval: 0.8, delay: 4, hpMult: 1.1 },
      ],
      bonus: 26,
    },
    // 3. shields up
    {
      groups: [
        { enemy: 'shielder', count: 6, interval: 1.4, hpMult: 1.2 },
        { enemy: 'drone', count: 6, interval: 1.0, delay: 3, hpMult: 1.2 },
      ],
      bonus: 29,
    },
    // 4. first Jammers
    {
      groups: [
        { enemy: 'jammer', count: 4, interval: 2, hpMult: 1.3 },
        { enemy: 'grunt', count: 10, interval: 0.9, delay: 1, hpMult: 1.3 },
      ],
      bonus: 32,
    },
    // 5. splitting image
    {
      groups: [
        { enemy: 'splitter', count: 6, interval: 1.4, hpMult: 1.4 },
        { enemy: 'jammer', count: 3, interval: 2.5, delay: 3, hpMult: 1.4 },
      ],
      bonus: 35,
    },
    // 6. medic run
    {
      groups: [
        { enemy: 'medic', count: 3, interval: 2.5, hpMult: 1.5 },
        { enemy: 'grunt', count: 12, interval: 0.8, delay: 1, hpMult: 1.5 },
        { enemy: 'runner', count: 8, interval: 0.6, delay: 5, hpMult: 1.5 },
      ],
      bonus: 38,
    },
    // 7. first Mirrors
    {
      groups: [
        { enemy: 'mirror', count: 5, interval: 2, hpMult: 1.7 },
        { enemy: 'grunt', count: 8, interval: 1.0, delay: 2, hpMult: 1.7 },
      ],
      bonus: 41,
    },
    // 8. ghost signal
    {
      groups: [
        { enemy: 'ghost', count: 8, interval: 1.1, hpMult: 1.8 },
        { enemy: 'jammer', count: 3, interval: 2.5, delay: 3, hpMult: 1.8 },
      ],
      bonus: 44,
    },
    // 9. phase jam
    {
      groups: [
        { enemy: 'phaser', count: 8, interval: 1.2, hpMult: 2.0 },
        { enemy: 'jammer', count: 4, interval: 2, delay: 2, hpMult: 2.0 },
      ],
      bonus: 47, rewardMult: 0.6,
    },
    // 10. milestone
    {
      groups: [
        { enemy: 'brute', count: 5, interval: 2.5, hpMult: 2.2 },
        { enemy: 'mirror', count: 5, interval: 1.8, delay: 2, hpMult: 2.2 },
        { enemy: 'medic', count: 3, interval: 2.5, delay: 4, hpMult: 2.2 },
        { enemy: 'carrier', count: 1, interval: 1, delay: 6, hpMult: 2.2 },
      ],
      bonus: 50, rewardMult: 0.6,
    },
    // 11. air jam
    {
      groups: [
        { enemy: 'drone', count: 20, interval: 0.5, hpMult: 2.4 },
        { enemy: 'wyvern', count: 4, interval: 2.5, delay: 3, hpMult: 2.4 },
        { enemy: 'jammer', count: 4, interval: 2, delay: 2, hpMult: 2.4 },
      ],
      bonus: 53, rewardMult: 0.6,
    },
    // 12. hall of mirrors
    {
      groups: [
        { enemy: 'mirror', count: 10, interval: 1.1, hpMult: 2.6 },
        { enemy: 'shielder', count: 6, interval: 1.2, delay: 3, hpMult: 2.6 },
      ],
      bonus: 56, rewardMult: 0.6,
    },
    // 13. swarm static
    {
      groups: [
        { enemy: 'swarm', count: 40, interval: 0.12, hpMult: 2.8 },
        { enemy: 'jammer', count: 5, interval: 1.8, delay: 2, hpMult: 2.8 },
        { enemy: 'ghost', count: 6, interval: 1, delay: 5, hpMult: 2.8 },
      ],
      bonus: 59, rewardMult: 0.6,
    },
    // 14. fortress
    {
      groups: [
        { enemy: 'brute', count: 8, interval: 1.8, hpMult: 3.1 },
        { enemy: 'shielder', count: 8, interval: 1, delay: 2, hpMult: 3.1 },
        { enemy: 'medic', count: 4, interval: 2, delay: 4, hpMult: 3.1 },
      ],
      bonus: 62, rewardMult: 0.6,
    },
    // 15. phantom fleet
    {
      groups: [
        { enemy: 'carrier', count: 2, interval: 5, hpMult: 3.3 },
        { enemy: 'ghost', count: 12, interval: 0.8, delay: 2, hpMult: 3.3 },
        { enemy: 'drone', count: 12, interval: 0.5, delay: 4, hpMult: 3.3 },
      ],
      bonus: 65, rewardMult: 0.6,
    },
    // 16. elemental mirrors
    {
      groups: [
        { enemy: 'mirror', count: 5, interval: 1, hpMult: 3.6, element: 'fire' },
        { enemy: 'mirror', count: 5, interval: 1, delay: 4, hpMult: 3.6, element: 'wood' },
        { enemy: 'jammer', count: 5, interval: 1.5, delay: 2, hpMult: 3.6, element: 'earth' },
      ],
      bonus: 68, rewardMult: 0.45,
    },
    // 17. blitz
    {
      groups: [
        { enemy: 'runner', count: 30, interval: 0.3, hpMult: 4.0 },
        { enemy: 'phaser', count: 10, interval: 0.9, delay: 3, hpMult: 4.0 },
        { enemy: 'splitter', count: 8, interval: 1.1, delay: 6, hpMult: 4.0 },
      ],
      bonus: 71, rewardMult: 0.45,
    },
    // 18. sky siege
    {
      groups: [
        { enemy: 'wyvern', count: 8, interval: 2, hpMult: 4.3 },
        { enemy: 'carrier', count: 3, interval: 4, delay: 3, hpMult: 4.3 },
        { enemy: 'jammer', count: 6, interval: 1.5, delay: 2, hpMult: 4.3 },
      ],
      bonus: 74, rewardMult: 0.45,
    },
    // 19. triage
    {
      groups: [
        { enemy: 'medic', count: 6, interval: 1.5, hpMult: 4.7 },
        { enemy: 'shielder', count: 12, interval: 0.8, delay: 1, hpMult: 4.7 },
        { enemy: 'mirror', count: 8, interval: 1, delay: 4, hpMult: 4.7 },
      ],
      bonus: 77, rewardMult: 0.45,
    },
    // 20. titans
    {
      groups: [
        { enemy: 'brute', count: 4, interval: 4, hpMult: 15.4 },
        { enemy: 'mirror', count: 3, interval: 4, delay: 2, hpMult: 12.9 },
        { enemy: 'grunt', count: 25, interval: 0.5, delay: 1, hpMult: 5.1 },
        { enemy: 'jammer', count: 6, interval: 1.5, delay: 5, hpMult: 5.1 },
      ],
      bonus: 80, rewardMult: 0.45,
    },
    // 21. ghost town
    {
      groups: [
        { enemy: 'ghost', count: 20, interval: 0.6, hpMult: 5.6 },
        { enemy: 'splitter', count: 12, interval: 0.9, delay: 3, hpMult: 5.6 },
        { enemy: 'jammer', count: 5, interval: 1.6, delay: 6, hpMult: 5.6 },
      ],
      bonus: 83, rewardMult: 0.45,
    },
    // 22. air supremacy
    {
      groups: [
        { enemy: 'drone', count: 35, interval: 0.3, hpMult: 6.1 },
        { enemy: 'wyvern', count: 8, interval: 1.8, delay: 3, hpMult: 6.1 },
        { enemy: 'carrier', count: 3, interval: 4, delay: 6, hpMult: 6.1 },
      ],
      bonus: 86, rewardMult: 0.45,
    },
    // 23. mirror maze
    {
      groups: [
        { enemy: 'mirror', count: 16, interval: 0.8, hpMult: 6.7 },
        { enemy: 'phaser', count: 12, interval: 0.8, delay: 3, hpMult: 6.7 },
        { enemy: 'medic', count: 5, interval: 1.8, delay: 5, hpMult: 6.7 },
      ],
      bonus: 89, rewardMult: 0.45,
    },
    // 24. static storm
    {
      groups: [
        { enemy: 'jammer', count: 12, interval: 1, hpMult: 7.3 },
        { enemy: 'swarm', count: 50, interval: 0.1, delay: 2, hpMult: 7.3 },
        { enemy: 'shielder', count: 10, interval: 0.9, delay: 5, hpMult: 7.3 },
      ],
      bonus: 92, rewardMult: 0.45,
    },
    // 25. elemental chaos
    {
      groups: [
        { enemy: 'ghost', count: 8, interval: 0.8, hpMult: 7.9, element: 'fire' },
        { enemy: 'splitter', count: 8, interval: 0.9, delay: 2, hpMult: 7.9, element: 'water' },
        { enemy: 'phaser', count: 8, interval: 0.8, delay: 4, hpMult: 7.9, element: 'metal' },
        { enemy: 'mirror', count: 6, interval: 1, delay: 6, hpMult: 7.9, element: 'earth' },
        { enemy: 'jammer', count: 6, interval: 1, delay: 8, hpMult: 7.9, element: 'wood' },
      ],
      bonus: 95, rewardMult: 0.45,
    },
    // 26. carrier wing
    {
      groups: [
        { enemy: 'carrier', count: 5, interval: 3, hpMult: 8.6 },
        { enemy: 'wyvern', count: 8, interval: 1.8, delay: 2, hpMult: 8.6 },
        { enemy: 'drone', count: 25, interval: 0.35, delay: 4, hpMult: 8.6 },
      ],
      bonus: 98, rewardMult: 0.35,
    },
    // 27. juggernauts
    {
      groups: [
        { enemy: 'brute', count: 12, interval: 1.5, hpMult: 9.4 },
        { enemy: 'shielder', count: 12, interval: 0.9, delay: 2, hpMult: 9.4 },
        { enemy: 'medic', count: 6, interval: 1.6, delay: 4, hpMult: 9.4 },
        { enemy: 'mirror', count: 8, interval: 1, delay: 6, hpMult: 9.4 },
      ],
      bonus: 101, rewardMult: 0.35,
    },
    // 28. phase storm
    {
      groups: [
        { enemy: 'phaser', count: 20, interval: 0.5, hpMult: 10.2 },
        { enemy: 'runner', count: 30, interval: 0.25, delay: 2, hpMult: 10.2 },
        { enemy: 'jammer', count: 8, interval: 1.2, delay: 4, hpMult: 10.2 },
      ],
      bonus: 104, rewardMult: 0.35,
    },
    // 29. last signal
    {
      groups: [
        { enemy: 'ghost', count: 20, interval: 0.5, hpMult: 11.2 },
        { enemy: 'mirror', count: 14, interval: 0.8, delay: 2, hpMult: 11.2 },
        { enemy: 'carrier', count: 4, interval: 3.5, delay: 4, hpMult: 11.2 },
        { enemy: 'swarm', count: 50, interval: 0.08, delay: 6, hpMult: 11.2 },
      ],
      bonus: 107, rewardMult: 0.35,
    },
    // 30. zero point
    {
      groups: [
        { enemy: 'mirror', count: 11, interval: 0.8, hpMult: 9.7 },
        { enemy: 'jammer', count: 8, interval: 1, delay: 2, hpMult: 11.0 },
        { enemy: 'shielder', count: 10, interval: 0.7, delay: 4, hpMult: 10.3 },
        { enemy: 'medic', count: 5, interval: 1.5, delay: 6, hpMult: 11.0 },
        { enemy: 'phaser', count: 14, interval: 0.6, delay: 8, hpMult: 11.0 },
        { enemy: 'carrier', count: 3, interval: 3, delay: 10, hpMult: 11.0 },
        { enemy: 'brute', count: 8, interval: 1.4, delay: 12, hpMult: 11.0 },
        { enemy: 'brute', count: 3, interval: 3, delay: 20, hpMult: 24.3, element: 'fire' },
      ],
      bonus: 0, rewardMult: 0.35,
    },
  ],
};
