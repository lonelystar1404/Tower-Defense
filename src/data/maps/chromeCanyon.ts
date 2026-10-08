import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.062 per wave) and then checked with the balance bot
// in tests/game.test.ts. Edit freely; re-run `npm test` after changing numbers.

/** Map 3: enemies enter from the top. Introduces Splitters (and their Shards) and Ghosts. */
export const CHROME_CANYON: LevelDef = {
  id: 'chrome-canyon',
  name: 'Chrome Canyon',
  description: 'Enemies drop in from the top of the canyon. New: Splitters and Ghosts.',
  cols: 20,
  rows: 12,
  path: [[3, -1], [3, 9], [8, 9], [8, 2], [13, 2], [13, 9], [17, 9], [17, 4]],
  startGold: 170,
  lives: 20,
  waves: [
    // 1. basics
    {
      groups: [
        { enemy: 'grunt', count: 10, interval: 1.1 },
      ],
      bonus: 23,
    },
    // 2. first Splitters
    {
      groups: [
        { enemy: 'splitter', count: 5, interval: 2, hpMult: 1.1 },
        { enemy: 'grunt', count: 5, interval: 1.2, delay: 3, hpMult: 1.1 },
      ],
      bonus: 26,
    },
    // 3. fast fragments
    {
      groups: [
        { enemy: 'runner', count: 12, interval: 0.7, hpMult: 1.1 },
        { enemy: 'splitter', count: 4, interval: 2, delay: 3, hpMult: 1.1 },
      ],
      bonus: 29,
    },
    // 4. drones over the canyon
    {
      groups: [
        { enemy: 'drone', count: 10, interval: 1.0, hpMult: 1.2 },
        { enemy: 'splitter', count: 6, interval: 1.6, delay: 2, hpMult: 1.2 },
      ],
      bonus: 32,
    },
    // 5. first Ghosts
    {
      groups: [
        { enemy: 'ghost', count: 6, interval: 1.5, hpMult: 1.3 },
        { enemy: 'grunt', count: 8, interval: 1.0, delay: 2, hpMult: 1.3 },
      ],
      bonus: 35,
    },
    // 6. ghost swarm
    {
      groups: [
        { enemy: 'swarm', count: 30, interval: 0.15, hpMult: 1.4 },
        { enemy: 'ghost', count: 4, interval: 2, delay: 3, hpMult: 1.4 },
      ],
      bonus: 38,
    },
    // 7. rockslide
    {
      groups: [
        { enemy: 'splitter', count: 10, interval: 1.2, hpMult: 1.4 },
        { enemy: 'brute', count: 2, interval: 4, delay: 4, hpMult: 1.4 },
      ],
      bonus: 41,
    },
    // 8. haunted skies
    {
      groups: [
        { enemy: 'ghost', count: 10, interval: 1.0, hpMult: 1.5 },
        { enemy: 'drone', count: 8, interval: 0.9, delay: 3, hpMult: 1.5 },
      ],
      bonus: 44,
    },
    // 9. wyvern pass
    {
      groups: [
        { enemy: 'wyvern', count: 4, interval: 2.5, hpMult: 1.6 },
        { enemy: 'splitter', count: 8, interval: 1.2, delay: 2, hpMult: 1.6 },
      ],
      bonus: 47, rewardMult: 0.6,
    },
    // 10. canyon convoy
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 2, hpMult: 1.7 },
        { enemy: 'ghost', count: 8, interval: 1, delay: 2, hpMult: 1.7 },
        { enemy: 'splitter', count: 6, interval: 1.4, delay: 5, hpMult: 1.7 },
      ],
      bonus: 50, rewardMult: 0.6,
    },
    // 11. phantom runners
    {
      groups: [
        { enemy: 'runner', count: 25, interval: 0.35, hpMult: 1.8 },
        { enemy: 'ghost', count: 6, interval: 1.2, delay: 4, hpMult: 1.8 },
      ],
      bonus: 53, rewardMult: 0.6,
    },
    // 12. molten splitters
    {
      groups: [
        { enemy: 'splitter', count: 8, interval: 1, hpMult: 1.9, element: 'fire' },
        { enemy: 'splitter', count: 8, interval: 1, delay: 6, hpMult: 1.9, element: 'water' },
      ],
      bonus: 56, rewardMult: 0.6,
    },
    // 13. ghost flight
    {
      groups: [
        { enemy: 'ghost', count: 15, interval: 0.8, hpMult: 2.1 },
        { enemy: 'wyvern', count: 4, interval: 2.5, delay: 4, hpMult: 2.1 },
      ],
      bonus: 59, rewardMult: 0.6,
    },
    // 14. shard storm
    {
      groups: [
        { enemy: 'drone', count: 25, interval: 0.4, hpMult: 2.2 },
        { enemy: 'splitter', count: 10, interval: 1, delay: 3, hpMult: 2.2 },
      ],
      bonus: 62, rewardMult: 0.6,
    },
    // 15. swarm of shadows
    {
      groups: [
        { enemy: 'swarm', count: 50, interval: 0.1, hpMult: 2.3 },
        { enemy: 'ghost', count: 10, interval: 1, delay: 4, hpMult: 2.3 },
      ],
      bonus: 65, rewardMult: 0.6,
    },
    // 16. boulders
    {
      groups: [
        { enemy: 'brute', count: 10, interval: 1.6, hpMult: 2.5 },
        { enemy: 'splitter', count: 12, interval: 0.9, delay: 3, hpMult: 2.5 },
      ],
      bonus: 68, rewardMult: 0.45,
    },
    // 17. high winds
    {
      groups: [
        { enemy: 'wyvern', count: 8, interval: 2, hpMult: 2.6 },
        { enemy: 'drone', count: 20, interval: 0.45, delay: 3, hpMult: 2.6 },
      ],
      bonus: 71, rewardMult: 0.45,
    },
    // 18. night run
    {
      groups: [
        { enemy: 'ghost', count: 20, interval: 0.6, hpMult: 2.8 },
        { enemy: 'runner', count: 20, interval: 0.35, delay: 3, hpMult: 2.8 },
      ],
      bonus: 74, rewardMult: 0.45,
    },
    // 19. landslide
    {
      groups: [
        { enemy: 'splitter', count: 20, interval: 0.7, hpMult: 3.0 },
        { enemy: 'brute', count: 6, interval: 2, delay: 3, hpMult: 3.0 },
        { enemy: 'ghost', count: 10, interval: 0.9, delay: 6, hpMult: 3.0 },
      ],
      bonus: 77, rewardMult: 0.45,
    },
    // 20. titan splitters
    {
      groups: [
        { enemy: 'splitter', count: 5, interval: 3, hpMult: 9.4 },
        { enemy: 'grunt', count: 25, interval: 0.5, delay: 1, hpMult: 3.1 },
        { enemy: 'ghost', count: 8, interval: 1, delay: 6, hpMult: 3.1 },
      ],
      bonus: 80, rewardMult: 0.45,
    },
    // 21. elemental echoes
    {
      groups: [
        { enemy: 'ghost', count: 8, interval: 0.8, hpMult: 3.3, element: 'fire' },
        { enemy: 'ghost', count: 8, interval: 0.8, delay: 4, hpMult: 3.3, element: 'earth' },
        { enemy: 'splitter', count: 8, interval: 1, delay: 2, hpMult: 3.3, element: 'metal' },
        { enemy: 'splitter', count: 8, interval: 1, delay: 6, hpMult: 3.3, element: 'wood' },
      ],
      bonus: 83, rewardMult: 0.45,
    },
    // 22. air supremacy
    {
      groups: [
        { enemy: 'drone', count: 35, interval: 0.3, hpMult: 3.5 },
        { enemy: 'wyvern', count: 8, interval: 1.8, delay: 4, hpMult: 3.5 },
      ],
      bonus: 86, rewardMult: 0.45,
    },
    // 23. ghost town
    {
      groups: [
        { enemy: 'ghost', count: 25, interval: 0.5, hpMult: 3.8 },
        { enemy: 'splitter', count: 20, interval: 0.7, delay: 3, hpMult: 3.8 },
      ],
      bonus: 89, rewardMult: 0.45,
    },
    // 24. siege
    {
      groups: [
        { enemy: 'brute', count: 14, interval: 1.4, hpMult: 4.0 },
        { enemy: 'ghost', count: 15, interval: 0.7, delay: 3, hpMult: 4.0 },
        { enemy: 'wyvern', count: 4, interval: 2.5, delay: 8, hpMult: 4.0 },
      ],
      bonus: 92, rewardMult: 0.45,
    },
    // 25. canyon finale
    {
      groups: [
        { enemy: 'splitter', count: 20, interval: 0.6, hpMult: 5.1 },
        { enemy: 'ghost', count: 20, interval: 0.6, delay: 2, hpMult: 4.2 },
        { enemy: 'brute', count: 8, interval: 1.6, delay: 4, hpMult: 4.2 },
        { enemy: 'drone', count: 25, interval: 0.35, delay: 6, hpMult: 4.2 },
        { enemy: 'wyvern', count: 6, interval: 2, delay: 10, hpMult: 4.2 },
        { enemy: 'splitter', count: 4, interval: 3, delay: 16, hpMult: 10.6, element: 'fire' },
      ],
      bonus: 0, rewardMult: 0.45,
    },
  ],
};
