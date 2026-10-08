import { OVERCOMES, type ElementId } from './elements';

/**
 * Battlefields: each wave is fought on one. Its element gets +BONUS damage; the element it
 * overcomes in the Five Elements cycle gets −BONUS. This applies to towers (damage dealt) and
 * to enemies (a boosted enemy takes BONUS less damage, a weakened one BONUS more).
 */
export type BattlefieldId = 'mars' | 'ocean' | 'jungle' | 'canyon' | 'factory';

export interface BattlefieldDef {
  id: BattlefieldId;
  name: string;
  element: ElementId;
  /** Map palette: the neon city recolored for this battlefield. */
  palette: {
    ground: string;
    pad: string;
    padEdge: string;
    grid: string;
    road: string;
    roadEdge: string;
    roadCenter: string;
    /** Decorations on the pads (craters, waves, leaves, rocks, gears). */
    decor: string;
  };
}

/** Damage shift for the battlefield's element (+) and the element it overcomes (−). */
export const BATTLEFIELD_BONUS = 0.05;

export const BATTLEFIELDS: Record<BattlefieldId, BattlefieldDef> = {
  mars: {
    id: 'mars', name: 'Mars', element: 'fire',
    palette: {
      ground: '#0d0607', pad: '#1c0d0d', padEdge: 'rgba(255,90,54,0.14)', grid: 'rgba(255,90,54,0.05)',
      road: '#1a0f10', roadEdge: '#ff5a36', roadCenter: 'rgba(255,196,107,0.7)', decor: 'rgba(255,90,54,0.22)',
    },
  },
  ocean: {
    id: 'ocean', name: 'Ocean', element: 'water',
    palette: {
      ground: '#03080f', pad: '#08162a', padEdge: 'rgba(0,229,255,0.14)', grid: 'rgba(0,229,255,0.05)',
      road: '#0a1626', roadEdge: '#00e5ff', roadCenter: 'rgba(200,251,255,0.6)', decor: 'rgba(0,229,255,0.2)',
    },
  },
  jungle: {
    id: 'jungle', name: 'Jungle', element: 'wood',
    palette: {
      ground: '#030a06', pad: '#0a1a10', padEdge: 'rgba(57,255,136,0.13)', grid: 'rgba(57,255,136,0.05)',
      road: '#0d1a12', roadEdge: '#39ff88', roadCenter: 'rgba(255,230,0,0.6)', decor: 'rgba(57,255,136,0.22)',
    },
  },
  canyon: {
    id: 'canyon', name: 'Canyon', element: 'earth',
    palette: {
      ground: '#0c0803', pad: '#1c140a', padEdge: 'rgba(255,176,32,0.14)', grid: 'rgba(255,176,32,0.05)',
      road: '#1a130b', roadEdge: '#ffb020', roadCenter: 'rgba(255,43,214,0.6)', decor: 'rgba(255,176,32,0.22)',
    },
  },
  factory: {
    id: 'factory', name: 'Factory', element: 'metal',
    palette: {
      ground: '#07080f', pad: '#11142a', padEdge: 'rgba(201,209,255,0.14)', grid: 'rgba(201,209,255,0.05)',
      road: '#141726', roadEdge: '#c9d1ff', roadCenter: 'rgba(255,43,214,0.65)', decor: 'rgba(201,209,255,0.18)',
    },
  },
};

export const BATTLEFIELD_IDS = Object.keys(BATTLEFIELDS) as BattlefieldId[];

/** The element a battlefield weakens: the one its element overcomes. */
export function weakenedElement(field: BattlefieldDef): ElementId {
  return OVERCOMES[field.element];
}
