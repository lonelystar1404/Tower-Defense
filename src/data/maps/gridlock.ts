import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.07 per wave, gentler than Overlink's so the
// ten extra waves don't end on a wall) and then tuned with the party balance bot in
// tests/party.test.ts. Edit freely; re-run `npm test` after changing numbers.

/**
 * Map 9: the second multiplayer map. As hard as Overlink, but 35 waves instead of 25: one hero
 * can't hold it, a party of 2–5 can. Every campaign enemy returns; the Chimera closes it.
 */
export const GRIDLOCK: LevelDef = {
  id: 'gridlock',
  name: 'Gridlock',
  description: 'Multiplayer: the jammed backbone of the city network, 35 waves deep. Every enemy returns and the Chimera waits at the end. Bring 2–5 players.',
  cols: 20,
  rows: 12,
  path: [[2, -1], [2, 9], [6, 9], [6, 2], [10, 2], [10, 9], [14, 9], [14, 2], [17, 2], [17, 6]],
  obstacles: [
    { kind: 'tower', col: 0, row: 0, w: 2, h: 2 },
    { kind: 'canal', col: 3, row: 11, w: 5, h: 1 },
    { kind: 'wreck', col: 3, row: 4, w: 2, h: 2 },
    { kind: 'tower', col: 11, row: 4, w: 2, h: 2 },
    { kind: 'canal', col: 15, row: 11, w: 5, h: 1 },
    { kind: 'wreck', col: 18, row: 8, w: 2, h: 2 },
  ],
  startGold: 160,
  lives: 20,
  /** All enemy HP on this map (see LevelDef.hpScale), tuned with the party bot. */
  hpScale: 3,
  heroStart: [8, 6],
  multiplayer: true,
  waves: [
    // 1. meet the backbone
    {
      groups: [
        { enemy: 'grunt', count: 12, interval: 1 },
        { enemy: 'surger', count: 3, interval: 3, delay: 4 },
      ],
      bonus: 46, rewardMult: 0.6,
    },
    // 2. runners, surged
    {
      groups: [
        { enemy: 'runner', count: 12, interval: 0.6, hpMult: 1.07 },
        { enemy: 'surger', count: 4, interval: 2.5, delay: 1, hpMult: 1.07 },
      ],
      bonus: 52, rewardMult: 0.6,
    },
    // 3. drone cloud
    {
      groups: [
        { enemy: 'drone', count: 16, interval: 0.6, hpMult: 1.14 },
        { enemy: 'grunt', count: 10, interval: 0.9, delay: 2, hpMult: 1.14, element: 'earth' },
      ],
      bonus: 58, rewardMult: 0.6,
    },
    // 4. field hospital
    {
      groups: [
        { enemy: 'shielder', count: 6, interval: 1.6, hpMult: 1.23 },
        { enemy: 'medic', count: 3, interval: 3, delay: 2, hpMult: 1.23 },
        { enemy: 'grunt', count: 12, interval: 0.8, delay: 1, hpMult: 1.23, element: 'water' },
      ],
      bonus: 64, rewardMult: 0.6,
    },
    // 5. armored push
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 1.6, hpMult: 1.31 },
        { enemy: 'surger', count: 4, interval: 2.2, delay: 2, hpMult: 1.31 },
        { enemy: 'swarm', count: 30, interval: 0.15, delay: 3, hpMult: 1.31 },
      ],
      bonus: 70, rewardMult: 0.6,
    },
    // 6. splitters
    {
      groups: [
        { enemy: 'splitter', count: 9, interval: 1.3, hpMult: 1.4 },
        { enemy: 'runner', count: 12, interval: 0.5, delay: 2, hpMult: 1.4, element: 'fire' },
      ],
      bonus: 76, rewardMult: 0.6,
    },
    // 7. carrier group
    {
      groups: [
        { enemy: 'wyvern', count: 5, interval: 2, hpMult: 1.5 },
        { enemy: 'carrier', count: 2, interval: 5, delay: 2, hpMult: 1.5 },
        { enemy: 'drone', count: 14, interval: 0.5, delay: 4, hpMult: 1.5, element: 'metal' },
      ],
      bonus: 82, rewardMult: 0.6,
    },
    // 8. ghost town
    {
      groups: [
        { enemy: 'ghost', count: 12, interval: 1, hpMult: 1.61 },
        { enemy: 'surger', count: 5, interval: 2, delay: 2, hpMult: 1.61 },
        { enemy: 'grunt', count: 14, interval: 0.7, delay: 3, hpMult: 1.61, element: 'wood' },
      ],
      bonus: 88, rewardMult: 0.6,
    },
    // 9. phase shift
    {
      groups: [
        { enemy: 'phaser', count: 12, interval: 1, hpMult: 1.72 },
        { enemy: 'prism', count: 6, interval: 1.5, delay: 3, hpMult: 1.72 },
      ],
      bonus: 94, rewardMult: 0.45,
    },
    // 10. hero hunters
    {
      groups: [
        { enemy: 'jammer', count: 6, interval: 1.8, hpMult: 1.84 },
        { enemy: 'mirror', count: 8, interval: 1.4, delay: 1, hpMult: 1.84 },
        { enemy: 'brute', count: 6, interval: 1.6, delay: 3, hpMult: 1.84, element: 'fire' },
      ],
      bonus: 100, rewardMult: 0.45,
    },
    // 11. blackout
    {
      groups: [
        { enemy: 'disruptor', count: 8, interval: 1.6, hpMult: 1.97 },
        { enemy: 'surger', count: 6, interval: 1.8, delay: 1, hpMult: 1.97 },
        { enemy: 'runner', count: 20, interval: 0.4, delay: 3, hpMult: 1.97, element: 'earth' },
      ],
      bonus: 106, rewardMult: 0.45,
    },
    // 12. under the road
    {
      groups: [
        { enemy: 'burrower', count: 12, interval: 1, hpMult: 2.1 },
        { enemy: 'warden', count: 4, interval: 3, delay: 2, hpMult: 2.1 },
        { enemy: 'grunt', count: 18, interval: 0.6, delay: 3, hpMult: 2.1, element: 'metal' },
      ],
      bonus: 112, rewardMult: 0.45,
    },
    // 13. surge storm
    {
      groups: [
        { enemy: 'surger', count: 14, interval: 0.8, hpMult: 2.25 },
        { enemy: 'runner', count: 30, interval: 0.3, delay: 1, hpMult: 2.25, element: 'water' },
        { enemy: 'phaser', count: 10, interval: 0.9, delay: 4, hpMult: 2.25, element: 'fire' },
      ],
      bonus: 118, rewardMult: 0.45,
    },
    // 14. air raid (lighter since skill points: an all-or-nothing air wave for pairs)
    {
      groups: [
        { enemy: 'drone', count: 34, interval: 0.25, hpMult: 2.41, element: 'water' },
        { enemy: 'wyvern', count: 9, interval: 1.3, delay: 3, hpMult: 2.41 },
        { enemy: 'carrier', count: 2, interval: 4, delay: 5, hpMult: 2.41 },
      ],
      bonus: 124, rewardMult: 0.45,
    },
    // 15. titans
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 2.5, hpMult: 7.74, element: 'earth' },
        { enemy: 'wyvern', count: 4, interval: 3, delay: 3, hpMult: 7.74, element: 'metal' },
        { enemy: 'surger', count: 6, interval: 2, delay: 1, hpMult: 2.58 },
      ],
      bonus: 130, rewardMult: 0.45,
    },
    // 16. fortress
    {
      groups: [
        { enemy: 'warden', count: 8, interval: 2, hpMult: 2.76 },
        { enemy: 'brute', count: 14, interval: 1.2, delay: 1, hpMult: 2.76, element: 'wood' },
        { enemy: 'shielder', count: 10, interval: 1.2, delay: 3, hpMult: 2.76 },
      ],
      bonus: 136, rewardMult: 0.35,
    },
    // 17. hive
    {
      groups: [
        { enemy: 'swarm', count: 120, interval: 0.08, hpMult: 2.95 },
        { enemy: 'splitter', count: 12, interval: 0.8, delay: 4, hpMult: 2.95, element: 'water' },
        { enemy: 'surger', count: 8, interval: 1.4, delay: 2, hpMult: 2.95 },
      ],
      bonus: 142, rewardMult: 0.35,
    },
    // 18. elemental chaos
    {
      groups: [
        { enemy: 'grunt', count: 15, interval: 0.4, hpMult: 3.16, element: 'fire' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 1, hpMult: 3.16, element: 'water' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 2, hpMult: 3.16, element: 'wood' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 3, hpMult: 3.16, element: 'earth' },
        { enemy: 'grunt', count: 15, interval: 0.4, delay: 4, hpMult: 3.16, element: 'metal' },
        { enemy: 'prism', count: 10, interval: 1, delay: 5, hpMult: 3.16 },
      ],
      bonus: 148, rewardMult: 0.35,
    },
    // 19. hunter pack
    {
      groups: [
        { enemy: 'jammer', count: 10, interval: 1.2, hpMult: 3.38 },
        { enemy: 'mirror', count: 14, interval: 0.9, delay: 1, hpMult: 3.38 },
        { enemy: 'ghost', count: 14, interval: 0.9, delay: 3, hpMult: 3.38, element: 'earth' },
        { enemy: 'surger', count: 8, interval: 1.4, delay: 2, hpMult: 3.38 },
      ],
      bonus: 154, rewardMult: 0.35,
    },
    // 20. blitz
    {
      groups: [
        { enemy: 'surger', count: 16, interval: 0.7, hpMult: 3.62 },
        { enemy: 'runner', count: 40, interval: 0.25, delay: 0.5, hpMult: 3.62, element: 'metal' },
        { enemy: 'phaser', count: 16, interval: 0.7, delay: 3, hpMult: 3.62, element: 'water' },
      ],
      bonus: 160, rewardMult: 0.35,
    },
    // 21. siege
    {
      groups: [
        { enemy: 'brute', count: 20, interval: 0.9, hpMult: 3.87, element: 'metal' },
        { enemy: 'disruptor', count: 12, interval: 1.2, delay: 2, hpMult: 3.87 },
        { enemy: 'warden', count: 8, interval: 2, delay: 3, hpMult: 3.87 },
        { enemy: 'burrower', count: 16, interval: 0.7, delay: 4, hpMult: 3.87, element: 'fire' },
      ],
      bonus: 166, rewardMult: 0.35,
    },
    // 22. armada
    {
      groups: [
        { enemy: 'carrier', count: 4, interval: 3.5, hpMult: 4.14 },
        { enemy: 'wyvern', count: 14, interval: 1.1, delay: 2, hpMult: 4.14, element: 'water' },
        { enemy: 'drone', count: 34, interval: 0.25, delay: 4, hpMult: 4.14, element: 'wood' },
      ],
      bonus: 172, rewardMult: 0.35,
    },
    // 23. overclock
    {
      groups: [
        { enemy: 'surger', count: 20, interval: 0.6, hpMult: 4.43 },
        { enemy: 'runner', count: 50, interval: 0.2, delay: 1, hpMult: 4.43, element: 'fire' },
        { enemy: 'phaser', count: 20, interval: 0.6, delay: 3, hpMult: 4.43, element: 'earth' },
        { enemy: 'burrower', count: 20, interval: 0.6, delay: 5, hpMult: 4.43, element: 'water' },
      ],
      bonus: 178, rewardMult: 0.35,
    },
    // 24. shield wall
    {
      groups: [
        { enemy: 'shielder', count: 20, interval: 0.7, hpMult: 4.74 },
        { enemy: 'medic', count: 8, interval: 1.8, delay: 1, hpMult: 4.74 },
        { enemy: 'warden', count: 8, interval: 2, delay: 2, hpMult: 4.74 },
        { enemy: 'brute', count: 12, interval: 1, delay: 4, hpMult: 4.74, element: 'water' },
      ],
      bonus: 184, rewardMult: 0.35,
    },
    // 25. prism storm
    {
      groups: [
        { enemy: 'prism', count: 24, interval: 0.6, hpMult: 5.07 },
        { enemy: 'splitter', count: 14, interval: 0.8, delay: 2, hpMult: 5.07, element: 'wood' },
        { enemy: 'surger', count: 10, interval: 1.2, delay: 3, hpMult: 5.07 },
      ],
      bonus: 190, rewardMult: 0.35,
    },
    // 26. titans II
    {
      groups: [
        { enemy: 'brute', count: 8, interval: 2.2, hpMult: 13.57, element: 'fire' },
        { enemy: 'wyvern', count: 6, interval: 2.6, delay: 2, hpMult: 13.57, element: 'wood' },
        { enemy: 'warden', count: 6, interval: 2.5, delay: 1, hpMult: 5.43 },
        { enemy: 'surger', count: 10, interval: 1.4, delay: 3, hpMult: 5.43 },
      ],
      bonus: 196, rewardMult: 0.3,
    },
    // 27. night shift
    {
      groups: [
        { enemy: 'ghost', count: 24, interval: 0.6, hpMult: 5.81 },
        { enemy: 'burrower', count: 24, interval: 0.6, delay: 2, hpMult: 5.81, element: 'metal' },
        { enemy: 'phaser', count: 16, interval: 0.8, delay: 5, hpMult: 5.81 },
      ],
      bonus: 202, rewardMult: 0.3,
    },
    // 28. swarm singularity
    {
      groups: [
        { enemy: 'swarm', count: 60, interval: 0.06, hpMult: 6.21, element: 'fire' },
        { enemy: 'swarm', count: 60, interval: 0.06, delay: 3, hpMult: 6.21, element: 'water' },
        { enemy: 'swarm', count: 60, interval: 0.06, delay: 6, hpMult: 6.21, element: 'earth' },
        { enemy: 'surger', count: 12, interval: 1, delay: 2, hpMult: 6.21 },
      ],
      bonus: 208, rewardMult: 0.3,
    },
    // 29. sky fortress (lighter since skill points)
    {
      groups: [
        { enemy: 'carrier', count: 4, interval: 3.5, hpMult: 6.65 },
        { enemy: 'wyvern', count: 16, interval: 1.1, delay: 2, hpMult: 6.65, element: 'earth' },
        { enemy: 'drone', count: 34, interval: 0.25, delay: 4, hpMult: 6.65, element: 'fire' },
      ],
      bonus: 214, rewardMult: 0.3,
    },
    // 30. jam session
    {
      groups: [
        { enemy: 'jammer', count: 14, interval: 1, hpMult: 7.11 },
        { enemy: 'mirror', count: 18, interval: 0.8, delay: 1, hpMult: 7.11 },
        { enemy: 'disruptor', count: 14, interval: 1, delay: 3, hpMult: 7.11 },
        { enemy: 'runner', count: 40, interval: 0.25, delay: 5, hpMult: 7.11, element: 'wood' },
      ],
      bonus: 220, rewardMult: 0.3,
    },
    // 31. iron curtain
    {
      groups: [
        { enemy: 'brute', count: 28, interval: 0.7, hpMult: 7.61, element: 'earth' },
        { enemy: 'warden', count: 10, interval: 1.6, delay: 2, hpMult: 7.61 },
        { enemy: 'shielder', count: 18, interval: 0.8, delay: 4, hpMult: 7.61 },
        { enemy: 'medic', count: 8, interval: 2, delay: 5, hpMult: 7.61 },
      ],
      bonus: 226, rewardMult: 0.3,
    },
    // 32. all surged
    {
      groups: [
        { enemy: 'surger', count: 26, interval: 0.5, hpMult: 8.15 },
        { enemy: 'runner', count: 50, interval: 0.2, delay: 1, hpMult: 8.15, element: 'earth' },
        { enemy: 'burrower', count: 24, interval: 0.5, delay: 3, hpMult: 8.15, element: 'wood' },
        { enemy: 'phaser', count: 24, interval: 0.5, delay: 5, hpMult: 8.15, element: 'metal' },
      ],
      bonus: 232, rewardMult: 0.3,
    },
    // 33. air supremacy (lighter since skill points)
    {
      groups: [
        { enemy: 'drone', count: 42, interval: 0.22, hpMult: 8.72, element: 'metal' },
        { enemy: 'wyvern', count: 16, interval: 1.1, delay: 3, hpMult: 8.72, element: 'fire' },
        { enemy: 'carrier', count: 4, interval: 3.5, delay: 5, hpMult: 8.72 },
      ],
      bonus: 238, rewardMult: 0.3,
    },
    // 34. deadlock
    {
      groups: [
        { enemy: 'warden', count: 12, interval: 1.3, hpMult: 9.33 },
        { enemy: 'shielder', count: 20, interval: 0.8, delay: 1, hpMult: 9.33 },
        { enemy: 'splitter', count: 20, interval: 0.7, delay: 3, hpMult: 9.33, element: 'fire' },
        { enemy: 'mirror', count: 14, interval: 0.9, delay: 4, hpMult: 9.33 },
        { enemy: 'jammer', count: 12, interval: 1, delay: 5, hpMult: 9.33 },
        { enemy: 'prism', count: 12, interval: 1, delay: 6, hpMult: 9.33 },
      ],
      bonus: 244, rewardMult: 0.3,
    },
    // 35. gridlock finale
    {
      groups: [
        { enemy: 'surger', count: 24, interval: 0.7, hpMult: 8.98 },
        { enemy: 'brute', count: 24, interval: 0.9, delay: 1, hpMult: 8.98 },
        { enemy: 'disruptor', count: 14, interval: 1.1, delay: 2, hpMult: 8.98 },
        { enemy: 'burrower', count: 28, interval: 0.5, delay: 3, hpMult: 8.98 },
        { enemy: 'wyvern', count: 16, interval: 1.2, delay: 5, hpMult: 8.98 },
        { enemy: 'swarm', count: 120, interval: 0.07, delay: 7, hpMult: 8.98 },
        { enemy: 'chimera', count: 1, interval: 1, delay: 18, hpMult: 28, element: 'earth' },
      ],
      bonus: 0, rewardMult: 0.3,
    },
  ],
};
