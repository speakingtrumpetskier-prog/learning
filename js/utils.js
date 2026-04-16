// Math, easing, geometry helpers.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const mix = lerp;

export function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
export function randInt(lo, hi) { return Math.floor(randRange(lo, hi + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}
export function dist(a, b) { return Math.sqrt(dist2(a, b)); }

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function approach(current, target, delta) {
  if (current < target) return Math.min(current + delta, target);
  if (current > target) return Math.max(current - delta, target);
  return current;
}

// Seeded RNG (mulberry32) so level layouts stay stable per seed.
export function seedRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ease curves.
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
export const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Color helpers.
export function rgba(r, g, b, a = 1) {
  return `rgba(${r|0},${g|0},${b|0},${a})`;
}

export function hslMix(h1, h2, t) {
  // cheap HSL interpolation, h1/h2 in degrees
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return (h1 + dh * t + 360) % 360;
}

// Segment queries.
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function rectNearestPoint(px, py, r) {
  return {
    x: clamp(px, r.x, r.x + r.w),
    y: clamp(py, r.y, r.y + r.h),
  };
}

// Note/frequency helpers.
export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// Mode scales (semitone offsets from root).
export const MODES = {
  ionian:     [0, 2, 4, 5, 7, 9, 11],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
  // A custom "chorus" mode for the finale: open + dissonant + resolved
  chorus:     [0, 2, 5, 7, 9, 11, 14],
};

export function scaleNote(root, mode, degree) {
  const scale = MODES[mode];
  const octave = Math.floor(degree / scale.length);
  const step = ((degree % scale.length) + scale.length) % scale.length;
  return root + octave * 12 + scale[step];
}
