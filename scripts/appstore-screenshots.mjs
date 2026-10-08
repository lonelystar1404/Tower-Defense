// App Store screenshots: sets up real game scenes through the dev build's __td handle and
// captures them at Apple's sizes (iPhone 6.9" 2868×1320, iPad 13" 2752×2064).
//
// 1. npm run dev -- --port 5199 --strictPort
// 2. Chrome with remote debugging:
//    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/td-shots about:blank
// 3. node scripts/appstore-screenshots.mjs appstore/screenshots [scene]   (scene: battle, hero, boss, tower, maps)
import { mkdirSync } from 'node:fs';
import { open } from './cdp.mjs';

const OUT = process.argv[2] ?? 'appstore/screenshots';
const ONLY = process.argv[3]; // optional scene filter
const URL = 'http://localhost:5199/';
const DEVICES = [
  { dir: 'iphone-6.9', w: 956, h: 440, dpr: 3 },
  { dir: 'ipad-13', w: 1376, h: 1032, dpr: 2 },
];
const ALL_CLEARED = ['neon-district', 'harbor-grid', 'chrome-canyon', 'orbital-spire', 'zero-point', 'blackout-sector', 'core-nexus'];

/** In-page helpers: place towers by route coverage, run a wave in game time, use hero abilities. */
const HELPERS = `
window.__shot = {
  ranges: { cannon: 2.8, flak: 3.2, multi: 2.4, mortar: 3.4, chain: 2.4, sniper: 6 },
  targets: { cannon: ['ground'], mortar: ['ground'], flak: ['air'], multi: ['ground', 'air'], chain: ['ground', 'air'], sniper: ['ground', 'air'] },
  samples(route) { const pts = []; for (let d = 0; d < route.length; d += 0.25) pts.push(route.pointAt(d)); return pts; },
  build(plan) {
    const g = __td.game;
    g.gold = 1e6;
    const ground = this.samples(g.path), air = this.samples(g.airPath);
    for (const [weapon, preferred, level] of plan) {
      const elements = ['fire', 'water', 'wood', 'earth', 'metal'];
      const element = !g.isLocked({ weapon, element: preferred }) ? preferred : elements.find((e) => !g.isLocked({ weapon, element: e }));
      if (!element) continue;
      const pts = [...(this.targets[weapon].includes('ground') ? ground : []), ...(this.targets[weapon].includes('air') ? air : [])];
      let best = null, bestScore = 0;
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) {
        if (!g.canBuild(c, r)) continue;
        const score = pts.filter((p) => (p.x - c - 0.5) ** 2 + (p.y - r - 0.5) ** 2 <= this.ranges[weapon] ** 2).length;
        if (score > bestScore) { bestScore = score; best = [c, r]; }
      }
      if (!best) continue;
      const t = g.build(best[0], best[1], { weapon, element });
      for (let l = 1; t && l < level; l++) g.upgrade(t);
    }
  },
  /** Starts wave n and runs it for the given game seconds (lives can't run out meanwhile). */
  wave(n, seconds, until) {
    const g = __td.game;
    const lives = g.lives;
    g.lives = 9999;
    g.wavesStarted = n - 1;
    g.startWave();
    for (let i = 0; i < seconds * 60 && g.phase === 'wave'; i++) {
      g.update(1 / 60);
      if (until && until(g)) break;
    }
    g.lives = lives;
  },
  /** A hero at level 8 with every ability ready, standing near the busiest part of the road. */
  hero(level, x, y) {
    const h = __td.game.hero;
    h.level = level;
    h.kills = [0, 0, 8, 20, 36, 56, 80, 110, 145, 185, 230][level];
    h.cooldowns = h.cooldowns.map(() => 0);
    h.x = h.targetX = x;
    h.y = h.targetY = y;
  },
  /** Center of the enemies (for aimed abilities). */
  crowd() {
    const es = __td.game.enemies.filter((e) => e.alive);
    if (!es.length) return { x: 10, y: 6 };
    const sorted = [...es].sort((a, b) => b.distance - a.distance).slice(0, 8);
    return { x: sorted.reduce((s, e) => s + e.x, 0) / sorted.length, y: sorted.reduce((s, e) => s + e.y, 0) / sorted.length };
  },
  cast(slots) {
    const g = __td.game;
    for (const slot of slots) {
      const p = this.crowd();
      g.castHero(slot, p.x, p.y);
      for (let i = 0; i < 12; i++) g.update(1 / 60);
    }
  },
};`;

const b = await open();

async function fresh(device, progress = ALL_CLEARED, extra = '') {
  await b.emulate(device.w, device.h, { dpr: device.dpr });
  await b.goto(URL);
  await b.eval(`localStorage.clear(); localStorage.setItem('td-progress', JSON.stringify({ cleared: ${JSON.stringify(progress)} })); localStorage.setItem('td-lang', 'en'); ${extra}`);
  await b.goto(URL);
}

async function startMap(name, hero) {
  await b.eval(`[...document.querySelectorAll('.map-card')].find((c) => c.textContent.includes(${JSON.stringify(name)})).querySelector('[data-new]').click()`);
  await b.sleep(300);
  if (hero) {
    await b.eval(`document.querySelector('[data-hero="${hero}"]').click()`);
    await b.sleep(100);
    await b.eval(`document.querySelector('[data-deploy]').click()`);
    await b.sleep(300);
  }
  await b.eval(HELPERS);
  // Let the "BATTLEFIELD: …" banner (2.8s of real time) finish before setting up the scene.
  await b.sleep(3200);
}

