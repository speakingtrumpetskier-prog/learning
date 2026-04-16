// Entities that populate levels. All listen to pulses; all interact with the
// player. Distinct entity types provide level variety.

import { TAU, dist, clamp, randRange, lerp } from "./utils.js";
import { audio } from "./audio.js";

// -------- Fragment: collectible memory. Brief whisper on pickup. --------
export class Fragment {
  constructor(x, y, text) {
    this.x = x; this.y = y;
    this.text = text;
    this.collected = false;
    this.r = 5;
    this.pulsePhase = Math.random() * TAU;
    this.revealed = 0; // 0..1 how recently a pulse touched
    this.kind = "fragment";
  }
  update(dt) {
    this.pulsePhase += dt * 2;
    this.revealed = Math.max(0, this.revealed - dt * 0.4);
  }
  onPulse(p) { this.revealed = 1; }
  collidesPlayer(p) {
    return dist(this, p) < this.r + 8;
  }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const pulse = 0.5 + 0.5 * Math.sin(this.pulsePhase);
    const a = 0.35 + 0.65 * this.revealed;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 211, 154, ${0.9 * a})`;
    ctx.beginPath(); ctx.arc(sx, sy, this.r + pulse * 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255, 244, 220, ${a})`;
    ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, TAU); ctx.fill();
    // halo
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 28);
    grad.addColorStop(0, `rgba(255, 211, 154, ${0.3 * a})`);
    grad.addColorStop(1, "rgba(255, 211, 154, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, 28, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

// -------- Resonator: hold bloom near it to open a path. --------
export class Resonator {
  constructor(x, y, pitch = 0) {
    this.x = x; this.y = y;
    this.r = 12;
    this.pitch = pitch;
    this.charge = 0; // 0..1
    this.triggered = false;
    this.revealed = 0;
    this.kind = "resonator";
  }
  update(dt, game) {
    this.revealed = Math.max(0, this.revealed - dt * 0.4);
    const p = game.level.player;
    const d = dist(this, p);
    if (p && p.bloomActive && d < 90 && !this.triggered) {
      this.charge = Math.min(1, this.charge + dt * 0.55);
      if (this.charge >= 1) {
        this.triggered = true;
        this.revealed = 1;
        game.level.onResonatorTriggered(this);
        audio.sfxCollect();
        game.particles.burst(this.x, this.y, 40, {
          speedMin: 30, speedMax: 140, lifeMin: 0.5, lifeMax: 1.4,
          color: "rgba(255, 211, 154, 0.9)", drag: 0.9,
        });
      }
    } else if (!this.triggered) {
      this.charge = Math.max(0, this.charge - dt * 0.25);
    }
  }
  onPulse() { this.revealed = 1; }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const a = 0.3 + 0.7 * this.revealed;
    ctx.strokeStyle = this.triggered
      ? `rgba(255, 211, 154, ${a})`
      : `rgba(155, 180, 214, ${a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, this.r, 0, TAU); ctx.stroke();
    if (this.charge > 0) {
      ctx.strokeStyle = `rgba(255, 211, 154, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, this.r + 3, -Math.PI / 2, -Math.PI / 2 + this.charge * TAU);
      ctx.stroke();
    }
    if (this.triggered) {
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 42);
      grad.addColorStop(0, `rgba(255, 211, 154, 0.35)`);
      grad.addColorStop(1, "rgba(255, 211, 154, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, 42, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  }
}

// -------- Gate: activated by triggers; dissolves when all triggers fire. --------
export class Gate {
  constructor(x, y, w, h, group = "default") {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.group = group;
    this.open = false;
    this.openAmt = 0;
    this.revealed = 0;
    this.kind = "gate";
  }
  update(dt) {
    this.revealed = Math.max(0, this.revealed - dt * 0.35);
    this.openAmt = lerp(this.openAmt, this.open ? 1 : 0, 1 - Math.pow(0.01, dt));
  }
  onPulse() { this.revealed = 1; }
  isSolid() { return this.openAmt < 0.5; }
  render(ctx, cam) {
    const a = (0.35 + 0.65 * this.revealed) * (1 - this.openAmt);
    if (a <= 0.01) return;
    ctx.fillStyle = `rgba(118, 226, 255, ${0.1 * a})`;
    ctx.fillRect(this.x - cam.x, this.y - cam.y, this.w, this.h);
    ctx.strokeStyle = `rgba(118, 226, 255, ${0.6 * a})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x - cam.x, this.y - cam.y, this.w, this.h);
    // internal bars
    ctx.strokeStyle = `rgba(118, 226, 255, ${0.25 * a})`;
    for (let i = 0; i < this.w; i += 6) {
      ctx.beginPath();
      ctx.moveTo(this.x - cam.x + i, this.y - cam.y);
      ctx.lineTo(this.x - cam.x + i, this.y - cam.y + this.h);
      ctx.stroke();
    }
  }
}

// -------- Current: push forces on player inside region. --------
export class Current {
  constructor(x, y, w, h, dx, dy) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.dx = dx; this.dy = dy;
    this.phase = 0;
    this.kind = "current";
  }
  update(dt, game) {
    this.phase += dt;
    const p = game.level.player;
    if (!p || !p.alive) return;
    if (p.x > this.x && p.x < this.x + this.w &&
        p.y > this.y && p.y < this.y + this.h) {
      p.applyCurrent(this.dx, this.dy);
    }
  }
  onPulse() {}
  render(ctx, cam) {
    // barely visible streamers showing direction (only when near pulse/bloom)
    const sx = this.x - cam.x, sy = this.y - cam.y;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(118, 226, 255, 0.08)";
    ctx.lineWidth = 1;
    const len = Math.hypot(this.dx, this.dy);
    const ux = this.dx / (len || 1), uy = this.dy / (len || 1);
    for (let i = 0; i < 8; i++) {
      const px = sx + ((i * 17 + this.phase * 30 * ux) % this.w);
      const py = sy + ((i * 23 + this.phase * 30 * uy) % this.h);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + ux * 8, py + uy * 8);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
}

// -------- Lurker: a creature that wakes to sound. Chases pulses, kills on touch. --------
export class Lurker {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 14;
    this.alertness = 0;           // 0..1 — how hunting it is
    this.target = null;
    this.wanderAngle = Math.random() * TAU;
    this.wanderT = 0;
    this.revealed = 0;
    this.kind = "lurker";
  }
  update(dt, game) {
    this.revealed = Math.max(0, this.revealed - dt * 0.35);
    const p = game.level.player;

    // Decay alertness
    this.alertness = Math.max(0, this.alertness - dt * 0.2);

    // Wander when calm
    this.wanderT += dt;
    if (this.wanderT > 1.5) {
      this.wanderT = 0;
      this.wanderAngle += randRange(-0.8, 0.8);
    }

    // Pursue target if alert
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) { this.target = null; }
      else {
        this.vx = lerp(this.vx, (dx / d) * 70 * this.alertness, 0.08);
        this.vy = lerp(this.vy, (dy / d) * 70 * this.alertness, 0.08);
      }
    } else {
      const sp = 20 * (1 - this.alertness) + 35 * this.alertness;
      this.vx = lerp(this.vx, Math.cos(this.wanderAngle) * sp, 0.04);
      this.vy = lerp(this.vy, Math.sin(this.wanderAngle) * sp, 0.04);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Crude containment in level
    const lv = game.level;
    this.x = clamp(this.x, lv.bounds.x + 20, lv.bounds.x + lv.bounds.w - 20);
    this.y = clamp(this.y, lv.bounds.y + 20, lv.bounds.y + lv.bounds.h - 20);

    // Touch kills
    if (p && p.alive && dist(p, this) < this.r + 8 && p.stillness <= 0) {
      p.harm(game, "taken");
    }
  }
  onPulse(p) {
    // If player isn't still, we hear the pulse and start chasing it.
    const game = window.__echoGame;
    const player = game?.level?.player;
    if (player && player.stillness > 0 && p.source === "player") return;
    this.revealed = 1;
    this.alertness = Math.min(1, this.alertness + 0.7 * (p.strength ?? 1));
    // Hunt toward the source.
    if (p.source === "player" && player) {
      this.target = { x: player.x + randRange(-40, 40), y: player.y + randRange(-40, 40) };
    } else {
      this.target = { x: p.x, y: p.y };
    }
  }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const a = 0.15 + 0.85 * Math.max(this.revealed, this.alertness * 0.25);
    if (a < 0.05) return;

    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.r * 3);
    const col = this.alertness > 0.4
      ? `rgba(255, 143, 163, ${0.3 * a})`
      : `rgba(155, 180, 214, ${0.18 * a})`;
    grad.addColorStop(0, col);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.r * 3, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // tentacle-y shape — rings
    ctx.strokeStyle = this.alertness > 0.5
      ? `rgba(255, 143, 163, ${a})`
      : `rgba(155, 180, 214, ${a})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const rr = this.r - i * 3;
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const ang = (j / 20) * TAU;
        const wobble = Math.sin(ang * 4 + performance.now() / 300 + i) * 1.5;
        const x = sx + Math.cos(ang) * (rr + wobble);
        const y = sy + Math.sin(ang) * (rr + wobble);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    // eye
    if (this.alertness > 0.3) {
      ctx.fillStyle = `rgba(255, 143, 163, ${a})`;
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, TAU); ctx.fill();
    }
  }
}

