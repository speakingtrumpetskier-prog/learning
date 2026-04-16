// Procedural audio engine — modal, adaptive. Each level has:
//   root (midi), mode, tempo, layers (ambient pad, arp, bass, perc).
// Layers raise/fade by "intensity" and "danger" signals from gameplay.
//
// No samples used — everything synthesized via Web Audio nodes.

import { midiToFreq, scaleNote, clamp, TAU } from "./utils.js";

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = {};
    this.reverb = null;
    this.ready = false;
    this.scene = null;      // current scene config
    this.intensity = 0;     // 0..1, brightens mix
    this.danger = 0;        // 0..1, adds tension
    this.muted = false;
    this._schedHandle = null;
    this._startTime = 0;
    this._lastBeat = -1;
    this._padVoices = [];
    this._arpIndex = 0;
  }

  async init() {
    if (this.ready) return;
    // Safari prefixes, etc.
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    // --- Reverb (synthetic impulse) ---
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(3.4, 3.2);
    const revGain = this.ctx.createGain();
    revGain.gain.value = 0.45;
    this.reverb.connect(revGain).connect(this.master);

    // --- Delay ---
    const delay = this.ctx.createDelay(2);
    delay.delayTime.value = 0.38;
    const delayFb = this.ctx.createGain();
    delayFb.gain.value = 0.42;
    const delayOut = this.ctx.createGain();
    delayOut.gain.value = 0.28;
    delay.connect(delayFb).connect(delay);
    delay.connect(delayOut).connect(this.master);
    delay.connect(this.reverb);
    this.delay = delay;

    // --- Buses ---
    const mkBus = (gain = 1) => {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      g.connect(this.master);
      g.connect(this.reverb);
      g.connect(delay);
      return g;
    };
    this.bus.pad = mkBus(0.5);
    this.bus.arp = mkBus(0.45);
    this.bus.bass = mkBus(0.55);
    this.bus.perc = mkBus(0.35);
    this.bus.sfx = mkBus(0.9);
    this.ready = true;
  }

  async resume() {
    if (!this.ready) await this.init();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  suspend() { if (this.ctx && this.ctx.state === "running") this.ctx.suspend(); }

  setMuted(m) {
    this.muted = m;
    if (!this.master) return;
    this.master.gain.linearRampToValueAtTime(m ? 0 : 0.7, this.ctx.currentTime + 0.25);
  }

  // --- Scene (music) ---
  setScene(scene) {
    this.scene = scene;
    this._startTime = this.ctx?.currentTime ?? 0;
    this._lastBeat = -1;
    this._arpIndex = 0;
    // Kick off held pad voices.
    this._stopPad();
    if (scene) this._startPad();
  }

  clearScene() {
    this.scene = null;
    this._stopPad();
  }

  setIntensity(v) { this.intensity = clamp(v, 0, 1); }
  setDanger(v)    { this.danger = clamp(v, 0, 1); }

  // --- Scheduler: call each frame ---
  tick() {
    if (!this.ready || !this.scene || this.muted) return;
    const s = this.scene;
    const t = this.ctx.currentTime - this._startTime;
    const bps = s.tempo / 60;
    const beat = Math.floor(t * bps);

    if (beat !== this._lastBeat) {
      this._lastBeat = beat;
      this._onBeat(beat);
    }

    // Adjust bus mix based on intensity/danger.
    const now = this.ctx.currentTime;
    this.bus.pad.gain.setTargetAtTime(0.35 + 0.15 * this.intensity, now, 0.8);
    this.bus.arp.gain.setTargetAtTime(0.15 + 0.45 * this.intensity, now, 0.6);
    this.bus.bass.gain.setTargetAtTime(0.35 + 0.3 * this.danger, now, 0.9);
    this.bus.perc.gain.setTargetAtTime(0.15 + 0.45 * this.danger, now, 0.4);
  }

  _onBeat(beat) {
    const s = this.scene;
    if (!s) return;
    const now = this.ctx.currentTime + 0.02;
    const beatInBar = ((beat % s.bar) + s.bar) % s.bar;

    // --- Bass: downbeat pulse ---
    if (beatInBar === 0 || (s.bassDouble && beatInBar === s.bar / 2)) {
      const degree = s.bassPattern[Math.floor(beat / s.bar) % s.bassPattern.length] ?? 0;
      const midi = scaleNote(s.root - 24, s.mode, degree);
      this._playBass(midiToFreq(midi), now, 0.9);
    }

    // --- Arp: spread across beats ---
    if (s.arpPattern && s.arpPattern.length) {
      const step = s.arpPattern[beat % s.arpPattern.length];
      if (step !== null && step !== undefined) {
        const midi = scaleNote(s.root, s.mode, step);
        this._playArp(midiToFreq(midi), now, 0.45 + 0.3 * this.intensity);
      }
    }

    // --- Perc: depth/danger driven ---
    if (this.danger > 0.1) {
      if (beat % 2 === 0) this._playPerc("kick", now);
      if ((beat + 1) % 4 === 0) this._playPerc("tick", now);
      if (this.danger > 0.5 && beat % 3 === 0) this._playPerc("shake", now);
    }
  }

  // --- Held pad (sustained chord voices) ---
  _startPad() {
    if (!this.scene) return;
    const s = this.scene;
    const now = this.ctx.currentTime;
    const chordDegrees = s.chord ?? [0, 2, 4, 6];
    for (const deg of chordDegrees) {
      const midi = scaleNote(s.root, s.mode, deg);
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "triangle";
      const f = midiToFreq(midi);
      osc1.frequency.value = f;
      osc2.frequency.value = f * 1.003; // slight detune

      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.04, now + 4);

      // LFO on amp for slow shimmer
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.1 + Math.random() * 0.15;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain).connect(g.gain);

      // Lowpass for warmth
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 900 + Math.random() * 400;
      filt.Q.value = 0.7;

      osc1.connect(filt);
      osc2.connect(filt);
      filt.connect(g);
      g.connect(this.bus.pad);

      osc1.start(now); osc2.start(now); lfo.start(now);
      this._padVoices.push({ osc1, osc2, lfo, g, filt });
    }
  }

  _stopPad() {
    const now = this.ctx?.currentTime ?? 0;
    for (const v of this._padVoices) {
      try {
        v.g.gain.cancelScheduledValues(now);
        v.g.gain.linearRampToValueAtTime(0, now + 1.5);
        v.osc1.stop(now + 1.6);
        v.osc2.stop(now + 1.6);
        v.lfo.stop(now + 1.6);
      } catch {}
    }
    this._padVoices = [];
  }

  // --- Voices ---
  _playBass(freq, when, vel = 0.9) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o.type = "sine"; o2.type = "triangle";
    o.frequency.value = freq; o2.frequency.value = freq * 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.45 * vel, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + 1.8);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    o.connect(f); o2.connect(f);
    f.connect(g).connect(this.bus.bass);
    o.start(when); o2.start(when);
    o.stop(when + 2); o2.stop(when + 2);
  }

  _playArp(freq, when, vel = 0.5) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.18 * vel, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, when + 1.3);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq * 2;
    f.Q.value = 4;
    o.connect(f).connect(g).connect(this.bus.arp);
    o.start(when); o.stop(when + 1.5);
  }

  _playPerc(kind, when) {
    const ctx = this.ctx;
    if (kind === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, when);
      o.frequency.exponentialRampToValueAtTime(40, when + 0.15);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.5, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
      o.connect(g).connect(this.bus.perc);
      o.start(when); o.stop(when + 0.4);
    } else if (kind === "tick") {
      const noise = this._noiseBuffer(0.12);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 3000;
      src.connect(f).connect(g).connect(this.bus.perc);
      src.start(when);
    } else if (kind === "shake") {
      const noise = this._noiseBuffer(0.2);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 5000;
      src.connect(f).connect(g).connect(this.bus.perc);
      src.start(when);
    }
  }

  // --- SFX: pulses, collect, harm, bloom ---
  sfxPulse(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const root = this.scene ? this.scene.root : 55;
    const mode = this.scene ? this.scene.mode : "dorian";

    // 2-voice chord up a fifth, bell-ish
    const notes = [
      midiToFreq(scaleNote(root, mode, 0)),
      midiToFreq(scaleNote(root, mode, 4)),
    ];
    for (let i = 0; i < notes.length; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = notes[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.28 * strength * (i === 0 ? 1 : 0.6), now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = notes[i] * 2;
      f.Q.value = 6;
      o.connect(f).connect(g).connect(this.bus.sfx);
      o.start(now); o.stop(now + 1.8);
    }
  }

  sfxCollect() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const root = this.scene ? this.scene.root : 60;
    const mode = this.scene ? this.scene.mode : "ionian";
    const seq = [0, 2, 4];
    for (let i = 0; i < seq.length; i++) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiToFreq(scaleNote(root + 12, mode, seq[i]));
      const g = ctx.createGain();
      const t = now + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(this.bus.sfx);
      o.start(t); o.stop(t + 0.7);
    }
  }

  sfxHarm() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(200, now);
    o.frequency.exponentialRampToValueAtTime(60, now + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.35, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 600;
    o.connect(f).connect(g).connect(this.bus.sfx);
    o.start(now); o.stop(now + 1.3);
  }

  sfxJump() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const root = this.scene ? this.scene.root : 60;
    const mode = this.scene ? this.scene.mode : "dorian";
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = midiToFreq(scaleNote(root + 12, mode, 2));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o.connect(g).connect(this.bus.sfx);
    o.start(now); o.stop(now + 0.4);
  }

  sfxBloom(pitchOffset = 0) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const root = this.scene ? this.scene.root : 60;
    const mode = this.scene ? this.scene.mode : "ionian";
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = midiToFreq(scaleNote(root + 12, mode, 0) + pitchOffset);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = midiToFreq(scaleNote(root + 19, mode, 0) + pitchOffset);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.12);
    o.connect(g); o2.connect(g);
    g.connect(this.bus.sfx);
    o.start(now); o2.start(now);
    return { stop: () => {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(0, t + 0.18);
      o.stop(t + 0.2); o2.stop(t + 0.2);
    }};
  }

  sfxWhisper() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1200; f.Q.value = 4;
    src.connect(f).connect(g).connect(this.bus.sfx);
    src.start(now);
  }

  // --- Helpers ---
  _noiseBuffer(sec = 0.2) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const imp = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return imp;
  }
}

export const audio = new Audio();
