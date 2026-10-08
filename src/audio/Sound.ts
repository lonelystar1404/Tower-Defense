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
    this.lastPlayed.set(id, now);
    RECIPES[id](this, now);
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
const RECIPES: Record<SoundId, (s: Sound, t: number) => void> = {
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
  'pulse-blast': (s, t) => {
    s.noise(t, 0.3, 'lowpass', 2500, 300, 0.4);
    s.tone(t, 'sine', 300, 60, 0.3, 0.3);
  },
  emp: (s, t) => {
    s.tone(t, 'sawtooth', 80, 40, 0.5, 0.2, 800);
    s.noise(t, 0.4, 'bandpass', 600, 3000, 0.25, 2);
  },
  cryo: (s, t) => {
    s.tone(t, 'sine', 1800, 2600, 0.4, 0.07);
    s.noise(t, 0.5, 'highpass', 5000, 2500, 0.1);
  },
  'orbital-call': (s, t) => s.tone(t, 'sine', 400, 1600, 0.9, 0.08),
  'hero-punch': (s, t) => {
    s.tone(t, 'sine', 160, 60, 0.12, 0.35);
    s.noise(t, 0.08, 'lowpass', 1200, 300, 0.25);
  },
  'hero-zap': (s, t) => s.noise(t, 0.09, 'bandpass', 4000, 1500, 0.18, 6),
  firewall: (s, t) => s.noise(t, 0.6, 'bandpass', 500, 1400, 0.3, 1.5),
  leap: (s, t) => {
    s.tone(t, 'sawtooth', 200, 900, 0.18, 0.08, 2500);
    s.tone(t + 0.18, 'sine', 120, 40, 0.3, 0.45);
    s.noise(t + 0.18, 0.25, 'lowpass', 1500, 200, 0.4);
  },
  buff: (s, t) => s.notes(t, 'sawtooth', [330, 440, 660], 0.05, 0.12, 0.06),
  pierce: (s, t) => {
    s.tone(t, 'sawtooth', 3000, 400, 0.25, 0.1, 7000);
    s.noise(t, 0.1, 'highpass', 5000, 2500, 0.15);
  },
  mark: (s, t) => s.notes(t, 'square', [1200, 1600], 0.05, 0.06, 0.05),
  chain: (s, t) => {
    s.noise(t, 0.35, 'bandpass', 3500, 1200, 0.3, 4);
    s.tone(t, 'sawtooth', 1800, 500, 0.3, 0.06, 5000);
  },
  'time-lock': (s, t) => {
    s.tone(t, 'sine', 1200, 150, 0.9, 0.12);
    s.tone(t + 0.05, 'triangle', 600, 75, 0.9, 0.08);
  },
  summon: (s, t) => s.notes(t, 'triangle', [880, 660, 990], 0.05, 0.1, 0.07),
  overclock: (s, t) => s.tone(t, 'square', 300, 1500, 0.35, 0.06, 3000),
  knockback: (s, t) => {
    s.tone(t, 'sine', 90, 400, 0.35, 0.3);
    s.noise(t, 0.3, 'lowpass', 800, 2000, 0.2);
  },
  'orbital-impact': (s, t) => {
    s.noise(t, 0.8, 'lowpass', 3000, 80, 0.6);
    s.tone(t, 'sine', 70, 25, 0.8, 0.5);
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
