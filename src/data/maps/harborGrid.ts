import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.055 per wave) and then checked with the balance bot
// in tests/game.test.ts. Edit freely; re-run `npm test` after changing numbers.

/** Map 2: long serpentine road. Introduces Shielders and Medics. */
export const HARBOR_GRID: LevelDef = {
  id: 'harbor-grid',
  name: 'Harbor Grid',
  description: 'A long back-and-forth road along the docks. New: Shielders and Medics.',
  cols: 20,
  rows: 12,
  path: [[-1, 1], [17, 1], [17, 4], [2, 4], [2, 7], [17, 7], [17, 10], [3, 10]],
  startGold: 160,
  lives: 20,
  waves: [
    // 1. basics
    {
      groups: [
        { enemy: 'grunt', count: 10, interval: 1.1 },
      ],
      bonus: 23,
    },
    // 2. runners join
    {
      groups: [
        { enemy: 'grunt', count: 8, interval: 1.0, hpMult: 1.1 },
        { enemy: 'runner', count: 8, interval: 0.8, delay: 4, hpMult: 1.1 },
      ],
      bonus: 26,
    },
    // 3. first Shielders
    {
      groups: [
        { enemy: 'shielder', count: 6, interval: 1.4, hpMult: 1.1 },
        { enemy: 'grunt', count: 6, interval: 1.0, delay: 3, hpMult: 1.1 },
      ],
      bonus: 29,
    },
    // 4. drones over the water
    {
      groups: [
        { enemy: 'drone', count: 10, interval: 1.0, delay: 2, hpMult: 1.2 },
        { enemy: 'grunt', count: 8, interval: 0.9, hpMult: 1.2 },
      ],
      bonus: 32,
    },
    // 5. shield wall
    {
      groups: [
        { enemy: 'shielder', count: 8, interval: 1.1, hpMult: 1.2 },
        { enemy: 'brute', count: 2, interval: 4, delay: 5, hpMult: 1.2 },
      ],
      bonus: 35,
    },
    // 6. first Medics
    {
      groups: [
        { enemy: 'grunt', count: 12, interval: 0.8, hpMult: 1.3 },
        { enemy: 'medic', count: 3, interval: 2.5, delay: 2, hpMult: 1.3 },
      ],
      bonus: 38,
    },
    // 7. patched-up swarm
    {
      groups: [
        { enemy: 'swarm', count: 30, interval: 0.15, hpMult: 1.4 },
        { enemy: 'medic', count: 2, interval: 3, delay: 2, hpMult: 1.4 },
      ],
      bonus: 41,
    },
    // 8. field hospital
    {
      groups: [
        { enemy: 'shielder', count: 8, interval: 1.0, hpMult: 1.5 },
        { enemy: 'medic', count: 3, interval: 2, delay: 3, hpMult: 1.5 },
      ],
      bonus: 44,
    },
    // 9. air cover
    {
      groups: [
        { enemy: 'drone', count: 15, interval: 0.6, hpMult: 1.5 },
        { enemy: 'wyvern', count: 3, interval: 3, delay: 4, hpMult: 1.5 },
      ],
      bonus: 47, rewardMult: 0.6,
    },
    // 10. convoy
    {
      groups: [
        { enemy: 'brute', count: 5, interval: 2.5, hpMult: 1.6 },
        { enemy: 'shielder', count: 6, interval: 1.2, delay: 2, hpMult: 1.6 },
        { enemy: 'medic', count: 3, interval: 2.5, delay: 4, hpMult: 1.6 },
      ],
      bonus: 50, rewardMult: 0.6,
    },
    // 11. cold runners
    {
      groups: [
        { enemy: 'runner', count: 20, interval: 0.4, hpMult: 1.7 },
        { enemy: 'shielder', count: 6, interval: 1.2, delay: 3, hpMult: 1.7, element: 'water' },
      ],
      bonus: 53, rewardMult: 0.6,
    },
    // 12. swarm with medics
    {
      groups: [
        { enemy: 'swarm', count: 40, interval: 0.12, hpMult: 1.8 },
        { enemy: 'medic', count: 4, interval: 2, delay: 2, hpMult: 1.8 },
      ],
      bonus: 56, rewardMult: 0.6,
    },
    // 13. storm clouds
    {
      groups: [
        { enemy: 'wyvern', count: 6, interval: 2, hpMult: 1.9 },
        { enemy: 'drone', count: 15, interval: 0.5, delay: 3, hpMult: 1.9 },
      ],
      bonus: 59, rewardMult: 0.6,
    },
    // 14. mixed shields
    {
      groups: [
        { enemy: 'shielder', count: 6, interval: 1, hpMult: 2.0, element: 'fire' },
        { enemy: 'shielder', count: 6, interval: 1, delay: 4, hpMult: 2.0, element: 'wood' },
        { enemy: 'medic', count: 4, interval: 2, delay: 2, hpMult: 2.0 },
      ],
      bonus: 62, rewardMult: 0.6,
    },
    // 15. elemental dockworkers
    {
      groups: [
        { enemy: 'grunt', count: 6, interval: 0.6, hpMult: 2.5, element: 'fire' },
        { enemy: 'grunt', count: 6, interval: 0.6, delay: 3, hpMult: 2.5, element: 'water' },
        { enemy: 'grunt', count: 6, interval: 0.6, delay: 6, hpMult: 2.5, element: 'wood' },
        { enemy: 'grunt', count: 6, interval: 0.6, delay: 9, hpMult: 2.5, element: 'earth' },
        { enemy: 'grunt', count: 6, interval: 0.6, delay: 12, hpMult: 2.5, element: 'metal' },
        { enemy: 'medic', count: 3, interval: 3, delay: 4, hpMult: 2.1 },
      ],
      bonus: 65, rewardMult: 0.6,
    },
    // 16. heavy freight
    {
      groups: [
        { enemy: 'brute', count: 8, interval: 1.8, hpMult: 2.2 },
        { enemy: 'shielder', count: 8, interval: 1, delay: 3, hpMult: 2.2 },
      ],
      bonus: 68, rewardMult: 0.45,
    },
    // 17. air raid
    {
      groups: [
        { enemy: 'drone', count: 25, interval: 0.4, hpMult: 2.4 },
        { enemy: 'wyvern', count: 6, interval: 2, delay: 4, hpMult: 2.4 },
        { enemy: 'medic', count: 3, interval: 2.5, delay: 2, hpMult: 2.4 },
      ],
      bonus: 71, rewardMult: 0.45,
    },
    // 18. hospital ship
    {
      groups: [
        { enemy: 'shielder', count: 15, interval: 0.8, hpMult: 2.5 },
        { enemy: 'medic', count: 6, interval: 1.5, delay: 2, hpMult: 2.5 },
        { enemy: 'swarm', count: 30, interval: 0.12, delay: 6, hpMult: 2.5 },
      ],
      bonus: 74, rewardMult: 0.45,
    },
    // 19. everything
    {
      groups: [
        { enemy: 'runner', count: 20, interval: 0.35, hpMult: 2.6 },
        { enemy: 'brute', count: 6, interval: 2, delay: 2, hpMult: 2.6 },
        { enemy: 'drone', count: 20, interval: 0.45, delay: 4, hpMult: 2.6 },
        { enemy: 'shielder', count: 10, interval: 0.9, delay: 6, hpMult: 2.6 },
        { enemy: 'medic', count: 5, interval: 2, delay: 8, hpMult: 2.6 },
      ],
      bonus: 77, rewardMult: 0.45,
    },
    // 20. harbor finale
    {
      groups: [
        { enemy: 'shielder', count: 20, interval: 0.7, hpMult: 3.3 },
        { enemy: 'medic', count: 8, interval: 1.5, delay: 2, hpMult: 2.8 },
        { enemy: 'brute', count: 8, interval: 1.8, delay: 4, hpMult: 2.8 },
        { enemy: 'wyvern', count: 6, interval: 2, delay: 8, hpMult: 2.8 },
        { enemy: 'drone', count: 20, interval: 0.4, delay: 10, hpMult: 2.8 },
        { enemy: 'brute', count: 3, interval: 3, delay: 16, hpMult: 5.5, element: 'fire' },
      ],
      bonus: 0, rewardMult: 0.45,
    },
  ],
};
