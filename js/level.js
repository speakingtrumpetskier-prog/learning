// Level — owns solids, entities, pulses, background params, scene.
// A pulse is an expanding circle that "reveals" any entity/solid it touches.

import { TAU, dist, clamp } from "./utils.js";
import { Fragment, Goal } from "./entities.js";

export class Level {
  constructor(def, player, onWhisper) {
    this.def = def;
    this.solids = def.solids.map(s => ({ ...s }));
    this.entities = def.entities.slice();
    this.pulses = [];
    this.surfaceReveals = new Map(); // solid-index -> decay time remaining
    this.player = player;
    this.onWhisper = onWhisper;
    this.bounds = def.bounds;
    this.scene = def.scene;
    this.palette = def.palette;
    this.depth = def.depth ?? 0;
    this.title = def.title;
    this.modeName = def.modeName;
    this.whisper = def.whisper;
    this.ambient = def.ambient ?? 0.08; // how much of world is passively visible
    this.complete = false;
    this.flags = new Set();
    this.hintShown = false;
    this.spawn = def.spawn;
    this.extraUpdate = def.extraUpdate; // optional hook
    // Reset player to spawn.
    player.x = def.spawn.x;
    player.y = def.spawn.y;
    player.vx = 0; player.vy = 0;
    player.swimming = !!def.swim;
    player.alive = true;
    player.breath = 1;
    // Grant abilities defined by this level (cumulative).
    for (const a of def.abilities ?? []) player.unlock(a);
  }

  // A newly emitted pulse is already in this.pulses.
  update(dt, game) {
    // Update pulses.
    for (const p of this.pulses) {
      p.radius += p.speed * dt;
      p.life += dt;
      this._pulseSurfaces(p);
      this._pulseEntities(p, game);
    }
    this.pulses = this.pulses.filter(p => p.life < p.maxLife && p.radius < p.maxRadius + 80);

    // Decay surface reveals.
    for (const [k, v] of this.surfaceReveals) {
      const nv = v - dt;
      if (nv <= 0) this.surfaceReveals.delete(k);
      else this.surfaceReveals.set(k, nv);
    }

    // Update entities.
    for (const e of this.entities) e.update(dt, game);

    // Fragments: player pickup
    for (const e of this.entities) {
      if (e.kind === "fragment" && !e.collected && e.collidesPlayer(this.player)) {
        e.collected = true;
        this.player.collected++;
        game.onFragmentCollected(e);
      }
    }

    // Remove collected fragments from active drawing list.
    this.entities = this.entities.filter(e => !(e.kind === "fragment" && e.collected));

    if (this.extraUpdate) this.extraUpdate(dt, game, this);
  }

  _pulseSurfaces(p) {
    // Mark each solid that the pulse wavefront is crossing.
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      const cx = clamp(p.x, s.x, s.x + s.w);
      const cy = clamp(p.y, s.y, s.y + s.h);
      const d = Math.hypot(p.x - cx, p.y - cy);
      const band = 24; // wave thickness that "paints" visibility
      if (d >= p.radius - band && d <= p.radius + band) {
        this.surfaceReveals.set(i, 2.2);
      }
    }
  }

  _pulseEntities(p, game) {
    for (const e of this.entities) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const band = 28;
      if (d >= p.radius - band && d <= p.radius + band) {
        if (e.onPulse) e.onPulse(p, game);
      }
    }
  }

  interact(player, game) {
    // Check fragments, resonators etc. triggered via the goal.
    // (Collision done inside entity updates above)
  }

  canComplete() {
    // A level is complete when reaching goal and fulfilling fragment req (if any).
    if (this.def.requireFragments) {
      const remaining = this.entities.filter(e => e.kind === "fragment").length;
      return remaining === 0;
    }
    return true;
  }

  onResonatorTriggered(res) {
    // Open gates that match this resonator's group if defined.
    const group = res.group ?? "default";
    for (const g of this.entities) {
      if (g.kind === "gate" && (g.group === group || g.group === "default")) g.open = true;
    }
    this.flags.add("resonator-" + this.entities.indexOf(res));
    // Remove resonator from solids so player can pass its spot? (they aren't solid)
  }

  onBossHarmonized() {
    this.flags.add("boss-done");
    // Reveal the goal (add to entities if not already there).
    if (!this.entities.find(e => e.kind === "goal")) {
      this.entities.push(new Goal(this.def.bossGoal.x, this.def.bossGoal.y));
    }
  }

  // Raw surface visibility for renderer.
  surfaceAlpha(i) {
    const t = this.surfaceReveals.get(i);
    if (!t) return this.ambient;
    // 2.2s decay; fresh = 1, old = ambient.
    const frac = clamp(t / 2.2, 0, 1);
    return clamp(this.ambient + frac, 0, 1);
  }
}
