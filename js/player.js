// The Listener. Movement, abilities, pulses.

import { clamp, TAU, dist, approach } from "./utils.js";
import { audio } from "./audio.js";

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 10; this.h = 10;          // compact collider
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.alive = true;
    this.breath = 1;                    // 0..1 — depletes in silence
    this.lastPulseTime = -999;
    this.lastSoundTime = -999;          // any sonic action
    this.stillness = 0;                 // seconds remaining of stealth
    this.stillnessCd = 0;
    this.pulseCd = 0;
    this.pulses = 0;
    this.collected = 0;
    this.time = 0;
    this.bloomActive = null;            // audio handle
    this.bloomTime = 0;
    this.abilities = new Set(["pulse"]); // unlocked in levels: bloom, stillness, chorus
    this.swimming = false;              // some levels are water (reduced gravity)
    this.phase = 0;                     // oscillating visual
    this.recentCurrent = { x: 0, y: 0 };
    this._state = "idle";
    this.ascend = 0;                     // used in finale
  }

  unlock(a) { this.abilities.add(a); }

  hasAbility(a) { return this.abilities.has(a); }

  update(dt, input, level, game) {
    if (!this.alive) return;
    this.time += dt;
    this.phase += dt;

    const move = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);

    // Movement - ambient water: slower, floaty.
    const accel = this.swimming ? 500 : 900;
    const maxSpeed = this.swimming ? 110 : 150;
    const drag = this.swimming ? 0.84 : 0.82;

    if (move !== 0) {
      this.vx = approach(this.vx, move * maxSpeed, accel * dt);
      this.facing = move;
    } else {
      this.vx *= Math.pow(drag, dt * 60);
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }

    // Jump / rise
    const grav = this.swimming ? 260 : 880;
    const jumpV = this.swimming ? -260 : -360;
    const maxFall = this.swimming ? 220 : 520;

    if (input.wasPressed("up")) this.jumpBuf = 0.15;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);

    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = jumpV;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      audio.sfxJump();
      this.lastSoundTime = this.time;
      game.particles.burst(this.x, this.y + this.h / 2, 6, {
        speedMin: 30, speedMax: 80, lifeMin: 0.2, lifeMax: 0.5,
        sizeMin: 1, sizeMax: 2,
        color: "rgba(118, 226, 255, 0.7)", drag: 0.86,
      });
    }
    // Variable jump
    if (!input.isDown("up") && this.vy < -120) this.vy = Math.max(this.vy, -120);

    // Down input: fast-fall in air; in water it descends
    if (this.swimming && input.isDown("down")) this.vy += grav * 1.8 * dt;
    else this.vy += grav * dt;
    this.vy = Math.min(this.vy, maxFall);

    // Currents (from level)
    this.vx += this.recentCurrent.x * dt;
    this.vy += this.recentCurrent.y * dt;
    this.recentCurrent.x *= 0.9;
    this.recentCurrent.y *= 0.9;

    // --- Abilities ---
    this.pulseCd = Math.max(0, this.pulseCd - dt);
    this.stillnessCd = Math.max(0, this.stillnessCd - dt);
    this.stillness = Math.max(0, this.stillness - dt);

    if ((input.wasPressed("pulse") || input.mouse.clickedThisFrame) && this.pulseCd <= 0) {
      this._emitPulse(level, game, 1);
      this.pulseCd = 0.35;
    }

    if (this.hasAbility("bloom")) {
      if (input.isDown("bloom")) {
        if (!this.bloomActive) {
          this.bloomActive = audio.sfxBloom();
          this.bloomTime = 0;
        }
        this.bloomTime += dt;
        // Sustained bloom = continuous low-intensity pulse emission.
        if (this.bloomTime > 0.12) {
          this.bloomTime -= 0.12;
          this._emitPulse(level, game, 0.45, true);
        }
      } else if (this.bloomActive) {
        this.bloomActive.stop();
        this.bloomActive = null;
      }
    }

    if (this.hasAbility("stillness") && input.wasPressed("still") && this.stillnessCd <= 0) {
      this.stillness = 2.5;
      this.stillnessCd = 8;
      game.particles.burst(this.x, this.y, 14, {
        speedMin: 5, speedMax: 20, lifeMin: 0.6, lifeMax: 1.2,
        color: "rgba(155, 180, 214, 0.35)", drag: 0.95,
      });
    }

    // --- Physics integration with level collision ---
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    // horizontal
    this.x = nx;
    let hitH = this._resolveX(level);
    if (hitH) this.vx = 0;

    // vertical
    this.onGround = false;
    this.y = ny;
    let hitV = this._resolveY(level);
    if (hitV === "floor") {
      this.vy = 0;
      this.onGround = true;
      this.coyote = 0.12;
    } else if (hitV === "ceiling") {
      this.vy = Math.max(this.vy, 0);
    }

    // --- Breath / silence ---
    // Breath restores when making sound; drains slowly otherwise.
    const restoreWindow = this.time - this.lastSoundTime < 2.5 ? 0.6 : -0.18;
    this.breath = clamp(this.breath + restoreWindow * dt * 0.18, 0, 1);
    if (this.breath <= 0.001) {
      this.alive = false;
      return;
    }

    // --- Level triggers ---
    level.interact(this, game);
  }

  _resolveX(level) {
    const me = this.aabb();
    const boxes = this._collisionBoxes(level);
    for (const s of boxes) {
      if (!aabbHit(me, s)) continue;
      if (this.vx > 0) this.x = s.x - this.w / 2;
      else if (this.vx < 0) this.x = s.x + s.w + this.w / 2;
      return true;
    }
    return false;
  }
  _resolveY(level) {
    const me = this.aabb();
    const boxes = this._collisionBoxes(level);
    for (const s of boxes) {
      if (!aabbHit(me, s)) continue;
      if (this.vy > 0) { this.y = s.y - this.h / 2; return "floor"; }
      if (this.vy < 0) { this.y = s.y + s.h + this.h / 2; return "ceiling"; }
    }
    return null;
  }

  _collisionBoxes(level) {
    const out = level.solids;
    const gates = [];
    for (const e of level.entities) {
      if (e.kind === "gate" && e.isSolid && e.isSolid()) {
        gates.push({ x: e.x, y: e.y, w: e.w, h: e.h });
      }
    }
    if (gates.length === 0) return out;
    return out.concat(gates);
  }

  aabb() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  // Emit a sonar pulse — reveals surfaces, alerts creatures.
  _emitPulse(level, game, strength = 1, silent = false) {
    level.pulses.push({
      x: this.x, y: this.y,
      radius: 0,
      maxRadius: 480 * strength,
      speed: 520,
      life: 0,
      maxLife: 1.1,
      strength,
      silent,                       // silent=bloom derivative, smaller alert radius
      source: "player",
    });
    this.pulses++;
    this.lastPulseTime = this.time;
    this.lastSoundTime = this.time;
    if (!silent) audio.sfxPulse(strength);

    // visible ring of particles at origin
    game.particles.burst(this.x, this.y, 10, {
      speedMin: 20 * strength, speedMax: 60 * strength,
      lifeMin: 0.35, lifeMax: 0.7,
      color: "rgba(118, 226, 255, 0.85)", drag: 0.88,
    });
  }

  // External: caused damage
  harm(game, word = "silence") {
    if (!this.alive) return;
    this.alive = false;
    if (this.bloomActive) { this.bloomActive.stop(); this.bloomActive = null; }
    audio.sfxHarm();
    game.onPlayerDeath(word);
    game.particles.burst(this.x, this.y, 28, {
      speedMin: 40, speedMax: 180, lifeMin: 0.4, lifeMax: 1.2,
      color: "rgba(255, 143, 163, 0.9)", drag: 0.85,
    });
  }

  applyCurrent(ax, ay) {
    this.recentCurrent.x += ax;
    this.recentCurrent.y += ay;
  }
}

function aabbHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
