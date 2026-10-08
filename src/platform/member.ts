/**
 * MemberId: who this player is, created automatically the first time the game runs and kept on
 * the device (localStorage `td-member`; in the iOS app also mirrored by nativeStorage). It will
 * identify players in multiplayer rooms. It's random, not derived from anything about the
 * person or device, and it never leaves the device until online play uses it.
 *
 * Format: `NW-XXXX-XXXX-XXXX`, 12 characters from an alphabet without look-alikes (no 0/O, 1/I/L),
 * so it's easy to read out or type: 31^12 ≈ 7.9 × 10^17 possible ids.
 */
const KEY = 'td-member';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PATTERN = /^NW-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

let cached: string | null = null;

/** A new random MemberId. */
export function newMemberId(random: (n: number) => Uint32Array = randomValues): string {
  const chars = [...random(12)].map((v) => ALPHABET[v % ALPHABET.length]).join('');
  return `NW-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function isMemberId(id: string): boolean {
  return PATTERN.test(id);
}

/** This player's MemberId, created and saved on first use. */
export function memberId(): string {
  if (cached) return cached;
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: a fresh id for this visit only.
  }
  if (!id || !isMemberId(id)) {
    id = newMemberId();
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Not saved; the next visit gets a new one.
    }
  }
  cached = id;
  return id;
}

function randomValues(n: number): Uint32Array {
  // Rejection-free is fine here: 2^32 isn't a multiple of 31, but the bias (~10^-9) doesn't matter for an id.
  return crypto.getRandomValues(new Uint32Array(n));
}
