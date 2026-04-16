// Level definitions. Each: scene (audio), palette, solids (geometry),
// entities (world), and abilities granted.

import { Fragment, Resonator, Gate, Current, Lurker, Drifter, Spike, Goal, ChorusBoss } from "./entities.js";

// Tile helper: a rect solid.
const R = (x, y, w, h) => ({ x, y, w, h });

// Palette format: background (top, bottom), surface tint, wave color.
const PALETTES = {
  shallow: {
    bg0: "#061d28",
    bg1: "#010508",
    surface: "rgba(118, 226, 255, 1)",
    wave:    "rgba(176, 240, 255, 1)",
    accent:  "rgba(255, 244, 220, 1)",
  },
  kelp: {
    bg0: "#07220f",
    bg1: "#01080a",
    surface: "rgba(147, 214, 148, 1)",
    wave:    "rgba(205, 244, 185, 1)",
    accent:  "rgba(255, 220, 158, 1)",
  },
  reef: {
    bg0: "#22103a",
    bg1: "#04010d",
    surface: "rgba(214, 147, 255, 1)",
    wave:    "rgba(240, 186, 255, 1)",
    accent:  "rgba(255, 172, 208, 1)",
  },
  trench: {
    bg0: "#2a0910",
    bg1: "#050104",
    surface: "rgba(255, 143, 110, 1)",
    wave:    "rgba(255, 186, 138, 1)",
    accent:  "rgba(255, 118, 98, 1)",
  },
  abyss: {
    bg0: "#060012",
    bg1: "#000000",
    surface: "rgba(180, 150, 255, 1)",
    wave:    "rgba(220, 200, 255, 1)",
    accent:  "rgba(255, 220, 200, 1)",
  },
};

// ========================================================================
// LEVEL 1 — SHALLOWS (Ionian). Tutorial. Few enemies. Pulse + movement.
// ========================================================================
function buildShallows() {
  const bounds = { x: -200, y: -400, w: 2800, h: 1200 };
  const solids = [
    // Floor
    R(-200, 600, 1200, 80),
    R(1120, 560, 500, 40),
    R(1700, 520, 400, 40),
    R(2160, 480, 500, 200),
    // Ceiling/platforms
    R(300, 340, 120, 20),
    R(540, 280, 120, 20),
    R(780, 240, 140, 20),
    R(1000, 340, 100, 20),
    R(1800, 360, 80, 20),
    R(2000, 300, 80, 20),
    // left wall
    R(-200, -400, 40, 1200),
    R(2600, -400, 60, 1200),
  ];
  const entities = [
    new Fragment(560, 250, "a current of light, remembered."),
    new Fragment(1150, 520, "i was deeper once."),
    new Fragment(2050, 270, "the surface is only a rumor."),
    new Goal(2420, 420),
    new Drifter(400, 500), new Drifter(700, 400), new Drifter(1200, 300),
    new Drifter(1600, 500), new Drifter(2000, 440),
  ];
  return {
    title: "Shallows",
    modeName: "Ionian · C",
    whisper: "listen for the shape of what you cannot see",
    depth: 12,
    bounds, solids, entities,
    spawn: { x: 40, y: 550 },
    palette: PALETTES.shallow,
    abilities: [],
    requireFragments: false,
    ambient: 0.08,
    scene: {
      root: 60, mode: "ionian", tempo: 62, bar: 4,
      chord: [0, 2, 4, 6],
      bassPattern: [0, 4, 2, 5], bassDouble: false,
      arpPattern: [null, 4, null, 2, 6, null, 4, null],
    },
  };
}