// -------- Drifter: harmless glowing creature that reacts to pulses (atmosphere). --------
export class Drifter {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = randRange(-10, 10);
    this.vy = randRange(-10, 10);
    this.r = randRange(1.5, 3);
    this.revealed = 0;
    this.color = Math.random() < 0.3
      ? "rgba(255, 211, 154, 1)"
      : "rgba(118, 226, 255, 1)";
    this.phase = Math.random() * TAU;
    this.kind = "drifter";
  }
  update(dt) {
    this.revealed = Math.max(0, this.revealed - dt * 0.3);
    this.phase += dt * 2;
    this.x += this.vx * dt + Math.sin(this.phase) * 0.2;
    this.y += this.vy * dt + Math.cos(this.phase * 1.3) * 0.2;
    this.vx *= 0.995; this.vy *= 0.995;
  }
  onPulse() {
    this.revealed = 1;
    this.vx += randRange(-30, 30);
    this.vy += randRange(-30, 30);
  }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const a = 0.1 + 0.9 * this.revealed;
    if (a < 0.04) return;
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.r * 6);
    grad.addColorStop(0, this.color.replace(", 1)", `, ${0.6 * a})`));
    grad.addColorStop(1, this.color.replace(", 1)", ", 0)"));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.r * 6, 0, TAU); ctx.fill();
    ctx.fillStyle = this.color.replace(", 1)", `, ${a})`);
    ctx.beginPath(); ctx.arc(sx, sy, this.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

// -------- Spike: fixed hazard revealed by pulse. --------
export class Spike {
  constructor(x, y, w = 16, h = 10) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.revealed = 0;
    this.kind = "spike";
  }
  update(dt, game) {
    this.revealed = Math.max(0, this.revealed - dt * 0.3);
    const p = game.level.player;
    if (p && p.alive && p.x > this.x && p.x < this.x + this.w
        && p.y + 5 > this.y && p.y - 5 < this.y + this.h) {
      p.harm(game, "pierced");
    }
  }
  onPulse() { this.revealed = 1; }
  render(ctx, cam) {
    const a = 0.15 + 0.85 * this.revealed;
    if (a < 0.04) return;
    ctx.fillStyle = `rgba(255, 143, 163, ${a * 0.6})`;
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const spikes = Math.max(2, Math.floor(this.w / 6));
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const x = sx + (i / spikes) * this.w;
      ctx.moveTo(x, sy + this.h);
      ctx.lineTo(x + (this.w / spikes) / 2, sy);
      ctx.lineTo(x + this.w / spikes, sy + this.h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 143, 163, ${a})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// -------- Goal: exit of level (the descent onward). --------
export class Goal {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 28;
    this.phase = 0;
    this.revealed = 0;
    this.kind = "goal";
    this.triggered = false;
  }
  update(dt, game) {
    this.revealed = Math.max(0, this.revealed - dt * 0.25);
    this.phase += dt;
    const p = game.level.player;
    if (!this.triggered && p && p.alive && dist(p, this) < this.r) {
      // Requirements from level.
      if (game.level.canComplete()) {
        this.triggered = true;
        game.onLevelComplete();
      }
    }
  }
  onPulse() { this.revealed = 1; }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const a = 0.25 + 0.75 * Math.max(this.revealed, 0.4);
    const pulse = 0.5 + 0.5 * Math.sin(this.phase * 1.5);
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.r * 2);
    grad.addColorStop(0, `rgba(255, 211, 154, ${0.35 * a * (0.6 + 0.4 * pulse)})`);
    grad.addColorStop(1, "rgba(255, 211, 154, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.r * 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255, 211, 154, ${a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, this.r + pulse * 3, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, this.r - 8 - pulse * 2, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
}

// -------- ChorusBoss: the final act — a silent being you must "sing" into being. --------
// It doesn't move until harmonized by sustained bloom at correct positions.
export class ChorusBoss {
  constructor(cx, cy) {
    this.x = cx; this.y = cy;
    this.r = 60;
    this.phase = 0;
    this.state = "silent";    // silent -> listening -> singing -> chorus
    this.nodes = [];          // sub-resonators around it
    this.harmonized = 0;
    this.kind = "boss";
    this.revealed = 0.3;
    // Place 5 nodes around the boss that must be individually harmonized.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      this.nodes.push({
        x: cx + Math.cos(a) * 180,
        y: cy + Math.sin(a) * 180,
        charge: 0, done: false, a,
      });
    }
  }
  update(dt, game) {
    this.phase += dt;
    const p = game.level.player;
    // Each node charges when bloom is active nearby.
    for (const n of this.nodes) {
      if (n.done) continue;
      if (p && p.bloomActive && dist(p, n) < 110) {
        n.charge += dt * 0.35;
        if (n.charge >= 1) {
          n.done = true;
          this.harmonized++;
          audio.sfxCollect();
          game.particles.burst(n.x, n.y, 50, {
            speedMin: 40, speedMax: 180, lifeMin: 0.6, lifeMax: 1.8,
            color: "rgba(255, 211, 154, 0.9)", drag: 0.9,
          });
          if (this.harmonized >= this.nodes.length) {
            this.state = "chorus";
            game.level.onBossHarmonized();
          }
        }
      } else {
        n.charge = Math.max(0, n.charge - dt * 0.08);
      }
    }
  }
  onPulse() { this.revealed = Math.min(1, this.revealed + 0.25); }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const breathe = 0.5 + 0.5 * Math.sin(this.phase * 0.6);
    const a = this.revealed;
    ctx.globalCompositeOperation = "lighter";
    // core
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.r * 3);
    grad.addColorStop(0, `rgba(118, 226, 255, ${0.2 * a * (0.6 + 0.4 * breathe)})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.r * 3, 0, TAU); ctx.fill();

    // Rings
    ctx.strokeStyle = `rgba(118, 226, 255, ${a})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(sx, sy, this.r + i * 8 + breathe * 6, 0, TAU);
      ctx.globalAlpha = (a * (1 - i / 5)) * 0.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodes
    for (const n of this.nodes) {
      const nx = n.x - cam.x, ny = n.y - cam.y;
      ctx.strokeStyle = n.done
        ? `rgba(255, 211, 154, ${a})`
        : `rgba(155, 180, 214, ${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(nx, ny, 14, 0, TAU); ctx.stroke();
      if (n.charge > 0) {
        ctx.strokeStyle = `rgba(255, 211, 154, ${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, 18, -Math.PI / 2, -Math.PI / 2 + n.charge * TAU);
        ctx.stroke();
      }
      if (n.done) {
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 40);
        ng.addColorStop(0, `rgba(255, 211, 154, 0.4)`);
        ng.addColorStop(1, "rgba(255, 211, 154, 0)");
        ctx.fillStyle = ng;
        ctx.beginPath(); ctx.arc(nx, ny, 40, 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
