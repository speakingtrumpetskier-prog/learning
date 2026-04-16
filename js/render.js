// Renderer — the game is dark; render is mostly about wavefronts, reveals,
// and atmospheric particles. Surfaces glow briefly when pulse-touched.
// Pulse wavefronts draw as luminous rings with subtle chromatic aberration.

import { TAU, clamp } from "./utils.js";

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.width = 1; this.height = 1;
    this.shakeTime = 0; this.shakeAmp = 0;
    this.vignettePulse = 0;
  }

  resize(w, h) { this.width = w; this.height = h; }

  addShake(amp = 8, time = 0.25) { this.shakeAmp = amp; this.shakeTime = time; }

  // Main draw.
  render(game, dt) {
    const ctx = this.ctx;
    const level = game.level;
    const cam = game.camera;

    ctx.clearRect(0, 0, this.width, this.height);

    // Background: vertical gradient from palette, slight parallax.
    this._renderBackground(level, cam);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const f = this.shakeTime > 0 ? 1 : 0;
      cam.ox = (Math.random() - 0.5) * this.shakeAmp * f;
      cam.oy = (Math.random() - 0.5) * this.shakeAmp * f;
    } else { cam.ox = 0; cam.oy = 0; }

    const viewCam = { x: cam.x + cam.ox, y: cam.y + cam.oy };

    // Far ambient specks (very dim)
    this._renderAmbientSpecks(viewCam, level);

    // Solids — only visible when touched by pulse.
    this._renderSolids(level, viewCam);

    // Entities
    for (const e of level.entities) {
      if (e.render) e.render(ctx, viewCam);
    }

    // Pulse wavefronts
    this._renderPulses(level, viewCam);

    // Particles
    game.particles.render(ctx, viewCam);

    // Player
    this._renderPlayer(game, viewCam);

    // Pulse history overlay (subtle)
    this._renderOverlay(game);
  }

  _renderBackground(level, cam) {
    const ctx = this.ctx;
    const p = level.palette;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    // Shift with depth: deeper = darker bg0
    grad.addColorStop(0, p.bg0);
    grad.addColorStop(1, p.bg1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // subtle volumetric noise from depth — animated vertical fog
    const t = performance.now() / 4000;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const offset = (cam.y * 0.1 + i * 200 + t * 80) % (this.height + 400) - 200;
      ctx.fillStyle = `rgba(118, 226, 255, 0.015)`;
      ctx.fillRect(0, offset, this.width, 80);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  _renderAmbientSpecks(cam, level) {
    // Procedural static specks via hashed positions. Extremely dim.
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(155, 180, 214, 0.05)";
    const spacing = 80;
    const cols = Math.ceil(this.width / spacing) + 2;
    const rows = Math.ceil(this.height / spacing) + 2;
    const ox = Math.floor(cam.x / spacing) * spacing;
    const oy = Math.floor(cam.y / spacing) * spacing;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const wx = ox + ix * spacing;
        const wy = oy + iy * spacing;
        const h = hash2(wx, wy);
        const jx = (h & 0xff) / 255;
        const jy = ((h >> 8) & 0xff) / 255;
        const size = ((h >> 16) & 0xff) / 255;
        const sx = wx + jx * spacing - cam.x;
        const sy = wy + jy * spacing - cam.y;
        if (sx < -4 || sx > this.width + 4 || sy < -4 || sy > this.height + 4) continue;
        ctx.fillRect(sx, sy, 0.7 + size * 0.8, 0.7 + size * 0.8);
      }
    }
  }

  _renderSolids(level, cam) {
    const ctx = this.ctx;
    const p = level.palette;
    for (let i = 0; i < level.solids.length; i++) {
      const s = level.solids[i];
      const a = level.surfaceAlpha(i);
      if (a <= 0.015) continue;
      const sx = s.x - cam.x, sy = s.y - cam.y;
      if (sx + s.w < -20 || sx > this.width + 20 || sy + s.h < -20 || sy > this.height + 20) continue;

      // Filled body — deep color
      ctx.fillStyle = colorWithAlpha(p.bg0, Math.min(1, a * 1.4));
      ctx.fillRect(sx, sy, s.w, s.h);

      // Edge outline (brightest when recently pulsed)
      ctx.strokeStyle = colorWithAlpha(p.surface, a);
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, s.w - 1, s.h - 1);

      // Subtle interior scatter lines for detail
      if (a > 0.4) {
        ctx.strokeStyle = colorWithAlpha(p.surface, a * 0.2);
        ctx.beginPath();
        for (let x = 6; x < s.w - 2; x += 14) {
          ctx.moveTo(sx + x, sy + 2);
          ctx.lineTo(sx + x, sy + Math.min(6, s.h - 2));
        }
        ctx.stroke();
      }

      // Glow halo above surface (lighter blend)
      if (a > 0.2) {
        ctx.globalCompositeOperation = "lighter";
        const grad = ctx.createLinearGradient(0, sy - 12, 0, sy);
        grad.addColorStop(0, colorWithAlpha(p.wave, 0));
        grad.addColorStop(1, colorWithAlpha(p.wave, a * 0.12));
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy - 12, s.w, 12);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  _renderPulses(level, cam) {
    const ctx = this.ctx;
    const p = level.palette;
    ctx.globalCompositeOperation = "lighter";
    for (const pulse of level.pulses) {
      const sx = pulse.x - cam.x, sy = pulse.y - cam.y;
      const r = pulse.radius;
      const age = pulse.life / pulse.maxLife;
      const a = (1 - age) * (pulse.silent ? 0.25 : 0.55) * pulse.strength;
      if (a < 0.02) continue;

      // outer faint ring
      ctx.strokeStyle = colorWithAlpha(p.wave, a * 0.45);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.stroke();

      // leading crisp ring
      ctx.strokeStyle = colorWithAlpha(p.wave, a);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(sx, sy, r - 3, 0, TAU); ctx.stroke();

      // chromatic tail
      ctx.strokeStyle = colorWithAlpha(p.accent, a * 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, r - 10, 0, TAU); ctx.stroke();

      // subtle radial fill
      if (r < 180) {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grad.addColorStop(0, colorWithAlpha(p.wave, a * 0.05));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  _renderPlayer(game, cam) {
    const ctx = this.ctx;
    const p = game.level.player;
    if (!p.alive) return;
    const sx = p.x - cam.x, sy = p.y - cam.y;

    // Bloom (if active) — sustained aura
    if (p.bloomActive) {
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90);
      grad.addColorStop(0, "rgba(255, 244, 220, 0.35)");
      grad.addColorStop(1, "rgba(255, 244, 220, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // Stillness shroud — dim
    if (p.stillness > 0) {
      const a = clamp(p.stillness / 2.5, 0, 1);
      ctx.fillStyle = `rgba(50, 60, 80, ${0.5 * a})`;
      ctx.beginPath(); ctx.arc(sx, sy, 14, 0, TAU); ctx.fill();
    }

    // Core glow
    ctx.globalCompositeOperation = "lighter";
    const pulsePhase = 0.5 + 0.5 * Math.sin(p.phase * 2);
    const gradCore = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
    const glowColor = p.breath > 0.4 ? "rgba(118, 226, 255," : "rgba(255, 143, 163,";
    gradCore.addColorStop(0, glowColor + ` ${0.6 + 0.2 * pulsePhase})`);
    gradCore.addColorStop(0.3, glowColor + ` ${0.2 + 0.1 * pulsePhase})`);
    gradCore.addColorStop(1, glowColor + " 0)");
    ctx.fillStyle = gradCore;
    ctx.beginPath(); ctx.arc(sx, sy, 40, 0, TAU); ctx.fill();

    // Body - a soft luminous dot
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = glowColor + " 1)";
    ctx.beginPath(); ctx.arc(sx, sy, 3.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  _renderOverlay(game) {
    const ctx = this.ctx;
    // Vignette
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.25,
      this.width / 2, this.height / 2, this.height * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Danger pulse frame
    if (game.dangerOverlay > 0.01) {
      ctx.fillStyle = `rgba(255, 143, 163, ${0.14 * game.dangerOverlay})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
}

// --- helpers ---
function hash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return h;
}

function colorWithAlpha(rgbaStr, a) {
  // Accepts "rgba(r,g,b,x)" or "#rrggbb"
  if (rgbaStr.startsWith("rgba")) {
    return rgbaStr.replace(/, ?[\d.]+\)$/, `,${a})`);
  }
  if (rgbaStr.startsWith("#")) {
    const r = parseInt(rgbaStr.slice(1, 3), 16);
    const g = parseInt(rgbaStr.slice(3, 5), 16);
    const b = parseInt(rgbaStr.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return rgbaStr;
}
