# ECHO — Chorus of the Abyss

A sonar-driven atmospheric descent. You are a small light in a dead sea.
You **cannot see** the world. You can only **hear** it — and the music
of each place bends to your touch.

Built with pure HTML5 Canvas + Web Audio. No assets. No engine. One file
per system. Headphones recommended.

## The core idea (what is unique)

Almost every platformer gives you a world and asks you to traverse it.
ECHO removes the world. The screen is nearly black. The only way to
perceive anything — platforms, creatures, collectibles, the goal — is to
**emit a sonar pulse** and watch a luminous wavefront wash briefly across
the level, painting surfaces as it passes. Two seconds later, the world
has dimmed back to darkness. Memory is a fading thing here.

Then: *every pulse is a sound*. Creatures in the dark hear them. In later
levels, pulsing carelessly calls lurkers that hunt you. You have to
decide, constantly, between knowing and being known.

And the whole thing is a musical instrument. Each level has its own
**key and mode** (Ionian, Dorian, Lydian, Phrygian, and a custom "Chorus"
mode). Every sound you emit — pulse, bloom, jump, collect — is tuned to
that mode and stacked over a procedural soundtrack that adapts to what
you're doing. Your survival and the soundtrack are the same thing.

## Mechanics that change per level

1. **Shallows (Ionian · C)** — Tutorial. Calm. Learn to pulse; learn that
   only your pulses show you the shape of the world.
2. **Kelp Forest (Dorian · D)** — You unlock **bloom**: hold to sing a
   sustained tone. Currents push you. Resonators open gates when bloomed.
3. **Reef (Lydian · E)** — Stealth. Lurkers hear pulses and hunt them.
   You unlock **stillness** (briefly unheard). Every pulse is a gamble.
4. **Trench (Phrygian · F♯)** — A vertical descent through opposing
   currents and hazards, with the most listeners yet. The music turns
   tense.
5. **Abyss (Chorus · G)** — A silent entity drifts in the centre. You
   must **harmonize** five of its voices by holding bloom near each one.
   When the chord completes, the dark answers.

## Controls

| Action             | Keys                          |
|--------------------|-------------------------------|
| Move               | `A` / `D`   or  `←` / `→`     |
| Rise / jump        | `W` / `Space`                 |
| Descend / fast-fall| `S`                           |
| **Pulse**          | `J`  or  left click           |
| **Bloom** (hold)   | `K`                           |
| **Stillness**      | `L`                           |
| Pause              | `Esc`                         |

## Systems, briefly

- **Procedural audio.** Web Audio oscillators only. Each level sets a
  root note, mode, tempo, and layered voices (held pad, bassline,
  modal arp, adaptive percussion). An intensity signal (recent pulses,
  held bloom) brightens the mix; a danger signal (lurker alertness)
  rolls in bass and percussion. Nothing is sampled.
- **Sonar visibility.** Every solid tracks a "last seen" decay; wavefronts
  paint their ring of visibility onto nearby surfaces; the renderer is
  just a ramp on each solid's alpha plus a glow halo on fresh ones.
- **Breath.** Silence drains it. Sound restores it. You do not die from
  enemies alone — you can die from forgetting to speak.
- **Narrative fragments.** Collectible memories that whisper a line when
  picked up; they form a diffuse story of a dead sea and a voice.
- **Save.** localStorage tracks your deepest level.

## File layout

```
index.html        — DOM/HUD/overlays
style.css         — atmospheric UI
js/main.js        — DOM ↔ game glue
js/game.js        — state machine, camera, flow, save
js/level.js       — level model, pulse/reveal system
js/levels.js      — the five levels
js/player.js      — movement, abilities, breath
js/entities.js    — fragment, resonator, gate, current, lurker,
                    drifter, spike, goal, chorus boss
js/render.js      — dark-first renderer
js/particles.js   — small particle pool
js/audio.js       — procedural modal audio engine
js/input.js       — keyboard + mouse, edge-detection
js/utils.js       — math, modes, easing, hashing
```

## How to play (no setup required)

**Just double-click `play.html`.** It is a single self-contained HTML file
— everything (music engine, renderer, levels) is inlined. Works in any
modern browser (Chrome, Firefox, Safari, Edge) straight off your disk.
Headphones recommended.

### For developers

The source lives as ES modules under `js/`. To iterate in that form you
need a static server (ES modules won't load over `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

After editing source, regenerate the standalone file with:

```sh
node scripts/bundle.mjs   # writes play.html
```

## Design notes

The pitch was *Mario Galaxy but it trusts restraint*: every level has
one structural surprise and one musical shift, and the game's loop is
tuned so that each surprise feels *earned* — the level before it sets up
the habit it will then subvert. Calm, loud, stealth, tense, still. The
core mechanic survives every transition because every system — sight,
sound, safety — is routed through the same simple action: *I emit a
tone into the dark.*
