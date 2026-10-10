import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.085 per wave) and then tuned with the party
// balance bot in tests/party.test.ts. Edit freely; re-run `npm test` after changing numbers.

/**
 * Map 8: the first multiplayer map. Built so one hero can't hold it but a party of 2–5 can
 * (each player brings a hero and their own gold). Introduces Surgers.
 */
export const OVERLINK: LevelDef = {
  id: 'overlink',
  name: 'Overlink',
  description: 'Multiplayer: the network hub where every road meets. Too much for one warden; bring 2–5 players. New: Surgers speed up the enemies around them.',
  cols: 20,
  rows: 12,
  path: [[-1, 2], [3, 2], [3, 9], [8, 9], [8, 2], [12, 2], [12, 9], [17, 9], [17, 5], [15, 5]],
  obstacles: [
    { kind: 'canal', col: 0, row: 10, w: 3, h: 2 },
    { kind: 'tower', col: 18, row: 0, w: 2, h: 2 },
    { kind: 'wreck', col: 5, row: 4, w: 2, h: 2 },
    { kind: 'tower', col: 14, row: 6, w: 2, h: 2 },
    { kind: 'canal', col: 9, row: 11, w: 5, h: 1 },
  ],
  startGold: 160,
  lives: 20,
  /** All enemy HP on this map (see LevelDef.hpScale), tuned with the party bot. */
  hpScale: 3.2,
  heroStart: [10, 5],
  multiplayer: true,
  /** Multiplayer opens once Map 3 (Chrome Canyon) does, not after the whole campaign. */
  unlockedWith: 'chrome-canyon',
  waves: [
    // 1. meet the Surgers
    {
      groups: [
        { enemy: 'grunt', count: 12, interval: 1.0 },
        { enemy: 'surger', count: 3, interval: 3, delay: 4 },
      ],
      bonus: 46, rewardMult: 0.6,
    },
    // 2. runners, surged
    {
      groups: [
        { enemy: 'runner', count: 12, interval: 0.6, hpMult: 1.08 },
        { enemy: 'surger', count: 4, interval: 2.5, delay: 1, hpMult: 1.08 },
      ],
      bonus: 52, rewardMult: 0.6,
    },
    // 3. drone cloud
    {
      groups: [
        { enemy: 'drone', count: 16, interval: 0.6, hpMult: 1.18 },
        { enemy: 'grunt', count: 10, interval: 0.9, delay: 2, hpMult: 1.18, element: 'earth' },
      ],
      bonus: 58, rewardMult: 0.6,
    },
    // 4. field hospital
    {
      groups: [
        { enemy: 'shielder', count: 6, interval: 1.6, hpMult: 1.28 },
        { enemy: 'medic', count: 3, interval: 3, delay: 2, hpMult: 1.28 },
        { enemy: 'grunt', count: 12, interval: 0.8, delay: 1, hpMult: 1.28, element: 'water' },
      ],
      bonus: 64, rewardMult: 0.6,
    },
    // 5. armored push
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 1.6, hpMult: 1.39 },
        { enemy: 'surger', count: 4, interval: 2.2, delay: 2, hpMult: 1.39 },
        { enemy: 'swarm', count: 30, interval: 0.15, delay: 3, hpMult: 1.39 },
      ],
      bonus: 70, rewardMult: 0.6,
    },
    // 6. splitters
    {
      groups: [
        { enemy: 'splitter', count: 9, interval: 1.3, hpMult: 1.5 },
        { enemy: 'runner', count: 12, interval: 0.5, delay: 2, hpMult: 1.5, element: 'fire' },
      ],
      bonus: 76, rewardMult: 0.6,
    },
    // 7. carrier group
    {
      groups: [
        { enemy: 'wyvern', count: 5, interval: 2, hpMult: 1.63 },
        { enemy: 'carrier', count: 2, interval: 5, delay: 2, hpMult: 1.63 },
        { enemy: 'drone', count: 14, interval: 0.5, delay: 4, hpMult: 1.63, element: 'metal' },
      ],
      bonus: 82, rewardMult: 0.6,
    },
    // 8. ghost town
    {
      groups: [
        { enemy: 'ghost', count: 12, interval: 1.0, hpMult: 1.77 },
        { enemy: 'surger', count: 5, interval: 2, delay: 2, hpMult: 1.77 },
        { enemy: 'grunt', count: 14, interval: 0.7, delay: 3, hpMult: 1.77, element: 'wood' },
      ],
      bonus: 88, rewardMult: 0.6,
    },
    // 9. phase shift
    {
      groups: [
        { enemy: 'phaser', count: 12, interval: 1.0, hpMult: 1.92 },
        { enemy: 'prism', count: 6, interval: 1.5, delay: 3, hpMult: 1.92 },
      ],
      bonus: 94, rewardMult: 0.45,
    },
    // 10. hero hunters
    {
      groups: [
        { enemy: 'jammer', count: 6, interval: 1.8, hpMult: 2.08 },
        { enemy: 'mirror', count: 8, interval: 1.4, delay: 1, hpMult: 2.08 },
        { enemy: 'brute', count: 6, interval: 1.6, delay: 3, hpMult: 2.08, element: 'fire' },
      ],
      bonus: 100, rewardMult: 0.45,
    },
    // 11. blackout
    {
      groups: [
        { enemy: 'disruptor', count: 8, interval: 1.6, hpMult: 2.26 },
        { enemy: 'surger', count: 6, interval: 1.8, delay: 1, hpMult: 2.26 },
        { enemy: 'runner', count: 20, interval: 0.4, delay: 3, hpMult: 2.26, element: 'earth' },
      ],
      bonus: 106, rewardMult: 0.45,
    },
    // 12. under the road
    {
      groups: [
        { enemy: 'burrower', count: 12, interval: 1.0, hpMult: 2.45 },
        { enemy: 'warden', count: 4, interval: 3, delay: 2, hpMult: 2.45 },
        { enemy: 'grunt', count: 18, interval: 0.6, delay: 3, hpMult: 2.45, element: 'metal' },
      ],
      bonus: 112, rewardMult: 0.45,
    },
    // 13. surge storm
    {
      groups: [
        { enemy: 'surger', count: 14, interval: 0.8, hpMult: 2.66 },
        { enemy: 'runner', count: 30, interval: 0.3, delay: 1, hpMult: 2.66, element: 'water' },
        { enemy: 'phaser', count: 10, interval: 0.9, delay: 4, hpMult: 2.66, element: 'fire' },
      ],
      bonus: 118, rewardMult: 0.45,
    },
    // 14. air raid
    {
      groups: [
        { enemy: 'drone', count: 40, interval: 0.25, hpMult: 2.89, element: 'water' },
        { enemy: 'wyvern', count: 10, interval: 1.2, delay: 3, hpMult: 2.89 },
        { enemy: 'carrier', count: 3, interval: 4, delay: 5, hpMult: 2.89 },
      ],
      bonus: 124, rewardMult: 0.45,
    },
    // 15. titans
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 2.5, hpMult: 9.4, element: 'earth' },
        { enemy: 'wyvern', count: 4, interval: 3, delay: 3, hpMult: 9.4, element: 'metal' },
        { enemy: 'surger', count: 6, interval: 2, delay: 1, hpMult: 3.13 },
      ],
      bonus: 130, rewardMult: 0.45,
    },
    // 16. fortress
    {
      groups: [
        { enemy: 'warden', count: 8, interval: 2, hpMult: 3.4 },
        { enemy: 'brute', count: 14, interval: 1.2, delay: 1, hpMult: 3.4, element: 'wood' },
        { enemy: 'shielder', count: 10, interval: 1.2, delay: 3, hpMult: 3.4 },
      ],
      bonus: 136, rewardMult: 0.35,
    },
    // 17. hive
    {
      groups: [
        { enemy: 'swarm', count: 120, interval: 0.08, hpMult: 3.69 },
        { enemy: 'splitter', count: 12, interval: 0.8, delay: 4, hpMult: 3.69, element: 'water' },
        { enemy: 'surger', count: 8, interval: 1.4, delay: 2, hpMult: 3.69 },
      ],
      bonus: 142, rewardMult: 0.35,
    },
    // 18. elemental chaos
    {
      groups: [
        { enemy: 'grunt', count: 15, interval: 0.4, hpMult: 4.0, element: 'fire' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 1, hpMult: 4.0, element: 'water' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 2, hpMult: 4.0, element: 'wood' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 3, hpMult: 4.0, element: 'earth' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 4, hpMult: 4.0, element: 'metal' },
        { enemy: 'prism', count: 10, interval: 1, delay: 5, hpMult: 4.0 },
      ],
      bonus: 148, rewardMult: 0.35,
    },
    // 19. hunter pack
    {
      groups: [
        { enemy: 'jammer', count: 10, interval: 1.2, hpMult: 4.34 },
        { enemy: 'mirror', count: 14, interval: 0.9, delay: 1, hpMult: 4.34 },
        { enemy: 'ghost', count: 14, interval: 0.9, delay: 3, hpMult: 4.34, element: 'earth' },
        { enemy: 'surger', count: 8, interval: 1.4, delay: 2, hpMult: 4.34 },
      ],
      bonus: 154, rewardMult: 0.35,
    },
    // 20. blitz
    {
      groups: [
        { enemy: 'surger', count: 16, interval: 0.7, hpMult: 4.71 },
        { enemy: 'runner', count: 40, interval: 0.25, delay: 0.5, hpMult: 4.71, element: 'metal' },
        { enemy: 'phaser', count: 16, interval: 0.7, delay: 3, hpMult: 4.71, element: 'water' },
      ],
      bonus: 160, rewardMult: 0.35,
    },
    // 21. siege
    {
      groups: [
        { enemy: 'brute', count: 20, interval: 0.9, hpMult: 5.11, element: 'metal' },
        { enemy: 'disruptor', count: 12, interval: 1.2, delay: 2, hpMult: 5.11 },
        { enemy: 'warden', count: 8, interval: 2, delay: 3, hpMult: 5.11 },
        { enemy: 'burrower', count: 16, interval: 0.7, delay: 4, hpMult: 5.11, element: 'fire' },
      ],
      bonus: 166, rewardMult: 0.3,
    },
    // 22. armada (lighter since skill points: it was an all-or-nothing air wave for pairs)
    {
      groups: [
        { enemy: 'carrier', count: 4, interval: 3.5, hpMult: 5.55 },
        { enemy: 'wyvern', count: 14, interval: 1.1, delay: 2, hpMult: 5.55, element: 'water' },
        { enemy: 'drone', count: 34, interval: 0.25, delay: 4, hpMult: 5.55, element: 'wood' },
      ],
      bonus: 172, rewardMult: 0.3,
    },
    // 23. overclock
    {
      groups: [
        { enemy: 'surger', count: 20, interval: 0.6, hpMult: 6.02 },
        { enemy: 'runner', count: 50, interval: 0.2, delay: 1, hpMult: 6.02, element: 'fire' },
        { enemy: 'phaser', count: 20, interval: 0.6, delay: 3, hpMult: 6.02, element: 'earth' },
        { enemy: 'burrower', count: 20, interval: 0.6, delay: 5, hpMult: 6.02, element: 'water' },
      ],
      bonus: 178, rewardMult: 0.3,
    },
    // 24. last link
    {
      groups: [
        { enemy: 'warden', count: 10, interval: 1.5, hpMult: 6.53 },
        { enemy: 'shielder', count: 16, interval: 0.9, delay: 1, hpMult: 6.53 },
        { enemy: 'medic', count: 8, interval: 2, delay: 2, hpMult: 6.53 },
        { enemy: 'splitter', count: 16, interval: 0.8, delay: 4, hpMult: 6.53, element: 'metal' },
        { enemy: 'mirror', count: 12, interval: 1, delay: 5, hpMult: 6.53 },
        { enemy: 'jammer', count: 10, interval: 1.2, delay: 6, hpMult: 6.53 },
      ],
      bonus: 184, rewardMult: 0.3,
    },
    // 25. overlink finale
    {
      groups: [
        { enemy: 'surger', count: 20, interval: 0.8, hpMult: 6.38 },
        { enemy: 'brute', count: 20, interval: 1, delay: 1, hpMult: 6.38 },
        { enemy: 'disruptor', count: 12, interval: 1.2, delay: 2, hpMult: 6.38 },
        { enemy: 'burrower', count: 24, interval: 0.6, delay: 3, hpMult: 6.38 },
        { enemy: 'wyvern', count: 14, interval: 1.4, delay: 5, hpMult: 6.38 },
        { enemy: 'swarm', count: 100, interval: 0.08, delay: 7, hpMult: 6.38 },
        { enemy: 'colossus', count: 1, interval: 1, delay: 16, hpMult: 18.0, element: 'fire' },
      ],
      bonus: 0, rewardMult: 0.3,
    },
  ],
};