const BEST = {
  'neon-district': { score: 2607, lives: 20, waves: 15, won: true },
  'harbor-grid': { score: 3419, lives: 20, waves: 20, won: true },
  'chrome-canyon': { score: 4185, lives: 17, waves: 25, won: true, hero: 'Echo' },
  'orbital-spire': { score: 6402, lives: 24, waves: 40, won: true, hero: 'Leila' },
};

const SCENES = {
  // 1. A busy fight: every element and weapon type working together.
  async battle(device) {
    await fresh(device);
    await startMap('Harbor Grid');
    await b.eval(`__shot.build([
      ['cannon', 'earth', 3], ['multi', 'water', 2], ['mortar', 'fire', 3], ['flak', 'metal', 2], ['chain', 'wood', 3],
      ['cannon', 'metal', 2], ['flak', 'water', 2], ['sniper', 'metal', 2], ['mortar', 'earth', 2], ['multi', 'fire', 2],
      ['chain', 'fire', 2], ['cannon', 'water', 1],
    ])`);
    console.log('  enemies', await b.eval(`__shot.wave(15, 11); const g = __td.game; g.gold = 318; g.lives = 18; g.score = { waves: 1400, speed: 1012 }; g.enemies.length`));
  },
  // 2. Heroes: abilities on the map.
  async hero(device) {
    await fresh(device);
    await startMap('Blackout Sector', 'arjun');
    await b.eval(`__shot.build([
      ['cannon', 'earth', 2], ['multi', 'water', 2], ['mortar', 'fire', 2], ['flak', 'metal', 2], ['chain', 'wood', 2],
      ['sniper', 'metal', 2], ['flak', 'water', 1], ['cannon', 'metal', 2],
    ])`);
    await b.eval(`__shot.wave(12, 19); const c = __shot.crowd(); __shot.hero(8, c.x - 1.2, c.y + 1.4); __shot.cast([0, 2]);
      const g = __td.game; g.gold = 205; g.lives = 19; g.score = { waves: 1100, speed: 742 };`);
  },
  // 3. A boss with its HP bar and a phase starting.
  async boss(device) {
    await fresh(device);
    await startMap('Orbital Spire');
    await b.eval(`__shot.build([
      ['flak', 'water', 3], ['flak', 'metal', 3], ['sniper', 'metal', 3], ['chain', 'wood', 3], ['multi', 'water', 3],
      ['cannon', 'earth', 3], ['mortar', 'fire', 3], ['flak', 'fire', 3], ['sniper', 'water', 2], ['chain', 'metal', 2],
      ['multi', 'metal', 2], ['flak', 'earth', 2],
    ])`);
    await b.eval(`__shot.wave(40, 120, (g) => g.enemies.some((e) => e.def.phases && e.distance > e.route.length * 0.35));
      const g = __td.game; const boss = g.enemies.find((e) => e.def.phases);
      if (boss) { boss.maxHp *= 6; boss.hp = boss.maxHp * 0.62; }
      for (let i = 0; i < 40; i++) g.update(1 / 60);
      if (g.hero) { const h = g.hero; __shot.hero(9, boss ? boss.x - 1 : 10, boss ? boss.y + 1.5 : 6); }
      g.gold = 512; g.lives = 22; g.score = { waves: 3900, speed: 2480 };`);
    console.log('  boss', await b.eval(`(() => { const e = __td.game.enemies.find((x) => x.def.phases); return e ? e.def.name + ' ' + e.distance.toFixed(1) + '/' + e.route.length.toFixed(1) : 'none, phase ' + __td.game.phase; })()`));
    // The boss arrival banner runs 3s of real time from when it's first drawn.
    await b.sleep(3200);
  },
  // 4. Tower details: upgrade, matchups, combos.
  async tower(device) {
    await fresh(device);
    await startMap('Chrome Canyon', null);
    await b.eval(`__shot.build([
      ['mortar', 'fire', 3], ['cannon', 'earth', 2], ['multi', 'water', 2], ['chain', 'wood', 2], ['flak', 'metal', 2], ['sniper', 'metal', 1],
    ])`);
    await b.eval(`__shot.wave(9, 11); const g = __td.game; g.gold = 164; g.lives = 20; g.score = { waves: 800, speed: 604 };`);
    // Select the level-3 Fire Mortar by tapping it, like a player.
    const pos = await b.eval(`(() => { const t = __td.game.towers[0]; const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + t.x * r.width / 20, y: r.top + t.y * r.height / 12 }; })()`);
    await b.tap(pos.x, pos.y);
    await b.sleep(3000);
  },
  // 5. Map select: seven maps, the Daily Challenge, best scores.
  async maps(device) {
    await fresh(device, ['neon-district', 'harbor-grid', 'chrome-canyon', 'orbital-spire'], `localStorage.setItem('td-best', ${JSON.stringify(JSON.stringify(BEST))});`);
    await b.sleep(300);
  },
};

for (const [name, scene] of Object.entries(SCENES)) {
  if (ONLY && ONLY !== name) continue;
  for (const device of DEVICES) {
    mkdirSync(`${OUT}/${device.dir}`, { recursive: true });
    await scene(device);
    await b.sleep(250);
    const index = Object.keys(SCENES).indexOf(name) + 1;
    await b.shot(`${OUT}/${device.dir}/${String(index).padStart(2, '0')}-${name}.png`);
    console.log(device.dir, name);
  }
}
console.log(b.logs.join('\n') || 'no errors');
b.close();
