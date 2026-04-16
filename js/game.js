// Game — state machine, camera, level flow, narrative, save.

import { clamp, lerp, dist } from "./utils.js";
import { Input } from "./input.js";
import { Renderer } from "./render.js";
import { Particles } from "./particles.js";
import { Player } from "./player.js";
import { audio } from "./audio.js";
import { Level } from "./level.js";
import { LEVELS, ENDING_LINES } from "./levels.js";

const SAVE_KEY = "echo.save.v1";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.input = new Input(canvas);
    this.renderer = new Renderer(this.ctx);
    this.particles = new Particles(1200);
    this.player = new Player(0, 0);
    this.level = null;
    this.levelIndex = 0;
    this.camera = { x: 0, y: 0, tx: 0, ty: 0, ox: 0, oy: 0 };
    this.state = "menu"; // menu, playing, paused, dead, complete, ending
    this.time = 0;
    this.levelStartTime = 0;
    this.levelStats = { pulses: 0, fragments: 0, time: 0 };
    this.dangerOverlay = 0;
    this.whisperQueue = [];
    this.whisperTimer = 0;
    this.totalFragments = 0;
    this.savedLevel = this._loadSave();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    window.__echoGame = this; // so entities can reach us if needed
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  // ---------- Flow ----------
  async start(levelIndex = 0) {
    await audio.resume();
    this.levelIndex = levelIndex;
    this._loadLevel(levelIndex);
    this.state = "playing";
  }

  _loadLevel(i) {
    const def = LEVELS[i]();
    this.player = new Player(def.spawn.x, def.spawn.y);
    // Preserve abilities earned from earlier levels.
    for (let j = 0; j <= i; j++) {
      const prev = LEVELS[j]();
      for (const a of prev.abilities ?? []) this.player.unlock(a);
    }
    this.level = new Level(def, this.player, (w) => this.showWhisper(w));
    audio.setScene(def.scene);
    this.camera.x = def.spawn.x - window.innerWidth / 2;
    this.camera.y = def.spawn.y - window.innerHeight / 2;
    this.camera.tx = this.camera.x;
    this.camera.ty = this.camera.y;
    this.levelStartTime = this.time;
    this.levelStats = { pulses: 0, fragments: 0, time: 0 };
    this.totalFragments = this.level.entities.filter(e => e.kind === "fragment").length;
    this.dangerOverlay = 0;

    this._showLevelCard(def);
    setTimeout(() => this.showWhisper(def.whisper), 3200);

    // Cinematic opening pulse: one large silent sonar revealing the opening chamber.
    this.level.pulses.push({
      x: def.spawn.x, y: def.spawn.y,
      radius: 0, maxRadius: 720, speed: 520,
      life: 0, maxLife: 1.8, strength: 1.4, silent: true,
      source: "world",
    });
    audio.sfxPulse(0.4);
  }

  restartLevel() {
    this._loadLevel(this.levelIndex);
    this.state = "playing";
  }

  onLevelComplete() {
    this.state = "complete";
    this.levelStats.pulses = this.player.pulses;
    this.levelStats.fragments = this.player.collected;
    this.levelStats.time = this.time - this.levelStartTime;
    this._saveProgress(this.levelIndex + 1);
    if (this.onUiComplete) this.onUiComplete(this.level.def, this.levelStats);
    audio.clearScene();
  }

  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) {
      this.state = "ending";
      if (this.onUiEnding) this.onUiEnding(ENDING_LINES);
      return;
    }
    this.start(next);
  }

  onPlayerDeath(word) {
    this.state = "dead";
    this.renderer.addShake(16, 0.5);
    if (this.onUiDeath) this.onUiDeath(word);
    audio.setDanger(0);
  }

  respawn() {
    this.restartLevel();
  }

  pause() { if (this.state === "playing") this.state = "paused"; audio.suspend(); }
  resume() { if (this.state === "paused") { this.state = "playing"; audio.resume(); } }

  onFragmentCollected(f) {
    audio.sfxCollect();
    this.particles.burst(f.x, f.y, 30, {
      speedMin: 40, speedMax: 120, lifeMin: 0.5, lifeMax: 1.2,
      color: "rgba(255, 211, 154, 0.95)", drag: 0.9,
    });
    this.showWhisper(f.text);
  }

  showWhisper(text) {
    if (this.onUiWhisper) this.onUiWhisper(text);
    audio.sfxWhisper();
  }

  _showLevelCard(def) {
    if (this.onUiLevelCard) this.onUiLevelCard(def, this.levelIndex);
  }

  _saveProgress(nextLevel) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        level: nextLevel, ts: Date.now(),
      }));
    } catch {}
  }
  _loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return 0;
      return (JSON.parse(raw).level | 0) || 0;
    } catch { return 0; }
  }
  hasSave() { return this.savedLevel > 0 && this.savedLevel < LEVELS.length; }
  getSavedLevel() { return clamp(this.savedLevel, 0, LEVELS.length - 1); }

  // ---------- Frame ----------
  update(dt) {
    this.time += dt;
    if (this.state !== "playing") {
      // keep particles fading even on pause menus over death
      if (this.state === "dead") this.particles.update(dt);
      return;
    }
    if (this.input.wasPressed("pause")) { this.pause(); if (this.onUiPause) this.onUiPause(true); return; }

    const lvl = this.level;
    this.player.update(dt, this.input, lvl, this);
    lvl.update(dt, this);
    this.particles.update(dt);

    // Adaptive audio: intensity from recent activity, danger from nearby lurkers.
    const recentPulse = clamp(1 - (this.time - this.player.lastPulseTime) / 2.5, 0, 1);
    audio.setIntensity(recentPulse * 0.6 + (this.player.bloomActive ? 0.4 : 0));
    let maxAlert = 0;
    for (const e of lvl.entities) if (e.kind === "lurker") maxAlert = Math.max(maxAlert, e.alertness);
    audio.setDanger(maxAlert);
    this.dangerOverlay = lerp(this.dangerOverlay, maxAlert * 0.8, 0.1);
    audio.tick();

    // Camera follow
    const ww = window.innerWidth, wh = window.innerHeight;
    this.camera.tx = this.player.x - ww / 2;
    this.camera.ty = this.player.y - wh / 2;
    // Clamp to bounds
    const b = lvl.bounds;
    this.camera.tx = clamp(this.camera.tx, b.x, b.x + b.w - ww);
    this.camera.ty = clamp(this.camera.ty, b.y, b.y + b.h - wh);
    this.camera.x = lerp(this.camera.x, this.camera.tx, 1 - Math.pow(0.001, dt));
    this.camera.y = lerp(this.camera.y, this.camera.ty, 1 - Math.pow(0.001, dt));

    // HUD values
    if (this.onUiHud) {
      const depth = Math.round(lvl.depth + (this.player.y - (lvl.def.spawn?.y ?? 0)) * 0.1);
      this.onUiHud({
        depth, modeName: lvl.modeName,
        fragments: this.player.collected,
        totalFragments: this.totalFragments,
        breath: this.player.breath,
        abilities: Array.from(this.player.abilities),
        stillness: this.player.stillness,
        bloom: !!this.player.bloomActive,
      });
    }

    this.input.endFrame();
  }

  render(dt) {
    if (!this.level) return;
    this.renderer.render(this, dt);
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    this.savedLevel = 0;
  }
}
