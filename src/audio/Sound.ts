import type { GameSound } from '../game/Game';

/** Sounds the page adds on top of game events. */
export type UiSound = 'denied' | 'click';
export type SoundId = GameSound | UiSound;

/** Master volume (0..1) before the compressor. */
const MASTER_VOLUME = 0.35;
/** A sound won't replay sooner than this many seconds after itself (keeps busy waves listenable). */
const DEFAULT_GAP = 0.03;
const MIN_GAP: Partial<Record<SoundId, number>> = {
  'shot-cannon': 0.06, 'shot-flak': 0.05, 'shot-multi': 0.07, 'shot-mortar': 0.08,
  'shot-chain': 0.07, 'shot-sniper': 0.08, blast: 0.06, kill: 0.04, crit: 0.08, stun: 0.12,
  freeze: 0.12, leak: 0.2, combo: 0.12, 'hero-shot': 0.08, 'hero-punch': 0.08, 'hero-zap': 0.08, heal: 0.3, blink: 0.12, launch: 0.3, split: 0.08, 'shield-break': 0.1, disrupt: 0.25, shift: 0.3, burrow: 0.2,
};
/** Skip new sounds while this many are still playing. */
const MAX_VOICES = 24;
const MUTE_KEY = 'td-muted';

type Wave = OscillatorType;

/**
 * Synthesized sound effects (Web Audio, no files). The AudioContext is only created after a
 * user gesture (`unlock`), as browsers require. The mute choice is remembered in localStorage
 * when available.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<SoundId, number>();
  private voices = 0;
  muted: boolean;

  constructor() {
    this.muted = readMuted();
  }

  /** Call from a user gesture (click / key) so the browser lets audio start. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 6;
      compressor.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(compressor);
      this.noiseBuffer = makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Storage can be blocked (private mode); the setting just won't persist.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
  }

  play(id: SoundId): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -1) < (MIN_GAP[id] ?? DEFAULT_GAP)) return;
    if (this.voices >= MAX_VOICES) return;
    const recipe = id.startsWith('ability:') || id.startsWith('impact:') ? HERO_SOUNDS[id] : RECIPES[id as keyof typeof RECIPES];
    if (!recipe) return;
    this.lastPlayed.set(id, now);
    recipe(this, now);
  }

  // --- building blocks used by the recipes ---

  /** An oscillator sweeping from `f0` to `f1` Hz over `dur` seconds with a quick fade in/out. */
  tone(t: number, wave: Wave, f0: number, f1: number, dur: number, gain: number, filter?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    const detune = 1 + (Math.random() - 0.5) * 0.04;
    osc.frequency.setValueAtTime(f0 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * detune), t + dur);
    let node: AudioNode = osc;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filter;
      osc.connect(lp);
      node = lp;
    }
    this.out(node, t, dur, gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    this.track(osc);
  }

  /** Filtered white noise with its filter cutoff sweeping from `f0` to `f1`. */
  noise(t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    src.connect(filter);
    this.out(filter, t, dur, gain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    this.track(src);
  }

  /** A run of short notes, e.g. an arpeggio. */
  notes(t: number, wave: Wave, freqs: number[], step: number, dur: number, gain: number): void {
    freqs.forEach((f, i) => this.tone(t + i * step, wave, f, f, dur, gain));
  }

  private out(node: AudioNode, t: number, dur: number, gain: number): void {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(this.master!);
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => this.voices--;
  }
}

/** How each sound is made. Pitches in Hz, times in seconds. */
type Recipe = (s: Sound, t: number) => void;