// ========================================================================
// LEVEL 2 — KELP FOREST (Dorian). Currents, first resonator puzzles.
// ========================================================================
function buildKelp() {
  const bounds = { x: -200, y: -600, w: 3200, h: 1400 };
  const solids = [
    R(-200, 620, 600, 100),
    R(500, 520, 260, 20),
    R(880, 600, 360, 20),
    R(1340, 460, 200, 20),
    R(1620, 380, 180, 20),
    R(1880, 560, 240, 20),
    R(2240, 440, 260, 20),
    R(2580, 560, 420, 140),
    // decorative/walls
    R(-200, -600, 40, 1400),
    R(3000, -600, 60, 1400),
    // ceiling bits
    R(700, 200, 100, 20),
    R(1200, 120, 180, 20),
    R(1700, 100, 220, 20),
    R(2200, 180, 120, 20),
    // mid-wall
    R(2100, 620, 40, 80),
  ];
  const entities = [
    // Currents that push upward through gap
    new Current(1500, 300, 140, 420, 0, -120),
    new Current(2050, 300, 100, 320, 0, -90),
    // Drifters = ambience
    new Drifter(300, 500), new Drifter(900, 400), new Drifter(1400, 300),
    new Drifter(1900, 400), new Drifter(2500, 300),
    // Resonator + gate
    new Resonator(1680, 320),
    new Gate(2080, 520, 20, 100, "default"),
    // Fragments
    new Fragment(600, 480, "the kelp remembers rhythm even when the tide forgets."),
    new Fragment(1420, 420, "to sing is to measure the distance."),
    new Fragment(2280, 400, "you were a voice before you were a shape."),
    // One slow lurker
    new Lurker(1100, 520),
    new Goal(2800, 500),
  ];
  return {
    title: "Kelp Forest",
    modeName: "Dorian · D",
    whisper: "hold your breath in the currents. hum into the stone.",
    depth: 48,
    bounds, solids, entities,
    spawn: { x: 40, y: 560 },
    palette: PALETTES.kelp,
    swim: true,
    abilities: ["bloom"],
    requireFragments: false,
    ambient: 0.05,
    scene: {
      root: 62, mode: "dorian", tempo: 70, bar: 4,
      chord: [0, 2, 4],
      bassPattern: [0, 3, 1, 4],
      arpPattern: [0, null, 4, 2, null, 5, null, 3],
    },
  };
}

// ========================================================================
// LEVEL 3 — REEF (Lydian). Stealth matters. Lurkers. Stillness ability.
// ========================================================================
function buildReef() {
  const bounds = { x: -200, y: -600, w: 3400, h: 1400 };
  const solids = [
    R(-200, 620, 700, 100),
    R(600, 540, 320, 20),
    R(1000, 460, 200, 20),
    R(1260, 380, 200, 20),
    R(1520, 460, 180, 20),
    R(1740, 540, 200, 20),
    R(2000, 460, 200, 20),
    R(2280, 380, 240, 20),
    R(2600, 480, 240, 20),
    R(2900, 580, 400, 140),
    R(-200, -600, 40, 1400),
    R(3200, -600, 60, 1400),
    // Pillars to hide behind
    R(1100, 480, 40, 80),
    R(1400, 220, 40, 160),
    R(1780, 340, 40, 200),
    R(2320, 200, 40, 180),
    R(2680, 320, 40, 160),
  ];
  const entities = [
    // Ambient drifters
    new Drifter(300, 500), new Drifter(900, 400), new Drifter(1400, 300),
    new Drifter(1900, 400), new Drifter(2500, 300), new Drifter(3000, 400),
    // Lurkers (hear pulses, hunt)
    new Lurker(1100, 440),
    new Lurker(1800, 460),
    new Lurker(2450, 440),
    // Spikes
    new Spike(960, 620, 40), new Spike(1700, 620, 60), new Spike(2550, 620, 80),
    // Fragments
    new Fragment(840, 500, "the reef holds the loudest silence."),
    new Fragment(1420, 340, "to be still is to be a stone. stones are not eaten."),
    new Fragment(2370, 340, "the mouth wants the shape of a word."),
    // Goal
    new Goal(3100, 520),
  ];
  return {
    title: "Reef",
    modeName: "Lydian · E",
    whisper: "do not wake them. learn to be unheard.",
    depth: 142,
    bounds, solids, entities,
    spawn: { x: 40, y: 560 },
    palette: PALETTES.reef,
    abilities: ["stillness"],
    requireFragments: false,
    ambient: 0.03,
    scene: {
      root: 64, mode: "lydian", tempo: 78, bar: 4,
      chord: [0, 2, 4, 6],
      bassPattern: [0, 4, 3, 6],
      arpPattern: [6, null, 2, 4, null, 5, 3, null],
    },
  };
}

