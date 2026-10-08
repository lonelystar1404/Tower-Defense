import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * In the iOS app, localStorage lives in the web view's data, which iOS may clear when the
 * device runs low on space. The game keeps using localStorage as it does on the web; this
 * mirrors those keys into the app's own preferences (UserDefaults), which iOS keeps, and copies
 * them back on launch if the web view lost them. Does nothing in a browser.
 */
const KEYS = ['td-progress', 'td-saves', 'td-daily', 'td-best', 'td-hero', 'td-muted', 'td-lang'] as const;

const native = Capacitor.isNativePlatform();

/** On launch, before anything reads localStorage: refill keys the web view lost. */
export async function restoreNativeStorage(): Promise<void> {
  if (!native) return;
  try {
    for (const key of KEYS) {
      if (localStorage.getItem(key) !== null) continue;
      const { value } = await Preferences.get({ key });
      if (value !== null) localStorage.setItem(key, value);
    }
  } catch {
    // Storage unavailable: the game still runs, it just starts fresh.
  }
}

/** Copies the current localStorage keys to the app's preferences (fire and forget). */
export function backupNativeStorage(): void {
  if (!native) return;
  for (const key of KEYS) {
    const value = localStorage.getItem(key);
    void (value === null ? Preferences.remove({ key }) : Preferences.set({ key, value })).catch(() => {});
  }
}