/** Fixed sounds; each hero ability has its own in HERO_SOUNDS below. */
const RECIPES: Record<Exclude<SoundId, `ability:${string}` | `impact:${string}`>, Recipe> = {
  // Weapons
  'shot-cannon': (s, t) => {
    s.tone(t, 'sine', 140, 45, 0.18, 0.5);
    s.noise(t, 0.14, 'lowpass', 900, 200, 0.35);
  },
  'shot-flak': (s, t) => s.tone(t, 'square', 950, 550, 0.05, 0.08, 3000),
  'shot-multi': (s, t) => s.notes(t, 'triangle', [700, 780, 860], 0.025, 0.04, 0.07),
  'shot-mortar': (s, t) => {
    s.tone(t, 'sine', 220, 70, 0.22, 0.35);
    s.noise(t, 0.1, 'lowpass', 500, 150, 0.2);
  },
  'shot-chain': (s, t) => {
    s.noise(t, 0.13, 'bandpass', 3000, 1200, 0.3, 5);
    s.tone(t, 'sawtooth', 1400, 300, 0.1, 0.06, 4000);
  },
  'shot-sniper': (s, t) => {
    s.tone(t, 'sawtooth', 2200, 180, 0.2, 0.12, 6000);
    s.noise(t, 0.05, 'highpass', 4000, 2000, 0.12);
  },
  // Hits
  blast: (s, t) => {
    s.noise(t, 0.35, 'lowpass', 1200, 120, 0.5);
    s.tone(t, 'sine', 90, 35, 0.3, 0.4);
  },
  kill: (s, t) => s.tone(t, 'square', 520, 1100, 0.07, 0.06, 4000),
  crit: (s, t) => s.tone(t, 'triangle', 1500, 2400, 0.08, 0.07),
  freeze: (s, t) => {
    s.tone(t, 'sine', 2000, 3200, 0.22, 0.06);
    s.noise(t, 0.2, 'highpass', 6000, 3000, 0.08);
  },
  stun: (s, t) => s.tone(t, 'sine', 110, 50, 0.16, 0.35),
  leak: (s, t) => {
    s.tone(t, 'sawtooth', 180, 110, 0.35, 0.18, 900);
    s.tone(t + 0.12, 'sawtooth', 160, 90, 0.3, 0.14, 900);
  },
  // Economy
  build: (s, t) => s.notes(t, 'triangle', [440, 660], 0.07, 0.12, 0.14),
  upgrade: (s, t) => s.notes(t, 'triangle', [523, 659, 784, 1047], 0.06, 0.14, 0.13),
  sell: (s, t) => s.tone(t, 'triangle', 660, 300, 0.16, 0.13),
  // Waves
  'wave-start': (s, t) => {
    s.tone(t, 'sawtooth', 220, 440, 0.35, 0.1, 2000);
    s.tone(t + 0.35, 'sawtooth', 220, 440, 0.35, 0.1, 2000);
  },
  'wave-clear': (s, t) => s.notes(t, 'sine', [523, 659, 784], 0.05, 0.5, 0.1),
  win: (s, t) => s.notes(t, 'triangle', [523, 659, 784, 1047, 1319], 0.11, 0.35, 0.13),
  lose: (s, t) => {
    s.tone(t, 'sawtooth', 440, 110, 0.9, 0.15, 1500);
    s.tone(t + 0.1, 'sawtooth', 330, 80, 0.9, 0.12, 1200);
  },
  tick: (s, t) => s.tone(t, 'square', 1000, 1000, 0.035, 0.05, 5000),
  'tick-final': (s, t) => s.tone(t, 'square', 1500, 1500, 0.08, 0.07, 5000),
  // Enemy abilities
  'shield-break': (s, t) => {
    s.noise(t, 0.18, 'highpass', 5000, 1500, 0.18);
    s.tone(t, 'square', 900, 200, 0.15, 0.06, 3000);
  },
  heal: (s, t) => s.notes(t, 'sine', [660, 880], 0.06, 0.18, 0.06),
  blink: (s, t) => s.tone(t, 'sine', 300, 2400, 0.12, 0.07),
  split: (s, t) => {
    s.noise(t, 0.12, 'bandpass', 1800, 600, 0.2, 3);
    s.tone(t, 'triangle', 500, 250, 0.1, 0.06);
  },
  launch: (s, t) => s.tone(t, 'sawtooth', 200, 600, 0.2, 0.06, 1500),
  disrupt: (s, t) => {
    s.tone(t, 'square', 1200, 90, 0.25, 0.06, 2200);
    s.noise(t, 0.2, 'bandpass', 3000, 800, 0.08, 4);
  },
  shift: (s, t) => s.notes(t, 'triangle', [523, 784, 1047], 0.04, 0.08, 0.04),
  burrow: (s, t) => s.noise(t, 0.25, 'lowpass', 900, 120, 0.12),
  // Hero
  'hero-shot': (s, t) => s.tone(t, 'sawtooth', 1600, 700, 0.07, 0.05, 5000),
  'level-up': (s, t) => s.notes(t, 'square', [523, 784, 1047, 1568], 0.07, 0.16, 0.08),
  'hero-punch': (s, t) => {
    s.tone(t, 'sine', 160, 60, 0.12, 0.35);
    s.noise(t, 0.08, 'lowpass', 1200, 300, 0.25);
  },
  'hero-zap': (s, t) => s.noise(t, 0.09, 'bandpass', 4000, 1500, 0.18, 6),
  // Arjun's Combustion: a small pop where an enemy he killed explodes
  combustion: (s, t) => {
    s.noise(t, 0.12, 'lowpass', 1600, 300, 0.18);
    s.tone(t, 'sine', 180, 70, 0.1, 0.12);
  },
  combo: (s, t) => {
    s.notes(t, 'triangle', [880, 1320, 1760], 0.035, 0.12, 0.07);
    s.noise(t, 0.15, 'highpass', 4000, 2000, 0.06);
  },
  // Bosses
  boss: (s, t) => {
    // Low alarm horn, three pulses
    for (let i = 0; i < 3; i++) s.tone(t + i * 0.32, 'sawtooth', 110, 82, 0.28, 0.16, 700);
    s.noise(t, 1, 'lowpass', 400, 60, 0.25);
  },
  'boss-phase': (s, t) => {
    s.tone(t, 'sawtooth', 70, 140, 0.5, 0.2, 900);
    s.noise(t, 0.45, 'bandpass', 300, 1800, 0.25, 2);
  },
  // UI
  denied: (s, t) => {
    s.tone(t, 'square', 150, 140, 0.08, 0.1, 1500);
    s.tone(t + 0.1, 'square', 150, 130, 0.08, 0.1, 1500);
  },
  click: (s, t) => s.tone(t, 'triangle', 1200, 900, 0.03, 0.05),
};

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * One sound per hero ability, keyed `ability:<ability id>` (cast) and `impact:<ability id>`
 * (when a delayed strike lands). Each one is meant to sound like what the ability does.
 */