// ========================================================================
// LEVEL 4 — TRENCH (Phrygian). Pulse itself becomes a tension. Heavy lurkers.
// ========================================================================
function buildTrench() {
  const bounds = { x: -200, y: -800, w: 3600, h: 2000 };
  const solids = [
    R(-200, 620, 500, 100),
    R(400, 540, 180, 20),
    R(640, 460, 180, 20),
    R(880, 380, 180, 20),
    R(1120, 300, 180, 20),
    R(1360, 220, 180, 20),
    R(1600, 140, 180, 20),
    R(1840, 80, 180, 20),
    R(2080, 140, 180, 20),
    R(2320, 220, 180, 20),
    R(2560, 300, 180, 20),
    R(2800, 400, 220, 20),
    R(3080, 520, 220, 140),
    R(-200, -800, 40, 2000),
    R(3300, -800, 60, 2000),
    // hazard row
    R(700, 620, 60, 100),
    R(1000, 620, 60, 100),
    R(1300, 620, 60, 100),
  ];
  const entities = [
    // Downward currents + upward gaps
    new Current(900, -200, 180, 820, 0, 60),
    new Current(1600, -600, 200, 820, 0, -90),
    new Current(2320, -300, 200, 620, 0, 70),
    // Lurkers — lots.
    new Lurker(700, 480), new Lurker(1200, 300), new Lurker(1700, 180),
    new Lurker(2150, 120), new Lurker(2600, 320), new Lurker(2900, 420),
    // Spikes
    new Spike(700, 720, 40), new Spike(1000, 720, 40), new Spike(1300, 720, 40),
    // Resonator + gate combo
    new Resonator(1840, 40),
    new Gate(2780, 320, 20, 100, "default"),
    // Fragments hidden behind current
    new Fragment(980, 340, "descent is not falling — it is letting go."),
    new Fragment(1700, 100, "the trench was a mouth once. it closed around a question."),
    new Fragment(2620, 260, "we called to each other. we answered with teeth."),
    new Fragment(2900, 380, "beneath this, a voice that does not know it is a voice."),
    new Drifter(500, 450), new Drifter(1500, 200), new Drifter(2400, 250),
    new Goal(3200, 480),
  ];
  return {
    title: "Trench",
    modeName: "Phrygian · F♯",
    whisper: "every sound is a door. some doors open the wrong way.",
    depth: 620,
    bounds, solids, entities,
    spawn: { x: 40, y: 560 },
    palette: PALETTES.trench,
    swim: true,
    abilities: [],
    requireFragments: false,
    ambient: 0.02,
    scene: {
      root: 54, mode: "phrygian", tempo: 84, bar: 4,
      chord: [0, 2, 4],
      bassPattern: [0, 1, 4, 2],
      arpPattern: [0, 4, 1, 2, 5, 1, 3, null],
    },
  };
}

// ========================================================================
// LEVEL 5 — ABYSS (Locrian → Chorus). Boss. The silent being.
// ========================================================================
function buildAbyss() {
  const bounds = { x: -200, y: -400, w: 2400, h: 1600 };
  // Boss in center. Platforms around it.
  const solids = [
    // Outer frame
    R(-200, 900, 2600, 200),
    R(-200, -400, 2600, 100),
    R(-200, -400, 40, 1400),
    R(2360, -400, 40, 1400),
    // Inner ring platforms
    R(200, 700, 200, 20),
    R(480, 620, 180, 20),
    R(740, 540, 180, 20),
    R(960, 460, 160, 20),
    R(1180, 460, 160, 20),
    R(1420, 540, 180, 20),
    R(1680, 620, 180, 20),
    R(1960, 700, 200, 20),
    // Top platforms for upper nodes
    R(500, 300, 160, 20),
    R(900, 200, 200, 20),
    R(1240, 200, 200, 20),
    R(1680, 300, 160, 20),
    // Side ladders
    R(180, 500, 40, 120),
    R(2140, 500, 40, 120),
  ];
  const boss = new ChorusBoss(1080, 480);
  const entities = [
    boss,
    new Fragment(600, 270, "the chorus is not a sound. it is an agreement."),
    new Fragment(1400, 160, "i was alone because i never answered."),
    new Fragment(1780, 270, "sing me and i will sing you."),
    new Drifter(400, 300), new Drifter(1800, 400), new Drifter(1100, 800),
    new Drifter(700, 750), new Drifter(1500, 750),
  ];
  return {
    title: "Abyss",
    modeName: "Chorus · G",
    whisper: "it is waiting. harmonize each of its voices.",
    depth: 4000,
    bounds, solids, entities,
    spawn: { x: 60, y: 850 },
    palette: PALETTES.abyss,
    swim: true,
    abilities: [],
    requireFragments: false,
    ambient: 0.03,
    bossGoal: { x: 1080, y: 480 },
    scene: {
      root: 55, mode: "chorus", tempo: 58, bar: 6,
      chord: [0, 2, 4, 6],
      bassPattern: [0, 4, 2, 6, 4, 2],
      arpPattern: [0, 4, null, 6, null, 2, 4, null, 7, 4, null, 5],
    },
  };
}

export const LEVELS = [
  buildShallows,
  buildKelp,
  buildReef,
  buildTrench,
  buildAbyss,
];

export const ENDING_LINES = [
  "you sang it back.",
  "for the first time since the surface,",
  "the dark was not empty.",
  "",
  "it was a chord.",
  "",
  "and you were one of its voices.",
];
