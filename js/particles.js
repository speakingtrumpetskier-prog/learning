// Lightweight particle system.
import { TAU, randRange } from "./utils.js";

export class Particles {
  constructor(max = 900) {
    this.max = max;
    this.pool = new Array(max).fill(null).map(() => this._blank());
    this.head = 0;
  }
  _blank() {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
             size: 1, color: "#ffffff", blend: "lighter", drag: 1, grav: 0, trail: false };
  }
  spawn(cfg) {
    for (let i = 0; i < this.max; i++) {
      const idx = (this.head + i) % this.max;
      const p = this.pool[idx];
      if (!p.alive) {
        Object.assign(p, this._blank(), cfg, { alive: true });
        this.head = (idx + 1) % this.max;
        return p;
      }
    }
    return null;
  }
  burst(x, y, count, cfg = {}) {
    for (let i = 0; i < count; i++) {
      const a = randRange(0, TAU);
      const s = randRange(cfg.speedMin ?? 20, cfg.speedMax ?? 80);
      this.spawn({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: randRange(cfg.lifeMin ?? 0.4, cfg.lifeMax ?? 1.2),
        size: randRange(cfg.sizeMin ?? 1, cfg.sizeMax ?? 3),
        color: cfg.color ?? "rgba(118, 226, 255, 1)",
        blend: cfg.blend ?? "lighter",
        drag: cfg.drag ?? 0.92,
        grav: cfg.grav ?? 0,
        trail: cfg.trail ?? false,
      });
    }
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.grav * dt;
    }
  }
  render(ctx, cam) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      const a = 1 - t;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      ctx.globalCompositeOperation = p.blend;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const r = p.size * (1 - 0.3 * t);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}