export const HERO_SOUNDS: Record<string, Recipe> = {
  // Vex: drone-tech, water
  'ability:vex-pulse': (s, t) => {
    s.tone(t, 'sine', 300, 1100, 0.1, 0.12); // charge
    s.noise(t + 0.1, 0.3, 'lowpass', 2600, 250, 0.4);
    s.tone(t + 0.1, 'sine', 240, 55, 0.3, 0.35);
  },
  'ability:vex-emp': (s, t) => {
    s.tone(t, 'sawtooth', 90, 38, 0.6, 0.2, 700); // power drop
    s.noise(t, 0.45, 'bandpass', 500, 3500, 0.25, 2);
    s.notes(t + 0.05, 'square', [1800, 900, 1500, 600], 0.05, 0.04, 0.05); // crackle
  },
  'ability:vex-cryo': (s, t) => {
    s.noise(t, 0.6, 'highpass', 6000, 2500, 0.12); // frost hiss
    s.notes(t, 'triangle', [2093, 2637, 3136, 4186], 0.06, 0.25, 0.05); // crystals forming
  },
  'ability:vex-orbital': (s, t) => {
    s.notes(t, 'square', [1568, 1568, 2093], 0.12, 0.06, 0.06); // lock-on beeps
    s.tone(t + 0.2, 'sine', 300, 1600, 0.8, 0.07); // beam charging
  },
  'impact:vex-orbital': (s, t) => {
    s.tone(t, 'sawtooth', 1400, 180, 0.25, 0.1, 5000); // beam
    s.noise(t, 0.9, 'lowpass', 3200, 70, 0.6);
    s.tone(t, 'sine', 75, 25, 0.8, 0.5);
  },

  // Brick: hydraulic fists, earth
  'ability:mateo-slam': (s, t) => {
    s.tone(t, 'sine', 130, 32, 0.4, 0.6);
    s.noise(t, 0.35, 'lowpass', 900, 90, 0.45);
    s.noise(t, 0.06, 'highpass', 3000, 1500, 0.15); // crack
  },
  'ability:mateo-leap': (s, t) => {
    s.tone(t, 'sawtooth', 180, 900, 0.22, 0.09, 2400); // rockets
    s.noise(t, 0.22, 'bandpass', 500, 3500, 0.2, 2);
    s.tone(t + 0.22, 'sine', 120, 32, 0.35, 0.55); // landing
    s.noise(t + 0.22, 0.3, 'lowpass', 1500, 120, 0.45);
  },
  'ability:mateo-overdrive': (s, t) => {
    s.tone(t, 'sawtooth', 70, 240, 0.55, 0.15, 1100); // engine rev
    s.tone(t + 0.1, 'square', 110, 330, 0.45, 0.05, 900);
    s.notes(t + 0.4, 'square', [220, 330], 0.05, 0.1, 0.06);
  },
  'ability:mateo-quake': (s, t) => {
    s.noise(t, 1.3, 'lowpass', 500, 35, 0.65); // long rumble
    s.tone(t, 'sine', 60, 28, 1.1, 0.55);
    s.noise(t + 0.15, 0.1, 'highpass', 2500, 1200, 0.2); // street splitting
    s.noise(t + 0.35, 0.1, 'highpass', 2200, 1000, 0.18);
  },

  // Leila: precision rifle, metal
  'ability:leila-pierce': (s, t) => {
    s.noise(t, 0.08, 'highpass', 7000, 2500, 0.2);
    s.tone(t, 'sawtooth', 3200, 260, 0.28, 0.12, 8000); // rail crack
    s.tone(t + 0.05, 'sine', 900, 600, 0.35, 0.04); // ringing barrel
  },
  'ability:leila-mark': (s, t) => {
    s.notes(t, 'square', [1760, 2349, 2349], 0.07, 0.05, 0.05); // targeting beeps
    s.tone(t + 0.21, 'sine', 2349, 2349, 0.3, 0.03);
  },
  'ability:leila-rapid': (s, t) => {
    s.notes(t, 'triangle', [880, 988, 1109, 1245, 1397, 1568], 0.035, 0.05, 0.06); // spin-up
    s.noise(t + 0.2, 0.08, 'highpass', 5000, 3000, 0.1);
  },
  'ability:leila-headhunter': (s, t) => {
    for (let i = 0; i < 6; i++) {
      s.tone(t + i * 0.08, 'sawtooth', 2800, 380, 0.09, 0.09, 7000);
      s.noise(t + i * 0.08, 0.05, 'highpass', 6000, 3000, 0.12);
    }
  },

  // Arjun: hologram physicist, fire
  'ability:arjun-firewall': (s, t) => {
    s.noise(t, 0.8, 'bandpass', 300, 1500, 0.35, 1.5); // whoosh of flame
    s.tone(t, 'sawtooth', 100, 170, 0.6, 0.06, 900);
    s.notes(t, 'square', [523, 784], 0.04, 0.05, 0.03); // code glitch
  },
  'ability:arjun-gravity': (s, t) => {
    s.tone(t, 'sine', 500, 55, 0.7, 0.18); // space folding
    s.tone(t, 'sine', 60, 420, 0.7, 0.12);
    s.noise(t + 0.3, 0.4, 'lowpass', 300, 1800, 0.25);
  },
  'ability:arjun-storm': (s, t) => {
    s.noise(t, 0.5, 'bandpass', 4500, 700, 0.35, 4); // crackling arcs
    s.tone(t, 'sawtooth', 2200, 280, 0.35, 0.07, 5000);
    s.noise(t + 0.25, 0.6, 'lowpass', 600, 60, 0.35); // thunder
  },
  'ability:arjun-timelock': (s, t) => {
    s.notes(t, 'square', [1300, 1300, 1300], 0.12, 0.03, 0.06); // ticking
    s.tone(t + 0.36, 'sine', 1800, 110, 1, 0.12); // time winding down
    s.tone(t + 0.4, 'triangle', 900, 55, 0.9, 0.08);
  },

  // Echo: drone builder android, wood
  'ability:echo-drone': (s, t) => {
    s.notes(t, 'triangle', [660, 880, 1320], 0.05, 0.08, 0.07); // friendly chirp
    s.tone(t + 0.15, 'square', 300, 620, 0.15, 0.04, 2000); // rotors up
  },
  'ability:echo-overclock': (s, t) => {
    s.tone(t, 'sawtooth', 180, 1700, 0.45, 0.07, 3200); // power whine
    s.notes(t + 0.1, 'square', [523, 659, 784, 1047], 0.06, 0.08, 0.05);
  },
  'ability:echo-nanites': (s, t) => {
    s.noise(t, 0.7, 'bandpass', 2600, 1500, 0.22, 8); // buzzing swarm
    s.tone(t, 'square', 170, 230, 0.7, 0.04, 1200);
  },
  'ability:echo-swarm': (s, t) => {
    for (let i = 0; i < 4; i++) s.notes(t + i * 0.09, 'triangle', [600 + i * 120, 900 + i * 120], 0.04, 0.07, 0.05);
    s.tone(t, 'square', 250, 700, 0.5, 0.04, 1800);
  },

  // Ronin: monoblade, metal
  'ability:kaito-step': (s, t) => {
    s.noise(t, 0.16, 'highpass', 2000, 8000, 0.25); // blink
    s.tone(t, 'sine', 1200, 3200, 0.1, 0.06);
    s.noise(t + 0.12, 0.08, 'highpass', 5000, 2500, 0.2); // cut on landing
  },
  'ability:kaito-iaido': (s, t) => {
    s.noise(t, 0.07, 'highpass', 6000, 3000, 0.3); // the draw
    s.tone(t + 0.04, 'triangle', 3520, 3400, 0.7, 0.07); // blade ring
    s.tone(t + 0.04, 'sine', 1760, 1740, 0.6, 0.05);
  },
  'ability:kaito-dance': (s, t) => {
    for (let i = 0; i < 3; i++) s.noise(t + i * 0.07, 0.06, 'highpass', 5000 + i * 800, 2500, 0.2);
    s.tone(t + 0.21, 'triangle', 2637, 2600, 0.3, 0.05);
  },
  'ability:kaito-cuts': (s, t) => {
    for (let i = 0; i < 8; i++) s.noise(t + i * 0.05, 0.04, 'highpass', 6000, 3000, 0.16);
    s.tone(t + 0.42, 'triangle', 3136, 3100, 0.8, 0.07); // final ring
  },

  // Tide: deep-dive rig, water
  'ability:nalani-riptide': (s, t) => {
    s.noise(t, 0.8, 'bandpass', 400, 1100, 0.3, 2); // swirling water
    s.tone(t, 'sine', 220, 140, 0.8, 0.08);
  },
  'ability:nalani-wave': (s, t) => {
    s.noise(t, 0.2, 'lowpass', 300, 1800, 0.25); // wave rising
    s.noise(t + 0.2, 0.6, 'lowpass', 2400, 250, 0.5); // crash
    s.noise(t + 0.25, 0.5, 'highpass', 4000, 2000, 0.12); // spray
  },
  'ability:nalani-dive': (s, t) => {
    s.tone(t, 'sine', 95, 30, 0.5, 0.55); // pressure boom
    s.noise(t, 0.4, 'lowpass', 700, 80, 0.35);
    s.notes(t + 0.2, 'sine', [400, 520, 680, 880], 0.05, 0.07, 0.04); // bubbles
  },
  'ability:nalani-tsunami': (s, t) => {
    s.noise(t, 1.4, 'lowpass', 150, 1300, 0.35); // the sea pulling back and rising
    s.tone(t, 'sine', 50, 110, 1.3, 0.2);
  },
  'impact:nalani-tsunami': (s, t) => {
    s.noise(t, 1.1, 'lowpass', 4000, 90, 0.65);
    s.tone(t, 'sine', 80, 28, 0.9, 0.45);
    s.noise(t + 0.1, 0.7, 'highpass', 4500, 2000, 0.15);
  },

  // Forge: street engineer, earth
  'ability:ines-charge': (s, t) => {
    s.notes(t, 'square', [2000, 2000, 2000], 0.07, 0.025, 0.05); // fuse ticks
    s.tone(t + 0.24, 'sine', 110, 38, 0.35, 0.5); // boom
    s.noise(t + 0.24, 0.35, 'lowpass', 1800, 120, 0.45);
  },
  'ability:ines-surge': (s, t) => {
    s.tone(t, 'sawtooth', 110, 480, 0.45, 0.12, 2200); // generators spinning up
    s.notes(t + 0.15, 'square', [196, 294, 392], 0.04, 0.3, 0.04); // power chord
    s.noise(t + 0.1, 0.3, 'bandpass', 3000, 1200, 0.1, 5);
  },
  'ability:ines-barricade': (s, t) => {
    s.noise(t, 0.08, 'bandpass', 2200, 1800, 0.25, 6); // metal clang
    s.tone(t, 'triangle', 330, 320, 0.4, 0.08);
    s.noise(t + 0.15, 0.08, 'bandpass', 1800, 1500, 0.22, 6);
    s.tone(t + 0.15, 'triangle', 247, 240, 0.4, 0.07);
  },
  'ability:ines-patch': (s, t) => {
    s.notes(t, 'sine', [523, 659, 784, 1047, 1319], 0.07, 0.25, 0.08); // systems restored
    s.noise(t, 0.5, 'highpass', 5000, 3000, 0.05);
  },

  // Rua: living garden, wood
  'ability:rua-thorns': (s, t) => {
    s.noise(t, 0.15, 'bandpass', 1600, 400, 0.35, 3); // snapping up through concrete
    s.tone(t, 'triangle', 320, 110, 0.18, 0.15);
    s.noise(t + 0.06, 0.06, 'highpass', 3000, 1500, 0.15);
  },
  'ability:rua-bramble': (s, t) => {
    s.noise(t, 0.7, 'bandpass', 3200, 1400, 0.18, 2); // rustling
    for (let i = 0; i < 3; i++) s.noise(t + 0.1 + i * 0.15, 0.04, 'highpass', 3500, 2000, 0.12); // twigs
  },
  'ability:rua-spores': (s, t) => {
    s.noise(t, 0.35, 'lowpass', 1300, 250, 0.3); // puff
    s.notes(t + 0.1, 'sine', [784, 988, 1175], 0.08, 0.2, 0.04);
  },
  'ability:rua-worldroot': (s, t) => {
    s.tone(t, 'sawtooth', 55, 38, 1.3, 0.22, 320); // deep groan
    s.noise(t, 1.2, 'lowpass', 320, 55, 0.5);
    s.tone(t + 0.3, 'triangle', 210, 150, 0.4, 0.06); // creaking wood
    s.tone(t + 0.7, 'triangle', 180, 120, 0.4, 0.05);
  },

  // Flare: pyro bounty hunter, fire
  'ability:zeynep-napalm': (s, t) => {
    s.tone(t, 'sine', 150, 45, 0.3, 0.45); // whump
    s.noise(t + 0.05, 0.7, 'bandpass', 600, 1600, 0.3, 1.2); // fire catching
  },
  'ability:zeynep-flash': (s, t) => {
    s.noise(t, 0.15, 'highpass', 3000, 900, 0.45); // bang
    s.tone(t, 'sine', 160, 50, 0.15, 0.3);
    s.tone(t + 0.05, 'sine', 4200, 4200, 0.8, 0.025); // ears ringing
  },
  'ability:zeynep-incendiary': (s, t) => {
    s.notes(t, 'square', [900, 650], 0.08, 0.04, 0.07); // reload clicks
    s.noise(t + 0.16, 0.3, 'bandpass', 1400, 2400, 0.18, 2); // rounds igniting
  },
  'ability:zeynep-sunfall': (s, t) => s.tone(t, 'sine', 2600, 500, 1.15, 0.08), // falling whistle
  'impact:zeynep-sunfall': (s, t) => {
    s.noise(t, 0.9, 'lowpass', 3500, 90, 0.6);
    s.tone(t, 'sawtooth', 320, 55, 0.6, 0.15, 1800);
    s.noise(t + 0.1, 0.8, 'bandpass', 700, 1500, 0.2, 1.2); // flames after
  },
};
