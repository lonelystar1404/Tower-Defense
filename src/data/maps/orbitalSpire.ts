import type { LevelDef } from '../levels';

// Generated with a per-map HP growth curve (×1.049 per wave) and then checked with the balance bot
// in tests/game.test.ts. Edit freely; re-run `npm test` after changing numbers.

/** Map 4: a long spiral into the center, 40 waves. Introduces Phasers and Carriers. */
export const ORBITAL_SPIRE: LevelDef = {
  id: 'orbital-spire',
  name: 'Orbital Spire',
  description: 'A 40-wave spiral into the core. New: Phasers and Carriers.',
  cols: 20,
  rows: 12,
  path: [[-1, 10], [18, 10], [18, 1], [1, 1], [1, 7], [15, 7], [15, 4], [5, 4]],
  startGold: 180,
  lives: 25,
  /** All enemy HP on this map (see LevelDef.hpScale), tuned with the balance bot under 70% lockdown. */
  hpScale: 1.4,
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
        { enemy: 'grunt', count: 8, interval: 1.0 },
        { enemy: 'runner', count: 8, interval: 0.8, delay: 4 },
      ],
      bonus: 26,
    },
    // 3. first Phasers
    {
      groups: [
        { enemy: 'phaser', count: 5, interval: 1.8, hpMult: 1.1 },
        { enemy: 'grunt', count: 6, interval: 1.0, delay: 3, hpMult: 1.1 },
      ],
      bonus: 29,
    },
    // 4. drones
    {
      groups: [
        { enemy: 'drone', count: 10, interval: 1.0, hpMult: 1.2 },
        { enemy: 'phaser', count: 4, interval: 1.8, delay: 3, hpMult: 1.2 },
      ],
      bonus: 32,
    },
    // 5. swarm
    {
      groups: [
        { enemy: 'swarm', count: 30, interval: 0.15, hpMult: 1.2 },
        { enemy: 'phaser', count: 4, interval: 2, delay: 2, hpMult: 1.2 },
      ],
      bonus: 35,
    },
    // 6. armor
    {
      groups: [
        { enemy: 'brute', count: 3, interval: 3, hpMult: 1.3 },
        { enemy: 'phaser', count: 6, interval: 1.5, delay: 2, hpMult: 1.3 },
      ],
      bonus: 38,
    },
    // 7. first Carrier
    {
      groups: [
        { enemy: 'carrier', count: 1, interval: 1, hpMult: 1.3 },
        { enemy: 'grunt', count: 10, interval: 0.9, delay: 2, hpMult: 1.3 },
      ],
      bonus: 41,
    },
    // 8. phase shift
    {
      groups: [
        { enemy: 'phaser', count: 12, interval: 1.0, hpMult: 1.4 },
        { enemy: 'runner', count: 10, interval: 0.6, delay: 3, hpMult: 1.4 },
      ],
      bonus: 44,
    },
    // 9. carrier escort
    {
      groups: [
        { enemy: 'carrier', count: 2, interval: 5, hpMult: 1.5 },
        { enemy: 'drone', count: 10, interval: 0.8, delay: 2, hpMult: 1.5 },
      ],
      bonus: 47, rewardMult: 0.6,
    },
    // 10. milestone
    {
      groups: [
        { enemy: 'brute', count: 5, interval: 2.5, hpMult: 1.5 },
        { enemy: 'phaser', count: 8, interval: 1.2, delay: 2, hpMult: 1.5 },
        { enemy: 'carrier', count: 2, interval: 6, delay: 4, hpMult: 1.5 },
      ],
      bonus: 50, rewardMult: 0.6,
    },
    // 11. phaser rush
    {
      groups: [
        { enemy: 'phaser', count: 10, interval: 0.7, hpMult: 1.6 },
        { enemy: 'runner', count: 10, interval: 0.4, delay: 3, hpMult: 1.6 },
      ],
      bonus: 53, rewardMult: 0.6,
    },
    // 12. carrier fleet
    {
      groups: [
        { enemy: 'carrier', count: 2, interval: 4, hpMult: 1.7 },
        { enemy: 'drone', count: 12, interval: 0.5, delay: 2, hpMult: 1.7 },
      ],
      bonus: 56, rewardMult: 0.6,
    },
    // 13. armored column
    {
      groups: [
        { enemy: 'brute', count: 6, interval: 2, hpMult: 1.8 },
        { enemy: 'phaser', count: 8, interval: 1, delay: 3, hpMult: 1.8 },
        { enemy: 'grunt', count: 14, interval: 0.5, delay: 1, hpMult: 1.8 },
      ],
      bonus: 59, rewardMult: 0.6,
    },
    // 14. swarm cloud
    {
      groups: [
        { enemy: 'swarm', count: 42, interval: 0.1, hpMult: 1.9 },
        { enemy: 'phaser', count: 9, interval: 1, delay: 4, hpMult: 1.9 },
        { enemy: 'wyvern', count: 3, interval: 2.5, delay: 6, hpMult: 1.9 },
      ],
      bonus: 62, rewardMult: 0.6,
    },
    // 15. elemental shift
    {
      groups: [
        { enemy: 'phaser', count: 9, interval: 0.8, hpMult: 2.0, element: 'water' },
        { enemy: 'phaser', count: 9, interval: 0.8, delay: 4, hpMult: 2.0, element: 'earth' },
        { enemy: 'grunt', count: 12, interval: 0.6, delay: 2, hpMult: 2.0, element: 'metal' },
        { enemy: 'carrier', count: 2, interval: 5, delay: 6, hpMult: 2.0, element: 'fire' },
      ],
      bonus: 65, rewardMult: 0.6,
    },
    // 16. sky siege
    {
      groups: [
        { enemy: 'wyvern', count: 6, interval: 2, hpMult: 2.0 },
        { enemy: 'carrier', count: 2, interval: 5, delay: 3, hpMult: 2.0 },
        { enemy: 'drone', count: 25, interval: 0.4, delay: 5, hpMult: 2.0 },
      ],
      bonus: 68, rewardMult: 0.45,
    },
    // 17. phaser rush
    {
      groups: [
        { enemy: 'phaser', count: 22, interval: 0.7, hpMult: 2.1 },
        { enemy: 'runner', count: 22, interval: 0.4, delay: 3, hpMult: 2.1 },
      ],
      bonus: 71, rewardMult: 0.45,
    },
    // 18. carrier fleet
    {
      groups: [
        { enemy: 'carrier', count: 4, interval: 4, hpMult: 2.3 },
        { enemy: 'drone', count: 24, interval: 0.5, delay: 2, hpMult: 2.3 },
      ],
      bonus: 74, rewardMult: 0.45,
    },
    // 19. armored column
    {
      groups: [
        { enemy: 'brute', count: 12, interval: 2, hpMult: 2.4 },
        { enemy: 'phaser', count: 14, interval: 1, delay: 3, hpMult: 2.4 },
        { enemy: 'grunt', count: 26, interval: 0.5, delay: 1, hpMult: 2.4 },
      ],
      bonus: 77, rewardMult: 0.45,
    },
    // 20. swarm cloud
    {
      groups: [
        { enemy: 'swarm', count: 66, interval: 0.1, hpMult: 2.5 },
        { enemy: 'phaser', count: 15, interval: 1, delay: 4, hpMult: 2.5 },
        { enemy: 'wyvern', count: 6, interval: 2.5, delay: 6, hpMult: 2.5 },
      ],
      bonus: 80, rewardMult: 0.45,
    },
    // 21. elemental shift
    {
      groups: [
        { enemy: 'phaser', count: 15, interval: 0.8, hpMult: 2.6, element: 'water' },
        { enemy: 'phaser', count: 15, interval: 0.8, delay: 4, hpMult: 2.6, element: 'earth' },
        { enemy: 'grunt', count: 18, interval: 0.6, delay: 2, hpMult: 2.6, element: 'metal' },
        { enemy: 'carrier', count: 3, interval: 5, delay: 6, hpMult: 2.6, element: 'fire' },
      ],
      bonus: 83, rewardMult: 0.45,
    },
    // 22. sky siege
    {
      groups: [
        { enemy: 'wyvern', count: 9, interval: 2, hpMult: 2.7 },
        { enemy: 'carrier', count: 4, interval: 5, delay: 3, hpMult: 2.7 },
        { enemy: 'drone', count: 37, interval: 0.4, delay: 5, hpMult: 2.7 },
      ],
      bonus: 86, rewardMult: 0.45,
    },
    // 23. phaser rush
    {
      groups: [
        { enemy: 'phaser', count: 34, interval: 0.7, hpMult: 2.9 },
        { enemy: 'runner', count: 34, interval: 0.4, delay: 3, hpMult: 2.9 },
      ],
      bonus: 89, rewardMult: 0.45,
    },
    // 24. carrier fleet
    {
      groups: [
        { enemy: 'carrier', count: 6, interval: 4, hpMult: 3.0 },
        { enemy: 'drone', count: 36, interval: 0.5, delay: 2, hpMult: 3.0 },
      ],
      bonus: 92, rewardMult: 0.45,
    },
    // 25. armored column
    {
      groups: [
        { enemy: 'brute', count: 18, interval: 2, hpMult: 3.2 },
        { enemy: 'phaser', count: 20, interval: 1, delay: 3, hpMult: 3.2 },
        { enemy: 'grunt', count: 38, interval: 0.5, delay: 1, hpMult: 3.2 },
      ],
      bonus: 95, rewardMult: 0.45,
    },
    // 26. swarm cloud
    {
      groups: [
        { enemy: 'swarm', count: 90, interval: 0.1, hpMult: 3.3 },
        { enemy: 'phaser', count: 21, interval: 1, delay: 4, hpMult: 3.3 },
        { enemy: 'wyvern', count: 9, interval: 2.5, delay: 6, hpMult: 3.3 },
      ],
      bonus: 98, rewardMult: 0.35,
    },
    // 27. elemental shift
    {
      groups: [
        { enemy: 'phaser', count: 21, interval: 0.8, hpMult: 3.5, element: 'water' },
        { enemy: 'phaser', count: 21, interval: 0.8, delay: 4, hpMult: 3.5, element: 'earth' },
        { enemy: 'grunt', count: 24, interval: 0.6, delay: 2, hpMult: 3.5, element: 'metal' },
        { enemy: 'carrier', count: 5, interval: 5, delay: 6, hpMult: 3.5, element: 'fire' },
      ],
      bonus: 101, rewardMult: 0.35,
    },
    // 28. sky siege
    {
      groups: [
        { enemy: 'wyvern', count: 12, interval: 2, hpMult: 3.6 },
        { enemy: 'carrier', count: 6, interval: 5, delay: 3, hpMult: 3.6 },
        { enemy: 'drone', count: 49, interval: 0.4, delay: 5, hpMult: 3.6 },
      ],
      bonus: 104, rewardMult: 0.35,
    },
    // 29. phaser rush
    {
      groups: [
        { enemy: 'phaser', count: 46, interval: 0.7, hpMult: 3.8 },
        { enemy: 'runner', count: 46, interval: 0.4, delay: 3, hpMult: 3.8 },
      ],
      bonus: 107, rewardMult: 0.35,
    },
    // 30. carrier fleet
    {
      groups: [
        { enemy: 'carrier', count: 8, interval: 4, hpMult: 4.0 },
        { enemy: 'drone', count: 48, interval: 0.5, delay: 2, hpMult: 4.0 },
      ],
      bonus: 110, rewardMult: 0.35,
    },
    // 31. armored column
    {
      groups: [
        { enemy: 'brute', count: 24, interval: 2, hpMult: 4.2 },
        { enemy: 'phaser', count: 26, interval: 1, delay: 3, hpMult: 4.2 },
        { enemy: 'grunt', count: 50, interval: 0.5, delay: 1, hpMult: 4.2 },
      ],
      bonus: 113, rewardMult: 0.35,
    },
    // 32. swarm cloud
    {
      groups: [
        { enemy: 'swarm', count: 114, interval: 0.1, hpMult: 4.4 },
        { enemy: 'phaser', count: 27, interval: 1, delay: 4, hpMult: 4.4 },
        { enemy: 'wyvern', count: 12, interval: 2.5, delay: 6, hpMult: 4.4 },
      ],
      bonus: 116, rewardMult: 0.35,
    },
    // 33. elemental shift
    {
      groups: [
        { enemy: 'phaser', count: 27, interval: 0.8, hpMult: 4.6, element: 'water' },
        { enemy: 'phaser', count: 27, interval: 0.8, delay: 4, hpMult: 4.6, element: 'earth' },
        { enemy: 'grunt', count: 30, interval: 0.6, delay: 2, hpMult: 4.6, element: 'metal' },
        { enemy: 'carrier', count: 6, interval: 5, delay: 6, hpMult: 4.6, element: 'fire' },
      ],
      bonus: 119, rewardMult: 0.3,
    },
    // 34. sky siege
    {
      groups: [
        { enemy: 'wyvern', count: 15, interval: 2, hpMult: 4.8 },
        { enemy: 'carrier', count: 8, interval: 5, delay: 3, hpMult: 4.8 },
        { enemy: 'drone', count: 61, interval: 0.4, delay: 5, hpMult: 4.8 },
      ],
      bonus: 122, rewardMult: 0.3,
    },
    // 35. phaser rush
    {
      groups: [
        { enemy: 'phaser', count: 58, interval: 0.7, hpMult: 5.1 },
        { enemy: 'runner', count: 58, interval: 0.4, delay: 3, hpMult: 5.1 },
      ],
      bonus: 125, rewardMult: 0.3,
    },
    // 36. carrier fleet
    {
      groups: [
        { enemy: 'carrier', count: 10, interval: 4, hpMult: 5.3 },
        { enemy: 'drone', count: 60, interval: 0.5, delay: 2, hpMult: 5.3 },
      ],
      bonus: 128, rewardMult: 0.3,
    },
    // 37. armored column
    {
      groups: [
        { enemy: 'brute', count: 30, interval: 2, hpMult: 5.6 },
        { enemy: 'phaser', count: 32, interval: 1, delay: 3, hpMult: 5.6 },
        { enemy: 'grunt', count: 62, interval: 0.5, delay: 1, hpMult: 5.6 },
      ],
      bonus: 131, rewardMult: 0.3,
    },
    // 38. swarm cloud
    {
      groups: [
        { enemy: 'swarm', count: 138, interval: 0.1, hpMult: 5.9 },
        { enemy: 'phaser', count: 33, interval: 1, delay: 4, hpMult: 5.9 },
        { enemy: 'wyvern', count: 15, interval: 2.5, delay: 6, hpMult: 5.9 },
      ],
      bonus: 134, rewardMult: 0.3,
    },
    // 39. elemental shift
    {
      groups: [
        { enemy: 'phaser', count: 33, interval: 0.8, hpMult: 6.2, element: 'water' },
        { enemy: 'phaser', count: 33, interval: 0.8, delay: 4, hpMult: 6.2, element: 'earth' },
        { enemy: 'grunt', count: 36, interval: 0.6, delay: 2, hpMult: 6.2, element: 'metal' },
        { enemy: 'carrier', count: 8, interval: 5, delay: 6, hpMult: 6.2, element: 'fire' },
      ],
      bonus: 137, rewardMult: 0.3,
    },
    // 40. spire finale
    {
      groups: [
        { enemy: 'phaser', count: 25, interval: 0.4, hpMult: 7.8 },
        { enemy: 'carrier', count: 5, interval: 3, delay: 2, hpMult: 6.5 },
        { enemy: 'brute', count: 12, interval: 1.4, delay: 4, hpMult: 6.5 },
        { enemy: 'swarm', count: 50, interval: 0.08, delay: 6, hpMult: 6.5 },
        { enemy: 'wyvern', count: 8, interval: 1.8, delay: 10, hpMult: 6.5 },
        { enemy: 'drone', count: 30, interval: 0.3, delay: 12, hpMult: 6.5 },
        { enemy: 'leviathan', count: 1, interval: 1, delay: 20, hpMult: 7, element: 'fire' },
      ],
      bonus: 0, rewardMult: 0.3,
    },
  ],
};
