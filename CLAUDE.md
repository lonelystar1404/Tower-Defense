# CLAUDE.md

This file gives Claude Code the context it needs to work on this project. It starts as a **game design outline**. Edit anything marked `TBD`, and change any number you don't like. The numbers are first guesses, meant to be tuned by playtesting.

## Project Overview

**Name:** Neon Wardens (towers and heroes guarding the data core)
**Platform:** Web browser (desktop and touch) and an iOS app (the same web build wrapped with Capacitor; see iOS App and Touch)
**Purpose:** A tower defense game where every tower is built from two choices:

1. **Element** (what the attack *does*): Fire, Water, Wood, Earth, Metal
2. **Weapon type** (what the tower *can hit*, and how many targets): Anti-Ground, Anti-Air, Multi-Target, and so on

So a "Fire Cannon" and a "Fire Flak" both burn, but the cannon hits ground units and the flak hits flyers. The player's main decision is how to mix elements and weapon types so every enemy type on a level is covered.

## Core Game Loop

1. A level starts with a map: one or more paths from the enemy spawn to the player's base.
2. The player gets starting gold and places towers on buildable tiles next to the path.
3. The player presses **Ready**. Enemies walk (ground) or fly (air) toward the base.
4. Towers attack on their own. Each kill gives gold.
5. The player builds, upgrades, or sells towers between waves *and* during them (selling refunds 70%). Between waves there's a **30s get-ready countdown**; the next wave starts by itself when it runs out, or right away when the player presses **Ready**.
6. Each enemy that reaches the base costs lives. At 0 lives the game is over. Surviving every wave clears the level.

## Elements (attack types)

Each element has one **signature effect**. The effects follow simple rules so the player can predict what they do.

| Element | Role | Signature effect | Starting numbers |
|---|---|---|---|
| 🔥 **Fire** | Damage over time | **Burn**: keeps doing damage after the hit | 10% of hit damage per second for 3s. A new hit restarts the timer; burns don't stack |
| 💧 **Water / Ice** | Crowd control | **Slow / Chill**: the enemy moves slower. 3 chills in a row cause **Freeze** | -30% speed for 2s. Freeze stops the enemy for 1s, then it is immune for 3s |
| 🌳 **Wood (Tree)** | Area control / support | **Root & Poison**: vines briefly hold ground units in place and poison them. Poison stacks | Root 0.5s (ground only). Poison 2 dmg/s per stack, max 5 stacks |
| 🪨 **Earth** | Heavy hitter vs. armor | **Stun + Armor Break**: chance to stun; each hit lowers the enemy's armor | 15% stun chance (0.75s). -2 armor per hit, max -10 |
| ⚙️ **Metal** | Raw damage | **Pierce + Critical**: highest base damage, ignores part of the armor, can crit | Ignores 50% of armor. 20% crit chance for 2× damage |

**Built (all five).** The numbers above were starting guesses; the current tuned values are:

| Element | Damage mult | Effect (current numbers, `src/data/status.ts`) |
|---|---|---|
| Fire | ×1.0 | Burn **25%** of hit damage per second for 3s. Refresh restarts the timer and keeps the stronger burn |
| Water | ×1.1 | Chill −30% speed for 2s. 3 chills in a row (before the chill runs out) Freeze for 1s; no new freeze until 3s after thawing |
| Wood | ×0.9 | Root ground units 0.5s, then 1s root immunity (so they can't be held forever). Poison **1.5**/s per stack, max 5, lasts **3s**; each hit adds a stack and refreshes the timer |
| Earth | ×1.15 | 15% stun (0.75s) with a small screen shake. −2 armor per hit, max −10, permanent |
| Metal | ×1.15 | Ignores 50% of armor. 20% crit for 2× |

Rules all elements share (`src/systems/status.ts`): burn and poison damage is applied continuously, ignores armor, keeps ticking while the enemy is frozen, rooted, or stunned, and pays the kill reward if it finishes the enemy. Frozen, rooted, and stunned enemies don't move at all; chilled ones move at 70%. The effect is applied only if the hit didn't kill. A hit rolls `rng` for the crit first, then for the stun.

### Element interactions (built: enemy elements and the weakness cycle)

The five elements follow the traditional Five Elements cycle. **Enemies have elements**, and the element that "overcomes" an enemy's element does bonus damage.

```
Overcomes (+50% damage):
  Water ──▶ Fire ──▶ Metal ──▶ Wood ──▶ Earth ──▶ Water

Resisted (−25% damage): the reverse direction.
  e.g. a Fire tower hitting a Water enemy does less.
```

- Enemy elements: each type has a default (see Enemies) and a wave group can override it (`element` on `SpawnGroup`, `null` = no element). Grunts have none by default; some waves give them one.
- Players see an enemy's element as a slowly turning dashed ring in the element's color, an element tag in the next-wave preview, and "WEAK!" (green) / "RESIST" (grey) popups on hits (at most one per enemy every 1.2s). The tower info panel lists each tower's matchups.

### Battlefields (built)

Each wave is fought on a random battlefield, rolled at the start and after every wave (never the same one twice in a row), together with the lockdown. Its element gets **+5%** and the element it overcomes gets **−5%**, for towers (damage dealt) and enemies (a boosted enemy takes 5% less damage, a weakened one 5% more). This multiplies into the element multiplier of the damage formula.

| Battlefield | Boosted +5% | Weakened −5% | Look |
|---|---|---|---|
| Mars | 🔥 Fire | ⚙️ Metal | red city, craters |
| Ocean | 💧 Water | 🔥 Fire | blue city, waves |
| Jungle | 🌳 Wood | 🪨 Earth | green city, leaves |
| Canyon | 🪨 Earth | 💧 Water | amber city, rock cracks |
| Factory | ⚙️ Metal | 🌳 Wood | violet-white city, gears |

- Data: `src/data/battlefields.ts` (names, elements, map palettes, `BATTLEFIELD_BONUS`). A level can override the bonus with `battlefieldBonus` (0 = no effect).
- UI: the map recolors with themed decorations, a "BATTLEFIELD: MARS" banner fades in and out on each change, the wave bar above the map shows the battlefield, and the info panel says how the battlefield affects the shown tower.

### Element combos (built)

Two different elements meeting on one enemy set off a combo. Numbers in `src/data/combos.ts` (`COMBO_NUMBERS`), rules in `applyHit` (`src/systems/combat.ts`, reading the enemy's state from before the hit) and `Game.combo` (Steam splash, Wildfire spread). Only tower hits make combos (heroes have an element for damage but set off no combos); statuses still can't land through a Shielder's shield.

| Combo | Elements | Trigger | Effect |
|---|---|---|---|
| **Steam** | Fire + Water | Fire hits a chilled enemy, or Water hits a burning one | Burst = 60% of the hit + all burn damage it had left, ignoring armor; enemies within 0.9 tiles take half of it; burn and chill end |
| **Wildfire** | Fire + Wood | A Fire or Wood hit leaves the enemy burning and poisoned | Its burn spreads to every enemy within 1.3 tiles (once per second per enemy) |
| **Shatter** | Water + Earth/Metal | Earth or Metal hits a frozen enemy | That hit does 2× damage; the freeze ends |
| **Corrosion** | Wood + Earth | Earth hits a poisoned enemy | +2 extra armor break and +1 poison stack |
| **Rupture** | Earth + Metal | Metal hits an enemy whose armor Earth has fully broken (−10) | The hit always crits |

- Feedback: a colored popup ("STEAM!", "WILDFIRE!", …; at most one per enemy every 0.5s) with a chime, plus a visual (steam ring, flame lines to the enemies it spreads to, ice burst, small pulses). The element line under the picker lists the selected element's combos (hover for details), and the tower info panel has a Combos block.
- In balance sims Steam and Wildfire fire constantly (tens of thousands per dozen games); Shatter, Corrosion, and Rupture are rarer because they need a freeze, poison, or full armor break first.

## Weapon Types (what a tower can target)

| Weapon type | Targets | Behavior | Strength | Weakness |
|---|---|---|---|---|
| **Cannon** (Anti-Ground) | Ground only | One heavy shot, slow fire rate | High damage per hit | Can't hit air |
| **Flak / Missile** (Anti-Air) | Air only (some upgrades add ground) | Fast homing shots | Bonus damage vs. air | Can't hit ground |
| **Multi-Shot** | Ground + Air | Fires at up to 3 targets at once | Good against crowds | Low damage per target |
| **Splash / Mortar** | Ground only | Shell explodes over an area | Great against tight groups | Slow; can miss fast enemies |
| **Chain / Beam** | Ground + Air | Hits one enemy, then jumps to 2–4 nearby ones | Spreads element effects fast | Damage drops with each jump |
| **Sniper** | Ground + Air | Very long range, very slow | Kills high-value targets | Useless against swarms |

Rule of thumb for balance: **the more a weapon can target, the less damage it does to each target.**

**Built (all six).** Current numbers live in `src/data/weapons.ts`; how each attack works:

| Weapon | Attack kind | Dmg | Rate/s | Range | Cost | Details |
|---|---|---|---|---|---|---|
| Cannon | single | 21 | 0.8 | 2.8 | 50 | Ground only |
| Flak | single | 5 | 2.0 | 3.2 | 45 | Air only, +50% vs air |
| Multi-Shot | multi | 4 | 0.85 | 2.4 | 65 | One shot at each of up to 3 different targets |
| Mortar | splash | 14 | 0.45 | 3.4 | 75 | Shell lands where the target will be; hits all ground in 1.1 tiles. Leads at most 2.0 tiles/s, so Runners (2.6) dodge |
| Chain | chain | 12.5 | 0.6 | 2.4 | 85 | Instant; jumps to 3 more within 1.6 tiles, −40% per jump |
| Sniper | single | 40 | 0.35 | 6.0 | 95 | Defaults to Strongest priority |

Damage numbers are before the element multiplier. **Tower balance (measured, 2026-10-08):** a fixed benchmark (600 gold of one weapon, placed by coverage on Neon District, averaged over all five elements, 150s against a steady stream of 5× HP enemies; burn and poison included) gives damage landed per gold, ground / air: Cannon 50 / –, Mortar 61 / –, Flak – / 47, Chain 32 / 32, Multi-Shot 28 / 27, Sniper 23 / 25. Rule: specialists (one target type) lead; weapons that hit both trail. Before this pass Chain was 40 / 38.5 (almost as good as Flak against air while also hitting ground, and spreading burn/poison to 4 enemies), Mortar 70, Multi-Shot 21, Sniper 16; the changes were Chain falloff 30% → 40% and cost 75 → 85, Mortar 16 → 14 dmg and 70 → 75 gold, Multi-Shot 3.1 → 4 dmg and 70 → 65 gold, Sniper 34 → 40 dmg, 0.3 → 0.35/s, 100 → 95 gold. Damage per gold measured on whole maps by the bot is less fair (early towers get the best spots for every wave), so use the benchmark for weapon tuning. Wood is the strongest element on Multi-Shot (poison stacks on 3 targets: ~40 vs ~24). Air bonus and chain falloff scale `base` before `computeDamage`; the formula itself is unchanged.

## Tower = Element × Weapon

Any element can go on any weapon type, which gives 5 × 5 combinations (5 × 6 with Sniper). Examples:

| Tower | Element + weapon | What it's good at |
|---|---|---|
| Inferno Mortar | Fire + Splash | Burns whole groups of ground enemies |
| Frost Flak | Water + Anti-Air | Slows fast flyers so other towers can hit them |
| Thornweb | Wood + Chain | Spreads poison through a crowd |
| Quake Cannon | Earth + Cannon | Stuns tough ground units and breaks their armor |
| Steel Volley | Metal + Multi-Shot | Raw damage on several targets, ground and air |
| Railgun | Metal + Sniper | Takes down bosses |

### How building works (decided: Option A)

- **Option A (chosen):** pick a weapon type, pick an element, pay. Every combination is available from the start (`AVAILABLE_TOWERS` in `src/data/towers.ts` lists what's buildable right now).
- ~~Option B (progression): build a plain weapon first, add an element at level 2.~~ Not used.

### Get-ready countdown (built)

- After each cleared wave a 30-second countdown starts (`PREP_TIME` in `src/data/levels.ts`; a level can override it with `prepTime`, 0 = no timer). When it reaches 0 the next wave starts by itself. The first wave has no timer: it waits for Ready so new players can set up.
- **Ready** (the button in the bar over the map, the sidebar button, or `Space`) starts the next wave immediately.
- The countdown runs on game time: it pauses with the game and runs 2–3× faster at 2×/3× speed.
- UI: a bar at the top of the map between waves shows "WAVE 2 CLEARED · +25 GOLD" (or "GET READY" before wave 1), "Next: wave 3 of 8 on Mars", the seconds left, a draining progress bar, and the READY button. In the last 5 seconds it turns red and the number pulses. The sidebar button reads "Ready · wave 3 in 0:27".

### Lockdown (built)

Each wave, **70%** of the 30 element × weapon combos (21) are randomly locked (except on Neon District, the first map, which has no lockdown so new players can learn every tower) ("encrypted") and can't be built or upgraded, leaving 9 open. A new lockdown is rolled when the level starts and after every wave, so the player sees it while building for the next wave.

- Towers already built keep working (and can be sold) when their combo is locked, but **can't be upgraded that wave** (`Game.upgrade` refuses; the info panel shows "🔒 Upgrade encrypted this wave" and the map shows a small 🔒 on the tower). A later lockdown that frees the combo allows upgrades again.
- Every weapon keeps at least 1 open element and every element at least 1 open weapon, so no role (e.g. anti-air) is ever fully locked. The roll reserves those minimums first, then opens the rest at random, so it always locks exactly its share (the old greedy roll could fall short at high fractions).
- Numbers live in `LOCKDOWN` (`src/data/towers.ts`). A level can override the share with `lockFraction` (0 turns lockdown off). Rolling is in `src/systems/lockdown.ts` and uses the game's seeded RNG.
- UI: a magenta notice under BUILD ("9 of 30 towers available, 21 encrypted"), a green badge on each element button with how many of its towers are **available** this wave (hover: "2 of 6 towers available this wave"), locked cards greyed and crossed out with 🔒 in place of the price. Locked cards can't be picked (click or hotkey), the placement preview turns red, and hovering one shows its details in the info panel with an "Encrypted this wave" note. If a new lockdown locks the tower being placed, the build tool is cleared.
- Effect on balance: the bot just swaps to another element for the same weapon, so a player who fills the map does as well at 70% as at 30% (better, even: the forced mixing sets off more combos). Players with few towers feel it most, because only ~30% of their towers can upgrade on a given wave. Map difficulty was retuned for 70% with `hpScale` (see Maps).

### Upgrades (built)

- 3 levels per tower. Each level adds damage and range and makes the element effect stronger. Upgrade from the info panel (or `U`) at any time, including during a wave. Upgrade gold counts toward the 70% sell refund.
- Current numbers (`TOWER_LEVELS` in `src/data/towers.ts`), as multipliers on level-1 stats:

| Level | Cost (× build cost, rounded to 5) | Damage | Range | Fire rate | Effect power |
|---|---|---|---|---|---|
| 1 | build | ×1 | ×1 | ×1 | 100% |
| 2 | ×0.6 | ×1.5 | ×1.1 | ×1 | 125% |
| 3 | ×1 | ×2.2 | ×1.25 | ×1.15 | 150% |

(Raised from 0.75/×1.4 and 1.25/×1.9 when waves 9–15 were added: upgrading was worse value than building, so the upgrading bot lost to the one that only built.)

- Effect power scales burn and poison damage, the chill slow (capped at 60%), root duration, stun chance, armor break per hit, and Metal's crit chance. Freeze timing, max poison stacks, and the armor break cap don't change. When effects from towers of different levels overlap, the stronger one is kept.
- Not built yet: the level-3 branch choice, e.g. Fire Cannon → *Magma* (bigger burn) or *Blast* (adds splash).

## Enemies

| Enemy | Movement | Notes |
|---|---|---|
| Grunt | Ground | Basic, balanced |
| Runner | Ground | Fast, low HP. Water slows counter it |
| Brute | Ground | High armor. Earth and Metal counter it |
| Swarm | Ground | Many tiny units. Splash, Chain, and Multi-Shot counter it |
| Drone (was Bat) | Air | Ignores the path and flies straight at the base. Needs Anti-Air |
| Wyvern | Air | Armored flyer |
| Boss | Ground or Air | One in each map's final wave, with HP phases (see Bosses) |

**Built:** Grunt, Runner, Brute, Swarm, Drone, Wyvern (numbers in `src/data/enemies.ts`). Air units fly a straight line from the path's start to the base (a level can override it with `airPath`); the map shows it as a faint dotted line. Air units are drawn above everything with a shadow (Drones have spinning rotors, Wyverns beating wings).

Each enemy has HP, speed, armor, movement type (ground or air), an element (optional, for the weakness cycle), and a gold reward.

**Enemy elements** (chosen so each tough enemy has a counter element; tuned with the balance bot): Grunt none (waves give some Earth, Water, Fire, Metal), Runner 💧 Water, Brute ⚙️ Metal (Fire counters), Swarm 🌳 Wood, Drone 🪨 Earth, Wyvern 🔥 Fire (Water counters).

## Maps (built)

Eight maps, played in order from a **map select** screen; beating a map unlocks the next (saved in localStorage, key `td-progress`). A map with `unlocked: true` is playable from the start (none use it now; Zero Point was unlocked during development and was locked again for the App Store release). Each map lives in `src/data/maps/` and is listed in `LEVELS` (`src/data/levels.ts`). Every map has 15–40 waves and each later map introduces its own new enemy types, which only appear on that map and later ones (Jammers and Mirrors return on the later hero maps, 6 and 7).

| # | Map | Waves | Road | New enemies | Start gold / lives |
|---|---|---|---|---|---|
| 1 | Neon District | 15 | winding road, left to right; no lockdown | the six base enemies (+ Siege Colossus in wave 15) | 150 / 20 |
| 2 | Harbor Grid | 20 | long back-and-forth along four rows | Shielder, Medic | 160 / 20 |
| 3 | Chrome Canyon | 25 | enters from the top; **first hero map (random hero)** | Splitter (+ Shard), Ghost | 170 / 20 |
| 4 | Orbital Spire | 40 | long spiral into the center; **random hero** | Phaser, Carrier | 180 / 25 |
| 5 | Zero Point | 30 | zigzag, left to right; **random hero** | Jammer, Mirror (plus every earlier enemy) | 170 / 20 |
| 6 | Blackout Sector | 30 | two U-bends, left to right; **41 obstacle tiles; has a hero** | Disruptor, Prism | 160 / 20 |
| 7 | Core Nexus | 35 | enters top right, loops round to a core in the middle; **40 obstacle tiles on a longer road (fewest free pads); has a hero** | Burrower, Warden | 160 / 20 |
| 8 | Overlink | 25 | column zigzag, left to right; **multiplayer map: Single or 2–5 players** (see Multiplayer) | Surger | 160 each / 20 |

- Maps 2–4 were generated from a wave list (themes per wave, e.g. "field hospital", "ghost town", "carrier fleet") with an HP multiplier of growth^(wave−1): Harbor ×1.055, Canyon ×1.062, Spire ×1.049, Zero Point ×1.09 per wave (Zero Point's finale groups are ×0.9 so the hero map doesn't end on a wall), Blackout Sector ×1.077 and Core Nexus ×1.079 (raised from ×1.064/×1.068 when they got heroes; finales ×0.62; Titans II extra HP ×2 on Blackout and ×1.5 on Core Nexus instead of ×3; Core Nexus's carrier armada at 0.8× HP so one wave doesn't decide the map). Maps 6–7 also add 3.5% more enemies per wave and mix in Jammers and Mirrors (about every fifth wave and in the finale). The output is plain data; edit it directly. Kill gold drops in long maps (×0.6 after wave 8, ×0.45 after 15, ×0.35 after 25, ×0.3 after 32); the last wave pays no bonus.
- **`hpScale`** (on `LevelDef`, applied to every spawn in `buildSpawnQueue`) tunes a whole map in one number. Current values (set for 70% lockdown and the 2026-10-08 tower and hero pass): Neon District **0.5** with **no lockdown** (`lockFraction: 0`) and only **15 waves** (cut from 30 on 2026-10-08; the Siege Colossus moved into wave 15 at ×5) and Harbor Grid **0.9** (the first maps are deliberately easy: on Neon a bot capped at 5 towers falls on wave 13, 7 towers win with 5–8 lives, 9+ towers win with 16–20, while ground-only and 3-tower builds still lose; on Harbor 12 towers win), Chrome Canyon **1.7** and Orbital Spire **1.45** (raised from 1.2 / 1.4 when they got random heroes: with every hero, Canyon wins 20/20 games with 13–20 lives, Spire 20/20; Spire at 1.5 dropped to 1–4 lives in some games and 1.65 lost 2 of 20), Zero Point 1.15, Blackout Sector 1.1, Core Nexus 0.88 (it lost 1–3 of 15 hero games at 1.0).
- The spawn portal is drawn on whichever map edge the road enters from.

### Obstacles (built)

A map can list `obstacles` (`ObstacleDef` in `src/data/levels.ts`: `kind`, top-left `col`/`row`, optional `w`/`h` in tiles). No tower can be built on those tiles (`Game.isObstacle`, checked in `canBuild`); enemies, the hero, and shots pass over them. Three looks, drawn into the cached background (`drawObstacle` in `src/render/Renderer.ts`): **tower** (skyscraper roof with lit windows and a red antenna light), **canal** (glowing coolant water with ripples), **wreck** (rubble behind a yellow/black hazard barrier). They sit on the best tiles inside the road's bends, so the player has fewer good spots. The placement preview turns red over them, and the map-select preview shows them as grey blocks. Only maps 6 and 7 use them so far; a test keeps them in bounds and off the road.

## New enemy abilities (built)

Defined as `ability` on `EnemyDef` (`src/data/enemies.ts`); rules in `Game.updateAbilities`, `Game.release`, `Enemy.takeDamage`, and `applyHit`.

| Enemy | Map | Ability | Counter |
|---|---|---|---|
| Shielder | Harbor Grid | Shield = 80% of max HP; absorbs damage first; **no status effects land while it holds**. Shows a hex bubble and a shield bar; "SHIELD DOWN" when it breaks | Raw damage (Metal), focus fire |
| Medic | Harbor Grid | Every 2s heals other enemies within 1.6 tiles by 12% of their max HP | Kill it first (Sniper, Strongest priority) |
| Splitter | Chrome Canyon | On death releases 3 Shards (fast, 12 HP base) with its element and HP multiplier | Splash, Chain |
| Ghost | Chrome Canyon | Hidden: towers can't target it unless any tower is within 2 tiles. Splash still hits it. Drawn faint and flickering while hidden | Towers close to the road, Mortars |
| Phaser | Orbital Spire | Every 3s teleports 2.5 tiles ahead (waits while stunned, frozen, or rooted); its diamond stretches as it charges | Stuns, freezes, roots |
| Carrier | Orbital Spire | Slow armored flyer (160 HP, costs 3 lives) that launches a Drone every 3.5s | Anti-air with range (Flak, Sniper) |
| Jammer | Zero Point | While within 2.5 tiles of the hero, the hero's cooldowns stop (bar shows "⚠ JAMMED"). Antenna arcs | Kill it with towers or keep the hero away |
| Mirror | Zero Point | Immune to the hero's attacks and abilities ("IMMUNE"); towers only. Chrome hexagon | Towers |
| Disruptor | Blackout Sector | Every 4s, towers within 1.6 tiles go **offline** for 2.5s (no aiming, recharging, or firing). Waits, charged, until a tower is in reach. Tesla prongs, a core that brightens as it charges; offline towers dim with sparks and "OFF 1.8" | Long range (Sniper, Mortar), towers set back from the road |
| Prism | Blackout Sector | Every 2.5s its element moves one step around the cycle (Water → Fire → Metal → Wood → Earth). Triangle with an inner facet in its current element | Mixed elements, raw damage |
| Burrower | Core Nexus | Every 4s on the surface, dives for 1.8s: keeps moving but can't be targeted or damaged by anything (shots in the air, splash, burn/poison, hero all do nothing). Can't dig while stunned, frozen, or rooted. Drill nose; drawn as a moving dirt mound while under | Stuns, freezes, roots; towers along the whole road |
| Warden | Core Nexus | Other enemies within 1.8 tiles get +5 armor (recomputed every tick; not itself). Armored box with a shield crest and a dotted aura; fortified enemies get green brackets | Kill it first; Metal pierce, Earth armor break |
| Surger | Overlink | Other enemies within 1.8 tiles move 35% faster (`Enemy.surgeMult`, recomputed every tick; not itself). Orange arrowhead with a pulsing engine and a dotted aura | Kill it first; chill or root the group |

Released enemies (Shards, launched Drones) join at the end of the tick, so the hit that killed the parent can't also hit them. They keep the parent's HP multiplier and reward scaling.

## Bosses (built)

Every map's final wave has exactly one boss, in place of the old "titan" group (a test enforces one boss per map, in its last wave). Bosses are enemies with `phases` (`BossPhase` in `src/data/enemies.ts`): each phase starts once, the first time HP falls to its threshold (several can start after one big hit), and runs a list of actions (`BossAction`: summon, shield, enrage, shift, cleanse). Rules in `Game.updateBoss`. Wave groups set each boss's HP multiplier and element per map; escorts it summons share its HP multiplier. The map's `hpScale` applies on top of the multipliers in the table below, and the boss balance numbers further down were measured before `hpScale` and the 70% lockdown.

| Boss | Maps | Base | Phases |
|---|---|---|---|
| Siege Colossus | Neon District (×17.5, Fire), Zero Point (×20, Metal) | ground, 1000 HP, armor 8, speed 0.5, 10 lives | 66%: 2 Brutes + 6 Grunts. 33% Overdrive: cleanses effects (armor break stays), ×1.6 speed |
| Bulwark | Harbor Grid (×4.8) | ground, Water, 700 HP, armor 4, starts with a 50% shield, 8 lives | 60% Shield Wall: new 40% shield + 3 Shielders. 25% Last Stand: 30% shield, ×1.4 speed |
| Chimera | Chrome Canyon (×9), Blackout Sector (×18) | ground, Fire, 900 HP, armor 3, 8 lives | 75 / 50 / 25% Mutation: element moves one step around the cycle and 2 Splitters drop; at 50% also cleanses, at 25% ×1.3 speed |
| Sky Leviathan | Orbital Spire (×7, Fire), Core Nexus (×8) | air, Water, 1000 HP, armor 5, speed 0.42, launches a Drone every 7s, 8 lives | 66% Deflector: 25% shield. 33% Launch Bay: 4 Drones + 1 Wyvern, ×1.15 speed |

- **Look:** bosses are drawn 10% larger than their radius with a turning ring of rune arcs (faster once enraged), a glowing core in their current element, and their own hull (Colossus octagon with shoulder cannons, Bulwark rounded block with a front plate, Chimera pentagon with rippling spines, Leviathan long hull with swept wings).
- **UI:** a boss HP bar at the top of the map (name, phase, %, white marks at each phase threshold, blue shield strip), a "⚠ BOSS: …" banner when it arrives, the phase name ("OVERDRIVE", "MUTATION: METAL") with a pulse and screen shake at each phase, a BOSS tag in the wave preview and map roster, and two sounds (`boss` alarm horn on arrival, `boss-phase` rumble).
- **Balance** (bot with the mixed plan, 3 seeds per map and per hero): every game still wins. Ground bosses die 41–79% of the way along the road (mostly 55–75%) against a full, upgraded map, so a real player with fewer towers feels them. Air bosses are deadlier because the flight line is short: the Leviathan reaches 85–100% and costs 0–15 lives on Spire and Core Nexus. Its first version (spawn every 4s, 10 lives, 8 escort flyers, ×1.3 speed) lost 2 of 15 Core Nexus games, mostly from the Drones it launched.

## Heroes (built: maps 3–7)

A map with `heroStart` gets a hero (rule: every map from Chrome Canyon, map 3, on has one, enforced by a test in `tests/maps.test.ts`; give any new later map a `heroStart`). `heroMode` decides how: **maps 3–5 are `'random'`**: the game rolls one of the player's unlocked heroes (no hero select; the prep bar says "Get ready · Your hero this time: Arjun"; Reboot keeps the same hero, a new run or Next map re-rolls; the second roster joins the pool once Core Nexus is cleared). **Maps 6–7 use `'choose'`** (the default): a **hero select** screen before the map starts (last pick saved in localStorage, key `td-hero`; Restart keeps the same hero). Map cards say "🎲 Random hero" or "🦸 Choose your hero". Hero starts: Chrome Canyon 10,5 (inside the middle U), Orbital Spire 10,5 (inside the spiral). Data in `src/data/hero.ts` (`HEROES`, `HERO_LEVELS`), entity in `src/entities/Hero.ts`, rules in `Game` (`moveHero`, `castHero`, `updateHero`, `updateSummons`, `updateZones`, `heroXp`).

**Shared rules:**
- **No health, no mana.** Heroes can't be hurt; abilities only cost a cooldown.
- **Moving:** right-click anywhere on the map (or select the hero with a click / `H` / its portrait, then left-click open ground). Straight line, anywhere on the map, at the hero's own speed.
- **Leveling:** every enemy that dies within 3 tiles of the hero (killed by anything) counts. Total kills for levels 2–10: 8, 20, 36, 56, 80, 110, 145, 185, 230. Each level above 1: +8% damage (was +12%), −4% cooldowns.
- **Abilities** by slot on Z X C V, unlocking at levels 1, 3, 5, 8. Point abilities: press the key, then click the map (shows reach and area, or a line for Piercing Round; right-click/Esc cancels). Self and global abilities fire at once.
- **Elements:** each hero has one element (`element` on `HeroDef`): Vex 💧 Water, Brick 🪨 Earth, Leila ⚙️ Metal, Arjun 🔥 Fire, Echo 🌳 Wood. Every bit of hero damage (attacks, abilities, zone damage over time, Echo's drones) uses the same weakness cycle as towers (+50% against the element it overcomes, −25% against the one that overcomes it) and the battlefield ±5% (`Game.heroElementMult`), with WEAK!/RESIST popups. Heroes apply no element status effects and set off no combos. The element shows in the hero profile (hero select and info panel), next to the call sign on the hero bar, and in a Matchups block in the hero info panel.
- **Mirrors** are immune to everything heroes do (attacks, abilities, drones). **Jammers** near the hero stop its cooldowns (effect countdowns keep running).

**The first roster (always available)**, each with a passive too (added 2026-10-08):

| Hero | Passive (always on) |
|---|---|
| Vex | **Spotter Uplink**: enemies within 2.5 tiles of her take +15% damage from everything (towers included; `Enemy.auraAmp`, recomputed every tick) |
| Brick | **Aftershock**: every 3rd punch stuns everything it hits for 0.6s (`Hero.attacks`) |
| Leila | **Headshot**: her crits deal 3× instead of 2× (scales the base before the shared formula) |
| Arjun | **Combustion**: enemies he kills explode for 12 damage within 1 tile (explosion kills don't explode again) |
| Echo | **Auto-Loader**: towers within 2.5 tiles fire 15% faster (`Game.towerRateMult`) |


| Hero | Who | Element · role / attack | Z (Lv 1) | X (Lv 3) | C (Lv 5) | V (Lv 8) |
|---|---|---|---|---|---|---|
| **Vex Adeyemi** (yellow) | she/her · Human · Lagos, Nigeria · drone engineer | 💧 Water · Tactician · 10 dmg laser, range 2.6 | Pulse Blast: 65 dmg area (7s) | EMP: stun 1.5s + strip shields around her (16s) | Cryo Field: 6s zone, −50% speed | Orbital Strike: 520 dmg anywhere after 1s |
| **Mateo "Brick" Ruiz** (orange) | he/him · Cyborg · Mexico City, Mexico · ex-demolition worker | 🪨 Earth · Melee · 13 dmg punches (0.85/s) that cleave 30% onto enemies within 0.6 tiles of the target, range 1.1 | Ground Slam: 45 dmg + 0.8s stun around him (11s) | Rocket Leap: jump up to 5 tiles, 55 dmg on landing | Overdrive: 6s of 1.8× attack speed, 1.3× damage | Seismic Quake: 150 dmg, 2.5s stun, shields stripped in 3.5 tiles |
| **Leila Haddad** (pink) | she/her · Human (ocular implant) · Beirut, Lebanon · marksman | ⚙️ Metal · Ranged · 22 dmg (1/s), range 4.5, 60% pierce, 20% crit | Piercing Round: 95 dmg to everything in an 8-tile line (7s) | Mark Target: +35% damage taken from everything for 6s | Rapid Fire: 5s of 3× attack speed | Headhunter: 380 dmg to the 6 toughest enemies anywhere |
| **Arjun Mehta** (violet) | he/him · Hologram (uploaded mind) · Mumbai, India · physics teacher | 🔥 Fire · Mage · 11 dmg bolt that jumps to 2 more (−25% each) | Firewall: 5s zone, 26 dmg/s | Gravity Well: throw enemies 3 tiles back along the road | Chain Storm: 90 dmg lightning through up to 10 enemies, overloads shields | Time Lock: every enemy on the map stunned 3.5s |
| **Echo** (green) | they/them · Android · built in Seoul, South Korea · self-taught builder | 🌳 Wood · Summoner · 9 dmg rapid shots (2.2/s) | Deploy Drone: a turret for 12s (20 dmg, 2/s) | Overclock Towers: towers in 3.5 tiles fire 2× as fast for 8s | Nanite Cloud: 6s zone, 25 dmg/s, −4 armor, eats shields | Drone Swarm: 4 heavy drones for 15s (26 dmg each) |

**The second roster (unlocked by clearing Core Nexus, `unlockedBy: 'core-nexus'`), each with a passive:** until then their cards on hero select are greyed with "🔒 Clear Core Nexus to unlock" and can't be picked (`isHeroUnlocked` in `src/ui/progress.ts`). Each roster covers all five elements once. The Daily Challenge can hand out any of the ten.

| Hero | Who | Element · role / attack | Passive (always on) | Z (Lv 1) | X (Lv 3) | C (Lv 5) | V (Lv 8) |
|---|---|---|---|---|---|---|---|
| **Kaito "Ronin" Sato** (white) | he/him · Human (cybernetic arm) · Osaka, Japan · kendo champion | ⚙️ Metal · Duelist · 15 dmg melee (1.1/s), range 1.2, 50% pierce, 20% crit | **Finisher**: his hits deal +60% damage to enemies below 30% HP | Flash Step: blink 4.5 tiles, 85 dmg where he lands | Iaido: 115 dmg in a 5-tile line | Blade Dance: 6s of 2.2× attack speed, 1.2× damage | Thousand Cuts: 240 dmg to the 8 toughest enemies |
| **Nalani "Tide" Kahale** (blue) | she/her · Human (deep-dive rig) · Honolulu, Hawaiʻi · salvage diver | 💧 Water · Controller · 9 dmg (1.4/s), range 3 | **Undertow**: enemies within 2.5 tiles move 30% slower | Riptide: 6s zone, −45% speed, 14 dmg/s | Rogue Wave: knock enemies 2.5 tiles back, 45 dmg | Pressure Dive: 50 dmg + 1s stun around her | Tsunami: 320 dmg in 3 tiles anywhere after 1.5s |
| **Inês "Forge" Duarte** (sand) | she/her · Human (exo-frame) · São Paulo, Brazil · street mechanic | 🪨 Earth · Engineer · 10 dmg (1/s), range 2.6 | **Field Engineer**: towers within 3 tiles deal +20% damage | Seismic Charge: 55 dmg + 0.6s stun | Power Surge: towers in 3.5 tiles deal +40% for 8s | Barricade: 7s zone, −60% speed, −3 armor | Core Patch: restore 4 lives (90s) |
| **Rua Tane** (lime) | he/him · Human (bio-grafts) · Tāmaki Makaurau (Auckland), Aotearoa New Zealand · botanist | 🌳 Wood · Grower · 8 dmg bolt (1.5/s) that jumps to 1 more, range 3 | **Overgrowth**: his hits root and poison like a level-1 Wood tower | Thorn Burst: 50 dmg in 1.4 tiles | Bramble Field: 6s zone, −35% speed, 18 dmg/s | Spore Cloud: +30% damage taken for 6s | Worldroot: 8s zone of 3.2 tiles, −70% speed, 30 dmg/s, −4 armor |
| **Zeynep "Flare" Demir** (red-orange) | she/her · Human (pyro rig) · Istanbul, Türkiye · bounty hunter | 🔥 Fire · Bounty Hunter · 12 dmg (1.2/s), range 3.2, 15% crit | **Bounty**: kills within 3 tiles pay +30% gold | Napalm: 4s zone, 30 dmg/s | Flashbang: 1.2s stun in 2 tiles | Incendiary Rounds: 7s of 1.6× speed and 1.6× damage | Sunfall: 420 dmg in 2.4 tiles anywhere after 1.2s |

**No skill kills regardless of HP** (rule, with a test): every ability and passive deals a set amount of damage. Ronin's old Execution (instantly finish enemies at ≤12% HP) became Finisher (+60% damage below 30% HP); the "hit the toughest enemies" ability kind is `snipe` (Headhunter, Thousand Cuts: fixed damage).

**Passives** (`HeroPassive` on `HeroDef`, every hero has one; rules in `Game`): vulnerable-aura, every-nth-stun, crit-mult, death-burst, and tower-rate-aura for the first roster; finisher (`heroDamage`, scales the base like crits), slow-aura (`updateHero`, works like standing in a slow zone; not on Mirrors), tower-aura (`towerDamageMult`, used by every tower hit), element-hits (`heroOnHit` calls the shared `applyElementEffect`, so the usual stacking rules apply; still no combos from heroes), bounty (`reward`). Heroes with a ranged passive (Undertow, Field Engineer, Bounty) draw a faint turning dotted ring at its reach. The passive is shown as one of the abilities: a dashed, slowly spinning "✦" tile before Z X C V on the hero bar ("Always on"; not clickable), the first entry in the hero select ability list (tagged "Passive"), and a block with its icon in the hero info panel. Passive icons are `ABILITY_ICONS['<hero>-passive']`.

**Ability pass (2026-10-08, latest):** every ability was compared by estimated damage per second of cooldown at its unlock level. Toned down: Pulse Blast 70→65, Piercing Round 110→95, Firewall 30→26/s, Iaido 130→115, Pressure Dive 60→50, Sunfall 480→420 (radius 2.6→2.4), Napalm 34→30/s. Raised: Ground Slam 40→45, Overdrive 1.6/1.25→1.8/1.3, Incendiary Rounds 6s 1.5/1.5→7s 1.6/1.6, Deploy Drone 17→20 dmg, Vex (Pulse cooldown 8→7s, EMP 18→16s, Orbital Strike 450→520, Spotter +12→+15%), Ronin (attack 13→15, Flash Step 70→85, Finisher +60%), Undertow 25→30%. Result on all five hero maps (2 seeds each): **every hero wins 10/10**; average lives (of 20): Flare 19.2, Leila and Forge 19.8, Echo 19.7, Arjun 19.2, Brick 19.1, Vex 18.9, Rua 18.8, Tide 18.6, Ronin 17.0. Hero share of all damage 5% (Forge) to 29% (Ronin), most 14–20%.

**Earlier: balance with passives on all ten** (bot, Zero Point / Blackout Sector / Core Nexus, 3 seeds each, 2026-10-08): all ten win 9/9. Average lives: Vex 18.7, Brick 18.6 (was 15.7 before Aftershock: the passives were sized to lift the weakest), Leila 18.2, Ronin 17.8, Arjun, Echo, Tide, Forge, Rua, Flare 20. Hero kill share: Forge 10%, Echo 16%, Vex and Tide 22%, Leila, Rua, Flare 26%, Brick 30%, Arjun 35% (Combustion was 20 dmg and pushed him to 38%, so it's 12), Ronin 43%. Earlier second-roster numbers: all five win 9/9. Average lives: Tide, Forge, Rua, and Flare 20.0 (like Arjun and Echo), Ronin 17.8 (like Vex 18.9 and Leila 18.1; Brick 15.7). Hero kill share: Forge 10% (her value is tower damage), Tide 22%, Rua and Flare 26%, Ronin ~43%. Execution takes the last hit on enemies towers have worn down, so his share stays high even after the toning-down (15 → 13 attack, threshold 15% → 12%, Thousand Cuts 10×260 → 8×240); his results match the others.

**Effect kinds** (`HeroEffect` in `src/data/hero.ts`): blast, zone, strike, dash, buff, pierce, mark, execute, knockback, chain, freeze-all, summon, tower-boost (fire rate and/or damage; `Tower.boostDamage`), repair (restore lives, capped at the map's starting lives). A new hero is mostly data: pick effects and numbers, add four icons to `ABILITY_ICONS` (`src/ui/HeroBar.ts`) and a silhouette to `drawHeroSprite` (`src/render/sprites.ts`).

**UI:**
- Hero select: one card per hero (ten, second roster locked until Core Nexus is cleared) with an animated portrait, name, role, pronouns, race, origin, bio, attack style, passive (second roster), and the four abilities with icons and unlock levels. "Deploy <name>" starts the map.
- On the map each hero has its own silhouette in its signature color (Vex a caped arrow, Brick a bulky frame with fists, Leila a slim body with a long rifle, Arjun a flickering hologram with orbiting glyphs, Echo a round android with an antenna), a level badge, an XP ring, and a move marker. Echo's drones show a timer ring; marked enemies get a red reticle; overclocked towers a dashed ring.
- The **hero bar** under the map uses the hero's color: call sign, level, XP ("174/185 kills nearby"), the passive tile (second roster), and four ability buttons. Each icon sits in a **clock face**: while recharging, a white hand sweeps clockwise from 12 o'clock and the hero color fills in behind it; while the effect runs ("Active 4.2s" / "Impact 0.6s") a cyan hand eats the cyan ring ahead of it. In the last second the clock flashes, and it pops once when the ability comes off cooldown. Ready icons glow in the hero color; locked ones are dim (🔒 unlock level).
- **Hover tooltips** (`src/ui/tooltip.ts`, any element with `data-tip`): ability tiles on the hero bar and hero select show a styled tooltip right away with the name, key · unlock level · cooldown, and the description (passives: "✦ Passive · Always on").
- Effect countdowns on the map are clocks (`drawClock` in `src/render/Renderer.ts`): a faint ring with quarter ticks, the time left as an arc from the hand clockwise back to 12 o'clock, and a hand sweeping clockwise (a line from the center on zones and strike markers, a dot on the rim for the rings around the hero and Echo's drones). The last second (last 0.5s for strikes) flashes white. Zones also show their seconds, strikes "IMPACT 0.6", hero rings "<ability> 1.2s".
- Selecting the hero shows its profile, attack, and abilities in the info panel.

**Balance:** the bot plays every hero (abilities when they'd hit something; melee heroes chase the lead enemy; knockbacks saved for enemies near the core). Heroes were toned down so towers carry most of the fight and heroes are even with each other. Measured on Zero Point (3 seeds each), share of kills / of all damage: Vex 17% / 13%, Brick 28% / 20%, Leila 25% / 14%, Arjun 23% / 14%, Echo 17% / 9% (Echo's real value is overclocking towers, counted as tower damage). Brick stays a little ahead because chasing the lead enemy gets him last hits. Before this pass Brick was at 60% of kills. These shares were measured before heroes had elements; with elements every hero still wins Zero Point in the test suite, but the shares haven't been re-measured. **Hero pass (2026-10-08, with 70% lockdown):** Arjun won every game at full lives while Leila and Brick lost some on Zero Point and Blackout Sector, so Leila got 19 → 22 attack, 0.9 → 1 shot/s, Piercing Round 8s → 7s; Brick 11 → 13 punches and Ground Slam 30 → 40; Arjun's Firewall 36 → 30 dmg/s. Afterwards every hero wins every probe game on all three hero maps (3–4 seeds each): Zero Point 11–20 lives (Vex and Brick closest), Blackout Sector 14–20 (Leila closest), Core Nexus 5–20 (Brick closest). Hero kill share 20–37% on Zero Point and Blackout, 3–27% on Core Nexus (Echo 2–7% there: Echo's value is overclocking towers). Every hero has an answer to shields (Vex EMP, Brick Seismic Quake, Leila's marks and burst, Arjun Chain Storm, Echo Nanite Cloud). Zero Point's HP growth was raised to ×1.09 per wave to match weaker heroes: all heroes win on 5 probe seeds, but some games end with 1–3 lives (Vex and Brick find it hardest; Arjun and Echo win cleanly). Blackout Sector (hero starts at tile 9,7, inside the first U) and Core Nexus (12,5, inside the inner loop): every hero wins 6/6 probe seeds, with 2–20 and 3–20 lives left. Brick and Leila have the closest games; Echo never loses a life.

## Tower Mockups

Rough visual concepts. **Decided: cyberpunk neon, vector shapes drawn in code** (see Art Style below). The **color comes from the element** and the **shape comes from the weapon type**, so the player can tell both at a glance.

**Element colors and accents**

| Element | Main color | Visual accent |
|---|---|---|
| Fire | Red / orange | Flames on top, glowing embers |
| Water | Blue / cyan | Ice crystals, frosty rim |
| Wood | Green / brown | Vines around the base, leaves |
| Earth | Tan / dark brown | Stone blocks, cracks |
| Metal | Silver / gray | Rivets, polished plating |

**Weapon shapes** (side view)

```
  CANNON (Anti-Ground)      FLAK (Anti-Air)           MULTI-SHOT
                              \   /
        ___                    \ /                     \  |  /
   ====[___]                  [###]                   [=====]
       |   |                  |   |                    |   |
     __|___|__              __|___|__                __|___|__
    |_________|            |_________|              |_________|
   one thick barrel,       two barrels angled       three barrels
   pointing sideways        up at the sky            fanned out

  SPLASH / MORTAR           CHAIN / BEAM              SNIPER
        _____                   (*)                     ______________
       /     \                   |                 ===[__]
      |  ( )  |               /‾‾‾‾‾\                  |  |
      |_______|               | ≈≈≈ |                  |  |
     _|_______|_              |_____|                __|__|__
    |___________|            |_______|              |________|
   short, wide bowl         orb or coil on top       very long thin barrel,
   pointing up              that sparks between      tall narrow base
                            targets
```

**Example combined mockups**

```
  INFERNO MORTAR (Fire + Splash)        FROST FLAK (Water + Anti-Air)
        ,  ) ( ,                                *  \   /  *
       ( (  )  )   ← flames                       \ /
        _______                                 [#❄#]   ← ice-tipped barrels
       /  ( )  \                                |   |
      |  ~~~~~  |  ← orange glow               _|___|_
     _|_________|_                            |❄ ❄ ❄ |  ← frosted blue base
    |▓▓▓▓▓▓▓▓▓▓▓▓▓| red brick base            |_______|

  THORNWEB (Wood + Chain)               STEEL VOLLEY (Metal + Multi-Shot)
          (@)   ← seed pod orb                \   |   /
        /‾‾‾‾‾\                              [o=o=o=o]  ← riveted plating
       | ~ψ~ψ~ | ← vines                       |  ║  |
      _|_______|_                            __|__║__|__
     |¥¥¥¥¥¥¥¥¥¥¥| leafy wooden base         |▒▒▒▒▒▒▒▒▒▒▒| polished steel base

  QUAKE CANNON (Earth + Cannon)         RAILGUN (Metal + Sniper)
        ___  ← cracked stone barrel           ________________
   ≡≡≡≡[▓▓▓]                             ═══[■■]  ← long silver rail
       |▓ ▓|                                 |┃┃|
     __|▓▓▓|__                             __|┃┃|__
    |█▓█▓█▓█▓█| stacked boulder base      |▒▒▒▒▒▒▒▒| polished steel base
```

**Upgrade look (built):** each level draws the tower 8% bigger. Level 2 adds an inner neon frame, 25% larger element motifs, and level pips on the bottom edge. Level 3 adds a glowing ring and aura around the base, swept fins on the turret, a bigger glowing core, and 50% larger motifs. Upgrading flashes a blast in the element's color with "LV 2" / "LV 3" text.

**Attack visuals (built, see Current State):** Fire shoots a fireball with a smoke trail. Water shoots an ice shard and tints slowed enemies blue. Wood draws green vines between chained enemies. Earth throws a rock that cracks on impact, with a small screen shake on a stun. Metal fires a fast bullet tracer and shows "CRIT!" on crits.

## Art Style (decided: cyberpunk)

Neon-on-dark cyberpunk. Gameplay, numbers, and tower names are unchanged by the theme.

- **World:** a night city grid. Buildable tiles are dark rooftop pads (some with lit windows or vents). The enemy road is dark asphalt with neon edges and a dashed center line. The whole map is recolored per battlefield (see Battlefields). Enemies come out of a magenta **portal** (left) and attack a hexagonal cyan **data core** (the base), which pulses and turns red and flickers faster once more than half the lives are gone. The air route is a magenta dotted line.
- **Towers:** dark armor plates with neon trim in the element color, a glowing core, and lighter barrels so the weapon shape reads. Element motifs: flames (Fire), ice crystals (Water), bio-circuit vines with glowing nodes (Wood), hazard-striped blocks (Earth), chrome bolts (Metal).
- **Enemies are robots:** dark hulls with neon trim and a glowing visor facing where they move. Grunt (red), Runner (yellow, light trails), Brute (violet armored box with plating seams), Swarm (orange diamonds), Drone (magenta quad-rotor; the Bat was renamed Drone), Wyvern (teal gunship with swept wings). Ground units hover on a colored underglow.
- **Effects** use additive blending for a glow: tracers, halos, blasts, arcs.
- **Neon palette:** element colors are Fire `#ff5a36`, Water `#00e5ff`, Wood `#39ff88`, Earth `#ffb020`, Metal `#c9d1ff`. UI accents: cyan `#00f0ff`, magenta `#ff2bd6`, gold `#ffe600`, red `#ff3864`.
- **Layout:** a full-width **top bar**, then three columns: map, build menu (sidebar), tower info panel. The top bar's first line has the title, Lives/Gold/Wave, the Ready button, speed controls, and the mute icon; its second line has the battlefield on the left (name, boosted and weakened element; hover for the full rule) and the enemy list on the right ("Next wave 3/8" between waves, "Wave 3/8" during one), each enemy with count, element tag, and AIR tag. The sidebar holds only the build menu (lockdown notice, element picker, weapon cards, key help). Under 1180px the columns slim down, element tags show only the icon, and the battlefield modifiers wrap under its name. Under 900px the map spans the full width with build and info side by side below, and the top bar's controls get their own line. Under 560px everything stacks.
- **UI:** dark translucent panels with cyan borders, glowing buttons, CRT scanlines over the playfield, a glitchy title. Fonts are **Orbitron** (headings, numbers) and **Share Tech Mono** (body), bundled in `src/fonts/` (`@font-face` in `style.css`), so they work offline and in the iOS app.
- **Where colors live:** per-battlefield map colors in `src/data/battlefields.ts`; other canvas colors in `src/render/theme.ts`; element colors in `src/data/elements.ts`; enemy colors in `src/data/enemies.ts`; page UI colors as CSS variables in `src/style.css`. Keep the theme file and CSS variables in step.
- **Logo** (`public/`): `logo-mark.svg` is a hexagonal neon shield (cyan → magenta) around the glowing hex data core, with the five element nodes on a pentagon (Wood top, then Fire, Earth, Metal, Water clockwise, the generating order). Lines join each element to the one it overcomes (Water → Fire → Metal → Wood → Earth → Water), each colored from one element to the other, and they form a pentagram, so the star is the game's weakness cycle. `logo.svg` adds the wordmark "NEON" (cyan) / "WARDENS" (magenta) in Orbitron and the tagline "GUARD THE DATA CORE". `favicon.svg` is a simpler, thicker version for small sizes and is the page icon in `index.html`.
- **Wording:** level "Neon District", win "District secured", lose "Core breached", restart button "Reboot".

## Sound (built)

All sound effects are synthesized with the Web Audio API in `src/audio/Sound.ts`: no audio files, no dependency. Cyberpunk synth style.

- **How it's wired:** `Game` queues `GameSound` events (what happened) and the page drains them every frame (`game.drainSounds()`) and plays them; `Game` never touches audio. The queue is capped at 64 so headless runs don't grow it. UI-only sounds (`denied`, `click`) are played by `main.ts`.
- **Hero abilities:** every ability has its own sound (`HERO_SOUNDS` in `src/audio/Sound.ts`, keyed `ability:<ability id>`), and the three delayed strikes have an impact sound (`impact:<ability id>`): e.g. Pulse Blast charge-and-burst, EMP power drop with crackle, Cryo Field forming crystals, Orbital Strike lock-on beeps then the beam, Rocket Leap rockets then landing, Seismic Quake long rumble with cracks, Piercing Round rail crack, Headhunter six shots, Firewall flame whoosh, Time Lock ticking then winding down, Echo's drone chirps, Iaido blade ring, Tsunami rising sea then crash, Core Patch "systems restored" chime, Worldroot deep groan with creaking wood, Flashbang bang with ringing ears, Sunfall falling whistle then fire. Arjun's Combustion pops (`combustion`). A test checks every ability has one.
- **Sounds:** a shot per weapon type (cannon thump, flak blip, multi-shot triple tick, mortar launch, chain zap, sniper laser), mortar blast, kill blip, crit sparkle, freeze shimmer, stun thud, leak alarm, build chime, upgrade arpeggio, sell coin, wave-start siren, wave-clear chord, boss alarm horn and phase rumble, win fanfare, lose descent, countdown ticks in the last 5 seconds (higher on the last), "denied" buzz (locked/unaffordable build, invalid tile, failed upgrade), and a soft click when picking an element or weapon.
- **Keeping it listenable:** each sound has a minimum gap before it can replay (`MIN_GAP`), at most 24 voices play at once, a slight random detune avoids repetition, and a compressor sits on the master bus. Master volume is `MASTER_VOLUME` (0.35).
- **Browser rules:** the AudioContext is only created on the first click or key press.
- **Mute:** speaker icon at the right end of the top bar (turns red with an × when muted) or `M`. The choice is saved in localStorage (`td-muted`) when storage is available.

## Multiplayer (built: party engine, Map 8, local play, online rooms)

From Map 8 on, maps have two modes: **Single** (one hero) and **Multiplayer** (2–5 players). Decided with the user: online play (each player on their own phone) through **Firebase**; each player has their **own gold**; 2+ players must be able to win Map 8 while one hero can't; a party covering all five elements gets **+10% hero damage** and nothing else.

- **MemberId** (`src/platform/member.ts`): created on first launch, `NW-XXXX-XXXX-XXXX` (12 characters from an alphabet without 0/O/1/I/L), saved in localStorage `td-member` and mirrored on iOS. Shown in the map select footer (tap to copy). It will identify players in online rooms; until then it never leaves the device (the privacy page says so).
- **Players** (`Game.players`, `Player`): each has a name, optional MemberId, **gold**, and a hero. Single-player is one player; `game.gold` and `game.hero` are player 1's (so single-player code and tests are unchanged), `game.heroes` is every hero. Party options: `new Game(level, rng, hero, { party: { heroes, memberIds, names } })`, capped at `PARTY.maxPlayers`. Heroes start around `heroStart` at fixed offsets (`PARTY_START_OFFSETS`, no trig, so every device agrees).
- **Ownership and gold:** towers have an `owner`; `build(col, row, option, player)` spends that player's gold; only the owner can `upgrade`/`sell` (refund to them). **Kill gold goes to whoever made the kill** (tower owner or hero's player; burn/poison kills to the enemy's `lastHitBy`), Bounty adds to it; **the wave bonus goes to every player**. Lives, score, lockdown, and battlefield are shared.
- **Heroes per player:** `moveHero(x, y, player)`, `castHero(slot, x, y, player)`, `heroAbilityReady(slot, player)`. Every hero mechanic works per hero: zones, strikes, and drones remember their `owner` hero (element, kill gold); XP goes to every hero within range of a kill; tower auras (Field Engineer, Auto-Loader) and Bounty apply from any hero; Jammers jam each hero separately. `Hero.player` is its player index, `Hero.partyMult` the party bonus.
- **Five-element bonus** (`PARTY.fullElementsAttack` = 0.1, `Game.fullElementParty`): when the party's heroes cover Fire, Water, Wood, Earth, and Metal, every hero's attack and ability damage is ×1.1 (via `Hero.damageMult`). Shown on hero select (element row) and under the map.
- **Saves:** snapshots keep every player (`players`: gold, hero id, hero position/level/kills) and tower owners; restore rebuilds the party.
- **Map 8: Overlink** (`src/data/maps/overlink.ts`, `multiplayer: true`): 25 waves, a column zigzag with a few obstacles, hero start in the middle U, every enemy type from the campaign plus the new **Surger** (other enemies within 1.8 tiles move 35% faster; arrowhead with a pulsing engine and an aura ring), and the Siege Colossus to finish. Economy built for parties: kill gold ×0.6 → ×0.3 over the map, wave bonus 40 + 6 per wave (to each player). **`hpScale` 3.2**, tuned with the party bot (`tests/partyBot.ts`): all 10 heroes alone lose (2 seeds each, mostly by wave 14–22; Forge falls on wave 3–4), every pair wins (10 pairs × 2 seeds, 5–20 lives left), a full five-element party wins with 20. At ×3.5 one pair starts losing; at ×2.5 solo still reaches wave 22–24. Never picked for the Daily Challenge (one hero).
- **UI (one device for now):** Map 8's card has **Single** and **👥 Multiplayer**. Multiplayer opens hero select in party mode: tap heroes in player order (P1–P5 badges), 2–5 different heroes, element coverage row, "Start with N players". In game a **party bar** under the map shows each player's chip (P#, hero, element, gold; names hidden on phones); the active chip is the player using the screen. On a shared device, tapping a chip, a hero, or someone's tower (or Tab) switches player. Towers show a dot in their owner's color (`PLAYER_COLORS`), heroes a P# tag; the info panel says who owns a tower. Gold in the top bar is the active player's.
- **Online rooms** (Firebase project `neon-wardens`: Realtime Database + anonymous sign-in; config in `src/net/online.ts`, which is loaded on demand so the SDK only downloads for online players). Map 8 → Multiplayer opens a chooser: **Online room** (Create a room / Join with a 5-character code; a recent room is offered as Rejoin) or **This device** (the local party above). The room lobby is a **"champion select"** screen (chosen from four mockups inspired by League of Legends/Dota 2, Brawl Stars/Overwatch, Bloons TD 6 co-op, and the earlier 3-column version): a header (room code with Copy code, map and wave count, Leave); a **strip of five player cards** across the top (portrait, P#, host tag, MemberId or "You", hero, ✓ when ready; empty slots say "open"); the five-element row; the **hero grid** with element filter tabs (All, 🔥💧🌳🪨⚙), P# badges on taken heroes and an ⓘ per hero; the **hero details** on the right; and along the bottom a **see-through chat** (collapsible, unread count; `rooms/{CODE}/chat`, last 50 messages, 200 characters, plain text, ~1 message per 0.6 s; deleted with the room) and a big **READY** button (enabled once a hero is picked; picking or changing a hero clears it). When 2–5 players are here, all with different heroes and all ready, **every screen counts down 5 s** ("Starting in 5…", with ticks; `READY_DELAY`) and the host's device starts the game; anyone un-readying stops the countdown. On phones (landscape ≤520 px tall or ≤760 px wide) the strip is compact, the grid is five across, the chat is a short bar, and ⓘ opens the details as a **pop-up**. The lobby is built once and updates in place, so a half-typed chat message survives others' changes. The details panel (`heroDetails` in HeroSelect.ts: portrait, profile, stats, passive, each ability with its description, key, unlock level, cooldown) shows the last hero tapped; tapping a free hero also picks it (unless you're ready), a taken one shows "Taken by P2".
- **Lockstep** (`src/net/lockstep.ts`): one device is the clock (`meta.host`; at first the room's creator). Every 6 ticks (0.1 s of game time) it publishes a turn `{ s: speed, c: commands }` with the commands it received; every device runs the same turns on its own copy of the game (`roomGame`: same seed for combat, conditions, and a per-wave reseed `waveSeed`). Clients send commands (`src/net/commands.ts`: build/up/sell/prio by tile, move, cast, ready; validated by `isCommand`, applied by `applyCommand`) to the host's inbox and see them in a turn about one round trip later. Clients run turns at the host's speed and catch up when behind. **Anyone can pause/resume or change speed** (`meta/paused`, `pausedBy`, `speed`; "Paused by P2"); the clock follows the room's values. Nobody restarts. In `main.ts` every game-changing action goes through `act()` (applied at once offline, sent online).
- **Checkpoints and resync:** at each wave end every device hashes its snapshot (FNV of the JSON, including `live` state: countdown, cooldowns, timers, zones, strikes, drones; drawing angles excluded); the host publishes `{ turn, hash, snap }` to `checks/{wave}`. A device whose hash differs restores the host's snapshot (`Game.restore(..., { exact: true })`) and replays the turns since; a rejoining player starts from the latest checkpoint. The host prunes turns older than the previous checkpoint and keeps two checkpoints.
- **Determinism:** game rules use only + − × ÷ and `Math.sqrt` (`src/systems/dmath.ts`: `sq`, `dist`, `powi`, `ringPoints`); `Math.hypot`, `**`, and trig are drawing-only (`tests/determinism.test.ts` fails otherwise; `atan2` only for `.angle`). Shots fly along `Tower.aimX/aimY`, Echo's drones use a fixed ring table. Verified: a scripted 5-hero game of all 25 waves of Map 8 gives identical wave hashes in V8 (Chrome, Node) and JavaScriptCore (Safari, iOS). `tests/lockstep.test.ts` runs a host and two clients over a laggy in-memory network to the same final state, and a corrupted client resyncs.
- **The game survives the host leaving.** Every player has a presence entry (`players/{uid}`, removed by onDisconnect, re-added on reconnect via `.info/connected`) and the clock writes a heartbeat (`meta/beat`, server time, every `BEAT_MS` = 2 s, even while paused). If the clock is gone from the room for `CLOCK_GRACE` (3 s) or silent for `HOST_TIMEOUT_MS` (8 s; Firebase can take up to a minute to notice a phone that lost signal), the first other player still here (slot order) claims `meta/host` in a transaction; the rules allow that only when the old host is absent or its heartbeat is stale. The new clock calls `Lockstep.handover(lastTurnInDb)`: it runs every turn the old clock published, then publishes from there and reads the inbox. A device that loses the clock role (it dropped out and was replaced) rebuilds from the latest checkpoint as a follower. Anyone who left, the old host included, can **Rejoin** with the code (remembered for 3 h). The same takeover works in the lobby (the new host can start). A device that isn't connected never claims.
- **Room lifetime:** the last player to leave deletes the room (`leave()`); the clock deletes turns/checks/inbox at game over. `/roomIndex/{CODE}` holds each room's creation time; creating a room deletes up to 10 rooms older than a day (the rules let anyone read only index entries older than a day, and delete only such stale rooms).
- **Room data** (`/rooms/{CODE}`): `meta`, `players/{uid}`, `inbox`, `turns`, `checks`; security rules in `database.rules.json` (signed-in only, rooms can't be listed, only the current host writes turns/checks/meta except: any player in the game can write `paused`/`pausedBy`/`speed`, and can take `host` from an absent or silent host; players write only themselves and their own inbox entries). `PROTOCOL` in online.ts (now 3) must be bumped when rules or data change; re-publish `database.rules.json` in the console after editing it.
- **Setup in the Firebase console** (done 2026-10-08): Authentication → Sign-in method → **Anonymous: enabled**; Realtime Database → Rules = `database.rules.json` (re-publish it there after changing the file). Without them, creating a room says "Online play isn't switched on for this game yet."
- **Tested live, takeover version** (2026-10-08): lobby hero details (a guest tapping the host's hero sees "Taken by P1", 7 stats, passive + 4 abilities, and stays unpicked); a guest's pause freezes the host's game and shows "Paused by P2". The first live takeover test showed that a closed tab's presence can linger (Firebase noticed only later), which is why the heartbeat exists.
- **Tested live** (2026-10-08, two headless Chrome profiles = two anonymous users, against the real Firebase project): create room, join with the code, hero picks (taken heroes disabled for the other player), start; towers built by clicking on both devices; guest's speed buttons disabled; the guest's Ready starts the wave for both; the guest's right-click moves its hero on both screens; after wave 1 both devices had identical lives, gold, towers, hero positions, and score, with 0 resyncs (the guest ran ~5 turns behind the host); the guest leaving dims their chip on the host; after the host leaves, joining the old code says "No room with that code" (data deleted). In dev builds `__td.session` exposes the lockstep session (`turn`, `resyncs`).
- **Privacy:** the policy (public/privacy.html) describes online rooms: Firebase holds the room code, an anonymous sign-in ID, MemberId, hero, moves, and wave snapshots while the room is open, all deleted when it closes. App Store privacy answers need updating when online rooms ship (see the iOS section).

## Map score (built)

Every run has a score, so players on the same map (or the same Daily Challenge) can see who did better. Numbers in `SCORE` (`src/data/score.ts`), rules in `Game` (`score`, `scoreTotal`, `checkWaveEnd`).

- **Per cleared wave: 100 points**, plus **up to 100 speed points**. The speed clock starts when the wave's last enemy spawns (a wave can't be cleared earlier): clearing right then earns 100, falling linearly to 0 over the time the wave's slowest enemy needs to walk (or fly) its whole route. The speed points are multiplied by the share of the wave's enemies that were killed rather than leaked (released Shards and Drones count), so letting a wave run through scores nothing.
- **Lives: −50 per life below the starting lives**, live (a restored life gives its points back). The total never goes below 0.
- Game time, not wall time, so 1×/2×/3× and pausing don't change it. Measured with the balance bot: full Neon District ~2,600 (avg ~73 speed points a wave), a 7-tower build that wins with 5–7 lives ~1,750, Harbor Grid ~3,400, Zero Point ~4,500–4,700 (≈58 a wave: harder maps clear slower).
- **UI:** a badge at the top left of the map ("SCORE 1,240"; hover or tap for the breakdown and the rule). After each clear a "+175 ⚡75" chip hangs under it for 4s; losing a life flashes it red. On narrow maps (container query on `#board`) the get-ready bar moves right of it. The end screen adds a Score block (waves, speed, lives lost, total) and "New best on this map!" or the best so far.
- **Best per map** (campaign runs, `td-best` in localStorage, mirrored on iOS): score, lives left, waves held, win, and the hero's call sign. Map cards show "🏆 Best score 2,607 · 20 ♥ left · Leila".
- Saved runs keep the score (`score` in the snapshot; older saves continue with 100 per wave already cleared).
- **Future multiplayer:** the plan is several players, each with a hero, defending the same map and comparing scores. The score is a plain number from game state, ready to send to a shared leaderboard later; there's no backend yet.

## Save and resume (built)

- A run is saved after every cleared wave, and also when the tab is hidden or closed and when the map menu opens, as long as it's between waves (`Game.snapshot()`: towers with level/spend/priority, gold, lives, hero position/level/kills, stats, the coming wave's battlefield and lockdown). Mid-wave progress isn't saved: a reload restarts the wave in progress from its start.
- One save per map plus one for the daily, in localStorage (`td-saves`, `src/ui/saves.ts`). `Game.restore()` rebuilds the run; the countdown waits for Ready. Saves have a version (`SNAPSHOT_VERSION`); old ones are dropped when the shape changes.
- Map cards with a save show **Continue · wave N/M**, **New run** (asks first), and lives left. Clicking the card continues. Winning, losing, Reboot, ↻ restart, or a new run clears the save.

## Daily Challenge (built)

- One challenge per UTC day (`src/game/daily.ts`): the date seeds the map, the hero (on hero maps; no hero select), and every wave's battlefield and lockdown (`GameOptions.conditionsSeed`: each wave's roll depends only on the seed and wave number, so everyone gets the same conditions however their fights go). Combat randomness (crits, stuns) stays random.
- Scored like any map (see Map score; `dailyScore` returns `game.scoreTotal`; it used to be 100 per wave + 50 per life left + 1000 for a win). The best today is kept in localStorage (`td-daily`).
- UI: a magenta Daily Challenge card at the top of map select (date, map, hero, best today, Play daily / Continue / New attempt). Any map can be the daily, locked or not, and a daily win doesn't unlock campaign maps. The top bar reads "Daily 2026-10-08 · <map>". The end screen shows the score and best, and **Copy result** puts a short text (date, map, hero, result, score, link) on the clipboard to share.

## Languages (built)

English, Español, 中文 (Simplified Chinese), and Tiếng Việt, picked from a dropdown in the top bar (left of the mute button). The choice is saved in localStorage (`td-lang`); with nothing saved, the browser's language is used if we have it. Switching relabels everything live, mid-run included.

- **How it works** (`src/i18n/`): the English text is the key. Wrap every player-facing string in `t('English text', { n })` with `{placeholders}` for numbers and names (`tr` in the renderer, where `t` is a local); data strings (tower, enemy, hero, map, combo names and descriptions) are wrapped where they're shown (`t(def.name)`). Each language is a dictionary `es.ts` / `zh.ts` / `vi.ts` from English to the translation; a missing key falls back to English. Static text in `index.html` uses `data-i18n` / `data-i18n-title` / `data-i18n-aria`; the help footer is built in `main.ts`.
- **Adding text:** use `t()` with a plain string literal (both sides of a ternary are fine; template literals are not keys), then add the English → translation line to all three dictionaries. `tests/i18n.test.ts` collects every key (all `t()`/`tr()` calls in src, every name/description in the data, the index.html attributes; see `tests/i18nKeys.ts`) and fails on missing keys, mismatched placeholders, or stale keys. About 470 strings today.
- **Fonts:** Orbitron and Share Tech Mono have no Vietnamese tone marks or Chinese characters, so for `vi` and `zh` the CSS font variables (`:root:lang(...)`) and the canvas fonts (`canvasFont` in `src/render/theme.ts`) switch to system fonts.
- Hero names and call signs, the game title, and key names ([M], Space shown as is in English/Chinese) stay as they are. Translations were written by Claude and haven't been checked by native speakers yet.

## iOS App and Touch (built)

The game ships to iPhone and iPad as the same web build inside a native shell (**Capacitor 8**, Swift Package Manager, no CocoaPods). There's one codebase: every gameplay change reaches the web and the app.

- **Workflow:** `npm run ios:sync` (builds `dist/` and copies it into `ios/App/App/public`), then `npm run ios:open` and press Run in Xcode (simulator, or your iPhone with a free Apple ID; the App Store needs a paid Apple Developer account). Config in `capacitor.config.ts` (app id `com.thiennguyen.neonwardens`, change it before publishing if you want another; dark background, no page bounce). The Xcode project in `ios/` is checked in; `ios/App/App/public` and generated config are git-ignored.
- **Signing:** automatic, team `Q5NLGAD2WM` (the paid Apple Developer account), set in the Xcode project. `ITSAppUsesNonExemptEncryption = false` in Info.plist, so uploads skip the export-compliance question (the game uses no encryption beyond HTTPS).
- **iOS project settings:** iPhone is landscape only and the status bar is hidden (`ios/App/App/Info.plist`); iPad allows every orientation. Minimum iOS 16 (the layout uses `:has()` and `dvh`). App icon (1024, no alpha) and launch screen (2732², logo + wordmark) were rendered from `public/logo-mark.svg` into `ios/App/App/Assets.xcassets`.
- **Saves on iOS** (`src/platform/nativeStorage.ts`): the game still uses localStorage; in the app the `td-*` keys are mirrored into Capacitor Preferences (UserDefaults) after each save, at game end, and when the app is backgrounded, and copied back on launch if iOS cleared the web view's storage (`await restoreNativeStorage()` at the top of `main.ts`). No-op in a browser.
- **Touch input** (`src/main.ts`, by `pointerType`; mouse behavior is unchanged): build = tap a weapon card, tap a pad to preview (ghost + range), tap the same pad again to build. Aimed hero abilities = tap the ability, tap to aim, tap the same spot (within 0.75 tiles) to fire. Tap the hero (or its portrait) to select it, then tap the map to move. **Long press (0.5s)** = right-click: cancel the tool, else walk the hero there. A **tool bar** over the bottom of the map shows what to do next ("Tap a pad to preview, tap it again to build") with a **Cancel** button (shown for mouse too). Weapon-card hover previews are mouse only. Tooltips (`data-tip`) show on tap for non-buttons (passive tile, hero-select ability lists) for 3s. The help footer switches to tap instructions on coarse pointers. No double-tap zoom, tap flash, or long-press callout on the map.
- **Tablet layouts:** iPads held sideways (`(orientation: landscape) and (pointer: coarse) and (max-width: 1400px)`) share the phone's two-column layout (big map, build column, info floating over it with a ✕) but keep the full top bar with the battlefield and enemy list; the Ready label shrinks to fit. iPads held upright (`(orientation: portrait) and (max-width: 1100px)`) use the stacked small-screen layout (map full width, build and info side by side below). Checked at iPad Pro 13", Air 11", and mini sizes, with a hero map too.
- **Phone layout** (`@media (orientation: landscape) and (max-height: 520px)` in `style.css`, on top of the shared two-column rules): one slim top bar (stats, Ready, speed, buttons; no title or wave-info line), the map as big as the height allows (`--chrome` = height used around it, larger with a hero bar), and the build menu in a right column (no descriptions, lockdown notice, or help). The info panel floats over the build menu only while a tower or the hero is selected, with a ✕ (`data-kind` on `#info-panel`). Hero abilities are bare clocks. The end screen covers the whole screen. Safe-area insets (notch, Dynamic Island, home bar) pad the page and the full-screen menus (`viewport-fit=cover`). Phones held upright get "Turn your phone sideways for a bigger map." and the stacked layout.
- **Fonts** are bundled (`src/fonts/`, latin subsets of Orbitron and Share Tech Mono, SIL OFL with license files), so the app works offline; Google Fonts is no longer loaded.
- **Privacy policy and support pages** (`public/privacy.html`, `public/support.html`, styled by `public/pages.css`): plain pages shipped with the site and inside the app. Live at https://lonelystar1404.github.io/Tower-Defense/privacy.html and …/support.html. Contact: lonelystar1404@gmail.com and the repo's GitHub Issues. Apple requires the policy to be reachable in the app: the map select screen has "Privacy policy · Support" links at the bottom (each page links back to the game). Update the policy (and its date) before adding anything that collects data (accounts, online leaderboards).
- **App Store listing** (`appstore/listing.md`): name, subtitle, categories, promotional text, keywords, description, review notes, URLs, all within Apple's limits. **Screenshots** in `appstore/screenshots/` (iPhone 6.9" 2868×1320 and iPad 13" 2752×2064, five scenes: battle, hero, boss, tower details, map select), captured from the real game by `scripts/appstore-screenshots.mjs` (Chrome DevTools protocol with device emulation and touch; setup steps at the top of the script).
- **Released builds:** 1.0 (1) uploaded to App Store Connect on 2026-10-08 (Zero Point locked). Every upload needs a higher build number (Xcode → General → Build).
- **Daily share text** leaves out the link when the page isn't on http(s) (in the app it would be `capacitor://localhost`).
- Verified: driven in Chrome with phone emulation and real touch events (build, select/close, long-press cancel, hero move, end screen, portrait, desktop unchanged) and run in the iPhone 17 simulator (launches in landscape, fonts, safe areas, Preferences bridge).
- Not done yet: App Store listing, signing, screenshots; haptics; a smaller-phone pass (iPhone SE landscape is 667×375: it fits but is tight).

## Game Modes & Progression (TBD)

- Campaign: about 10 levels, each adding a new enemy type or element mechanic.
- Endless mode: waves keep getting harder until you lose. High score saved on the device.
- Unlocks (optional): new weapon types or level-3 branches unlocked by beating levels.

## Tech Stack (decided)

- **TypeScript** + **Vite**, builds to plain static files (`base: './'`, so any static host or subfolder works).
- **Rendering:** plain **HTML5 Canvas**, no game engine. Towers and enemies are vector shapes drawn in code (`src/render/sprites.ts`).
- **Tests:** **Vitest**.
- **Data-driven balance:** all towers, elements, weapon types, enemies, and waves live in `src/data/`, not in game logic, so tuning numbers never needs a code change.
- **Save data:** `localStorage`, no backend: MemberId (`td-member`), map progress (`td-progress`), saved runs (`td-saves`), daily best (`td-daily`), best score per map (`td-best`), last hero (`td-hero`), mute (`td-muted`).
- **Hosting:** any static host (GitHub Pages, Netlify, Vercel). `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main` (Pages source must be set to "GitHub Actions" in the repo settings).
- **Runtime dependencies:** `@capacitor/core` and `@capacitor/preferences` (only used inside the iOS app; a no-op on the web), `firebase` (online rooms only; loaded on demand). Dev dependencies: `typescript`, `vite`, `vitest`, `@capacitor/cli`, `@capacitor/ios`.
- **iOS:** Capacitor 8 wraps `dist/` in a native app (`ios/`, see iOS App and Touch).

## Commands

```
npm install      # once
npm run dev      # dev server at http://localhost:5173
npm test         # unit + balance tests
npm run build    # type-check and build to dist/
npm run ios:sync # build and copy into the iOS app
npm run ios:open # open the iOS project in Xcode (then Run)
```

## Project Structure

```
index.html          - page shell: canvas, sidebar HUD, game-over overlay
/src
  main.ts           - wires Game + Renderer + Hud, input, fixed-step loop (60 Hz, speed 1×/2×/3×, pause)
  /data             - elements, weapons, towers (combos, names, stats, sell refund), enemies (+ abilities), status, battlefields, levels
  /data/maps        - one file per map (road, obstacles, gold, lives, waves)
  /systems          - damage formula, path, targeting, combat (applyHit), seeded RNG
  /entities         - Tower, Enemy, Projectile, Hero
  /game/Game.ts     - all game state and rules for one level (plus snapshot/restore); no DOM, runs headless in tests
  /game/daily.ts    - Daily Challenge (date → map, hero, seed) and its score
  /render           - Renderer (canvas, background cache, effects), sprites (tower art), theme (canvas palette)
  /ui               - Hud (top bar, build menu, overlays), InfoPanel (tower/hero details), HeroBar, HeroSelect, MapMenu (map select, daily card), progress (unlocks), saves (saved runs, daily best)
  /audio            - synthesized sound effects
  /platform         - nativeStorage (iOS: mirror saves into app preferences), member (MemberId)
  /net              - commands, lockstep (online sync), online (Firebase rooms)
  /fonts            - bundled Orbitron + Share Tech Mono (OFL)
/ios                - Capacitor iOS project (Xcode: ios/App/App.xcodeproj)
/public             - logo, favicon, privacy.html, support.html, pages.css (copied as-is into dist/)
/appstore           - App Store listing text and screenshots
/scripts            - appstore-screenshots.mjs + cdp.mjs (Chrome DevTools driver)
capacitor.config.ts - app id, name, web dir, iOS options
/tests              - damage, path, targeting, game rules, and a headless balance simulation
```

Game logic works in **tile units** (tile (c, r) has its center at (c + 0.5, r + 0.5)); only the renderer converts to pixels (`TILE = 40`).

## Conventions

- The damage formula lives in one place: `final = base × elementMultiplier × (crit ? 2 : 1) − effectiveArmor` (minimum 1). Don't re-implement it per tower.
- Status effects (Burn, Chill, Freeze, Root, Poison, Stun, Armor Break) are one shared system with clear stacking and refresh rules, not logic written separately for each tower.
- Each tower has a targeting priority (First / Last / Strongest / Closest) that the player can change from the tower panel. The default comes from the weapon (`defaultPriority`). "First" means least distance left to the base along the enemy's own route, so ground and air enemies compare fairly.
- New attack behaviors go in `AttackDef` (`src/data/weapons.ts`) and `Game.fire`; don't special-case weapon ids in game logic.
- In dev builds, `window.__td.game` and `window.__td.sound` expose the live game and sound engine for console debugging (stripped from production builds).
- New gameplay moments that deserve a sound: add an id to `GameSound`, call `this.sound(id)` in `Game`, and add a recipe in `RECIPES` (`src/audio/Sound.ts`).
- Randomness (crits, later stun chance) goes through an injected `Rng` so tests can use `seededRng`.

## Testing

- Unit-test the damage formula, the element weakness multipliers, and the stacking and duration rules of every status effect. These are the easiest parts to get subtly wrong.
- Balance check: every enemy type must be killable by at least one cheap tower combination.
- `tests/game.test.ts` has a headless balance sim. A bot buys towers in a fixed plan order, each on the tile that covers the most of the routes it can hit; if a planned combo is locked it takes the same weapon in the first open element. With `upgrades` on, once it reaches its tower cap it spends leftover gold upgrading its lowest-level towers. It always upgrades instead of building once no free tile covers at least ~4 tiles of route (`MIN_USEFUL_COVERAGE`), like a player whose map is full. Unit tests use the level with lockdown off so they can build any combo. Checks: a mixed plan wins Neon District on 10 seeds with lockdown on; ground-only (Cannon + Mortar) loses; 3 towers lose. Re-run after changing any number in `src/data/`.
- Balance checks also require every single-element build (the same weapon plan, all on one element) to win. The mixed plan now uses a different element per job (Earth Cannon, Water Multi-Shot, Fire Mortar, Metal Flak, Metal Cannon, Wood Chain, Water Flak, Metal Sniper).
- Balance checks: Neon District (15 waves, no lockdown): the mixed plan wins on 10 seeds; a mixed 10-tower build that upgrades wins (easy first map); a mixed 16-tower build that upgrades gets past wave 15; every single-element build survives through wave 8; ground-only loses; 3 towers lose. Maps 2–4: the mixed plan wins on 3 seeds each. Simulations are deterministic per seed.
- Tuning as of 2026-10-08 (70% lockdown, hpScale per map): the full-map bot wins every probe game on every map, mostly with 15–20 lives on maps 1–4 (Chrome Canyon 8–20, Spire 19–25); hero maps are listed under Heroes. The numbers below are from the earlier 30% tuning, before hpScale.
- Earlier tuning (lives left out of 20, everything on): the mixed plan spending all gold (builds most of the map, then upgrades) wins all 30 waves on 10/10 seeds with 8–18 lives. Waves 29 (titans II) and 30 (grand finale) are the hardest: with 20% more HP on waves 26–30 the same bot loses 2 of 10. Capped builds that upgrade fall in the late game (16 towers around waves 19–23). Waves 1–15 are unchanged from the 15-wave tuning.
- Other maps (mixed plan spending all gold, 10 seeds): Harbor Grid wins 10/10 with 7–20 of 20 lives; Chrome Canyon 10/10 with 7–13 of 20; Orbital Spire 10/10 with 2–24 of 25. Spire's finale is very sensitive to its growth: ×1.052 leaves 3–7 lives, ×1.056 loses. Blackout Sector and Core Nexus are hero maps now (numbers under Heroes). On Core Nexus the bot has every possible tower at max level by about wave 28 (38 towers) and can't spend its gold, so the obstacles are what limit it. Growth is a cliff there: ×1.08 loses 9 of 30 hero games, ×1.079 none.

## Open Questions (edit me)

- ~~Mobile/touch support in v1?~~ Done: touch input, phone layout, iOS app (see iOS App and Touch).
- Android app (Capacitor supports it with the same setup)?

## Current State (as of 2026-10-08)

The first playable is built and verified in a browser. Summary of what exists:

**Gameplay**
- Seven maps (see Maps), each 20×12 tiles with its own road shape, wave count, and new enemy types. Map select with unlock progression.
- Start: 150 gold, 20 lives.
- Six enemies: Grunt, Runner, Brute, Swarm (ground) and Drone, Wyvern (air). See Enemies.
- Lockdown: each wave 70% of tower combos are locked at random, for building and upgrading (see Lockdown).
- Battlefield: each wave is on a random battlefield that boosts one element +5% and weakens another −5% (see Battlefields). Enemies have elements (see Element interactions).
- 30 towers: any of the 6 weapons with any of the 5 elements, each with its own name (e.g. Inferno Mortar, Frost Flak, Thornweb, Quake Cannon, Railgun; full list in `src/data/towers.ts`). See Elements and Weapon Types.
- 30 waves, each with its own twist: 1 basics, 2 runners, 3 swarms, 4 first drones, 5 brutes, 6 fast mix, 7 wyverns, 8 everything at once, 9 air raid, 10 armored column, 11 swarm storm, 12 elemental mix (grunts of all five elements), 13 sky fortress, 14 juggernauts, 15 onslaught, 16 night shift, 17 iron curtain, 18 hive, 19 storm front, 20 titans (a few enormous brutes and wyverns), 21 blitz, 22 elemental chaos (every type in an unusual element), 23 air supremacy, 24 siege, 25 last stand, 26 overclock (fast enemies in four elements), 27 fortress (24 brutes, 10 wyverns), 28 swarm singularity (150 swarm units in all five elements), 29 titans II, 30 grand finale (the whole army). Waves 16–25 have many more enemies, so their HP multipliers restart lower (about ×3) and climb ~10% per wave (titans up to ×7). Waves 26–30 are bigger still, so their HP multipliers restart at about ×3.8 and keep climbing ~10% per wave (titans up to ×13). Waves 9+ use group element overrides so no single tower element covers them. Clearing a wave gives bonus gold. Kill gold is halved in waves 9–15, ×0.4 in 16–25, and ×0.35 in 26–30 (`rewardMult` on `WaveDef`) so gold doesn't snowball.
- Build or sell at any time, including during a wave. Selling refunds 70%.
- Win when all waves are cleared; lose at 0 lives. An overlay offers "Play again".

**Controls**
- Pick an element with the 5 buttons above the cards (or `Q` `W` `E` `R` `T` = Fire, Water, Wood, Earth, Metal), then a weapon card (or `1`–`6`), then an empty pad. The cards redraw in the chosen element's colors and names, and the effect is described under the picker. Default element: Fire. Shift-click keeps building. Right-click or `Esc` cancels.
- **Tower info panel** (right of the sidebar): shows the hovered weapon card, else the card picked for building, else the tower selected on the map. It shows name, element and weapon, cost or level/spent, level pips, stats (damage, damage/s, fire rate, range, targets, attack details, crit/pierce, effect power), the element's role and effect with numbers at that level, and the weapon's strength and weakness. For a placed tower, each stat also shows its next-level value (green). Upgrade (`U`), Target priority, and Sell (`S`) sit in a highlighted box right under the tower's name, so they're visible without scrolling; when an upgrade (or a card) is unaffordable the box says how much gold is missing, and for locked combos it shows the encrypted note.
- **Heroes (Zero Point, Blackout Sector, Core Nexus):** pick one of five on the hero select screen; right-click to move; `Z` `X` `C` `V` abilities (aimed ones then need a click); `H` selects the hero. See Heroes.
- **End screen stats:** after a map (win or loss), a breakdown of kills (towers / hero / burn & poison, with %), damage landed by weapon, and combos set off. Stats live in `Game.stats` and count only damage that actually landed (no overkill).
- **Map select** opens on load and from the **Maps** button in the top bar. The Daily Challenge card sits on top. Locked maps say which map unlocks them. Cards show a road preview, wave count, description, the enemy roster with NEW and BOSS tags, and Play, or Continue / New run when a run is saved.
- **Restart** (↻ in the top bar) replays the current map from wave 1; it asks for confirmation if a wave has been started. The end screen has **Next map** (after a win), **Reboot** (replay), and **Maps**.
- `Space` (or a Ready button) starts the next wave, `P` pauses, `M` mutes, and the sidebar has 1×/2×/3× speed. Between waves a 30s countdown starts the next wave by itself (see Get-ready countdown).

**Visuals** (cyberpunk; full description under Art Style)
- Vector art drawn in code: a night city grid, a neon road, a portal, and a data core. Dark armored towers with neon element trim, weapon-shaped barrels that turn and kick back. Robot enemies with glowing visors; Drones have spinning rotors.
- Shots take the element's look (fireball, ice shard, seed, angular rock, white bullet) with glowing tracers; Sniper tracers are long and thin. Mortar shells arc with a shadow and a dashed landing ring, then explode in the element's color. Chain draws jagged arcs in the element's color.
- Enemies show their status: cyan tint (chilled), ice block (frozen), flickering flames (burning), rising green bubbles, one per stack (poisoned), neon vines (rooted), circling stars (stunned), amber cracks (armor broken). Floating text: "CRIT!", "FREEZE!", gold, and lost lives.
- While placing a tower, the range preview is cyan-green (allowed) or red (blocked).

**Code foundations already in place for later features**
- The damage formula and Five Elements weakness multipliers are in `src/systems/damage.ts`.
- Targeting filters by ground/air. `Enemy.speed` already includes slows and stops, so the Mortar leads chilled enemies correctly.
- The game runs at a fixed 60 Hz step, so game speed doesn't change outcomes. Randomness is injectable for deterministic tests.

**Tests** (219, all passing; ~140s, of which most is every hero map played with all ten heroes; mostly full-map balance sims): deterministic rules (no engine-dependent math in rules files) and online lockstep (command validation, host and clients identical over a laggy network, drift repaired by resync, the clock dropping out mid-wave with the next player taking over and the old clock rejoining in sync), multiplayer (MemberId format and randomness; players with their own gold and heroes; build/upgrade/sell by owner only; kill gold to the killer and burn/poison kills to the last hitter, wave bonus to everyone; per-player hero moves and casts; five-element +10% only with all five; party save/resume; Surger speeds others; Map 8 is the 8th map, multiplayer, never the daily; every hero alone loses Map 8, every pair wins, a five-element party wins with 15+ lives), map score (speed points formula, fast vs slow clears, leaks cost points and earn no speed, floor at 0, save/resume), element combos (each of the five, Steam splash, Wildfire spread), stats without overkill, heroes (ten complete profiles, each roster covering all five elements, weakness-cycle damage, second roster locked until Core Nexus, each passive: Execution finishes weakened enemies but not bosses, Undertow slows only nearby enemies, Field Engineer and Power Surge boost tower damage, Core Patch restores lives up to the start, Overgrowth roots and poisons, Bounty pays +30%, chosen hero on the map, walking speed, attacks skip Mirrors, melee cleave, magic chain, leveling and unlocks, Jammer pausing cooldowns, each hero's signature abilities), every hero map (maps 3–7) won with every hero (1 seed each), new abilities (shield absorbs and blocks effects, medic heals in range, splitter releases shards, ghost hidden/revealed and splash-able, phaser blinks but not while stunned, carrier launches drones, disruptor knocks towers offline and waits for one in reach, prism cycles elements, burrower immune and untargetable while under and can't dig while stunned, warden armor aura), translations (every key present in Spanish, Chinese, and Vietnamese with matching placeholders, no stale keys), bosses (one per map in the final wave, phases start once at their thresholds, several after one big hit, escorts, cleanse keeps armor break, new shields, element shifts, arrival sound), save and resume (nothing to save before wave 1 or mid-wave; towers, gold, lives, conditions, stats, and the hero survive a JSON round trip), Daily Challenge (same per UTC day, different between days, conditions fixed by the seed whatever the combat rng, score), obstacles (block building; in bounds and off the road on every map), every map from Chrome Canyon on has a hero, random on maps 3–5 and chosen after (and none before), Zero Point locked until Orbital Spire is cleared, maps (15–40 waves, valid roads, new enemies per map), unlock progress, per-map balance, wave rewardMult, sound events (queued for build/upgrade/sell and a whole wave, countdown ticks, queue cap), get-ready countdown (none before wave 1, 30s after a clear, auto-start at 0, Ready skips it, off with prepTime 0 and after the last wave), enemy elements (defaults, group overrides, weakness ±), battlefields (re-rolled each wave without repeats, ±5% for towers and enemies), lockdown (70% locked, exact share at any fraction, minimums per weapon and element, deterministic per seed, re-rolled after a wave, locked combos can't be built, built towers keep firing but can't upgrade while locked), map hpScale, easy first map (16 towers win Neon District; no lockdown there, 70% on every later map), upgrades (cost, stats, max level, refund, stronger effects, slow cap), damage formula, weakness cycle, path math, targeting priorities, multi-target and chain selection, each weapon's behavior, flyers and anti-air, every status effect's stacking/refresh/immunity rules, burn kills paying gold, freeze stopping movement, armor break raising damage, build/sell economy, wave flow, lives/game over, and the headless balance simulation.

**Known gaps:** no endless mode, no music (sound effects only), no level-3 upgrade branches, saves only between waves, iOS app not yet signed or on the App Store. The folder is a git repository (branch `main`) but has no commits or remote yet.

## Roadmap

Done:
- Game design outline (this file).
- Tech stack picked and project set up (TypeScript + Vite + Canvas + Vitest).
- First playable: 20×12 map, Grunt enemy, Steel Cannon (Metal + Cannon), build/sell, targeting priority, speed controls, win/lose overlay.
- All six weapon types (Cannon, Flak, Multi-Shot, Mortar, Chain, Sniper), five more enemies (Runner, Brute, Swarm, Bat→Drone, Wyvern), air routes, 8 waves, next-wave preview.
- All five elements with the shared status-effect system (Burn, Chill/Freeze, Root/Poison, Stun/Armor Break), 30 buildable towers, element picker, element and status visuals.
- Cyberpunk reskin: neon city map, robot enemies, neon towers and UI, level renamed Neon District.
- Tower info panel (right of the sidebar) and 3-level tower upgrades with level-scaled effects and upgrade visuals.
- Lockdown: ~30% of tower combos randomly locked each wave (raised to 70% later, and locks block upgrades too).
- Enemy elements (weakness cycle active) and random battlefields each wave (±5%).
- 30s get-ready countdown between waves with a Ready button.
- Synthesized sound effects with a mute toggle (icon and `M`).
- 15 waves (was 8), cheaper/stronger upgrades, half kill gold in waves 9–15, balance bot that upgrades.
- 25 waves (waves 16–25 added, kill gold ×0.4 there).
- 30 waves (waves 26–30 added, kill gold ×0.35 there); balance bot upgrades once its map is full.
- Map 5 Zero Point (30 waves) with a hero (4 level-unlocked abilities, cooldowns only, levels from nearby kills) and two new enemies (Jammer, Mirror).
- Five playable heroes with profiles (Vex, Brick, Leila, Arjun, Echo), hero select screen, data-driven ability effects, per-hero art, icons, and colors.
- Language picker: English, Spanish, Chinese, Vietnamese, with a test that every string is translated.
- Second hero roster unlocked by clearing Core Nexus, each with a passive: Ronin (Execution), Tide (Undertow), Forge (Field Engineer, Power Surge, Core Patch), Rua (Overgrowth), Flare (Bounty).
- Hero elements: each hero has one element; hero damage follows the weakness cycle and battlefields like towers.
- Element combos (Steam, Wildfire, Shatter, Corrosion, Rupture); kill/damage stats with an end-screen breakdown; hero and tower rebalance measured with those stats.
- Three new maps (Harbor Grid 20 waves, Chrome Canyon 25, Orbital Spire 40) with six new enemy types (Shielder, Medic, Splitter/Shard, Ghost, Phaser, Carrier), map select with unlock progression, Restart button, Next map / Maps on the end screen.
- Maps 6 Blackout Sector (30 waves) and 7 Core Nexus (35 waves), harder, with obstacles that block building and four new enemies (Disruptor, Prism, Burrower, Warden). Both are hero maps (hero select, Jammers and Mirrors mixed in, retuned).

- Bosses (Siege Colossus, Bulwark, Chimera, Sky Leviathan) with HP phases in every map's final wave; save and resume between waves; Daily Challenge with a shareable score.
- 70% lockdown that also blocks upgrades, element badges showing available towers, weapon rebalance (Chain/Mortar down, Multi-Shot/Sniper up) from a fixed benchmark, hero pass (Leila and Brick up, Arjun's Firewall down), per-map `hpScale` with easy first two maps.

- Map score (waves, clear speed, lives) shown on the map, best score per map, used by the Daily Challenge too.
- Online multiplayer rooms on Firebase: lobby with room codes, lockstep sync with wave-end checkpoints and resync, rejoin, deterministic rules (verified identical in V8 and JavaScriptCore).
- Multiplayer part 1: MemberId, party engine (2–5 players, own gold and heroes, five-element +10%), Map 8 Overlink with the Surger (balanced so one hero loses and two win), Single/Multiplayer modes, party hero select, party bar, local play on one device.
- Logo (`public/`), touch input (tap to preview / tap again to confirm, long press = right-click, tool bar with Cancel), a phone-landscape layout, bundled fonts, and an iOS app with Capacitor (landscape, app icon, launch screen, saves mirrored to app preferences).

Not started:
- Level-3 upgrade branches.
- Endless mode.

## Notes for Claude Code

- **Keep this file in sync with every change.** When a feature is built or a design decision is made, update the relevant section in the same turn (move items to Done, replace `TBD` with the decision).
- Ask before adding npm dependencies beyond the chosen tech stack.
- Treat the numbers in this file as starting values for tuning, not fixed requirements.
