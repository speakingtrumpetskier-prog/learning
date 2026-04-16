// Entry point — wires DOM/UI to Game.

import { Game } from "./game.js";
import { audio } from "./audio.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);

// ---- UI refs ----
const titleEl = document.getElementById("title");
const helpEl = document.getElementById("help");
const hudEl = document.getElementById("hud");
const pauseEl = document.getElementById("pause");
const deathEl = document.getElementById("death");
const completeEl = document.getElementById("complete");
const endingEl = document.getElementById("ending");
const whisperEl = document.getElementById("whisper");
const levelCardEl = document.getElementById("level-card");

const depthValue = document.getElementById("depth-value");
const modeValue = document.getElementById("mode-value");
const fragmentsValue = document.getElementById("fragments-value");
const breathFill = document.getElementById("breath-fill");
const breathBar = breathFill.parentElement;
const abilitiesEl = document.getElementById("abilities");

const levelNumberEl = document.getElementById("level-number");
const levelTitleEl = document.getElementById("level-title");
const levelModeEl = document.getElementById("level-mode");
const levelWhisperEl = document.getElementById("level-whisper");
const deathWordEl = document.getElementById("death-word");
const completeTitle = document.getElementById("complete-title");
const statPulses = document.getElementById("stat-pulses");
const statFrag = document.getElementById("stat-fragments");
const statTime = document.getElementById("stat-time");
const endingTextEl = document.getElementById("ending-text");

// ---- Wire buttons ----
document.getElementById("btn-begin").onclick = async () => {
  titleEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
  await game.start(0);
};
document.getElementById("btn-continue").onclick = async () => {
  if (!game.hasSave()) return;
  titleEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
  await game.start(game.getSavedLevel());
};
document.getElementById("btn-help").onclick = () => {
  titleEl.classList.add("hidden");
  helpEl.classList.remove("hidden");
};
document.getElementById("btn-help-back").onclick = () => {
  helpEl.classList.add("hidden");
  titleEl.classList.remove("hidden");
};
document.getElementById("btn-resume").onclick = () => {
  pauseEl.classList.add("hidden");
  game.resume();
};
document.getElementById("btn-restart").onclick = () => {
  pauseEl.classList.add("hidden");
  game.restartLevel();
};
document.getElementById("btn-quit").onclick = () => {
  pauseEl.classList.add("hidden");
  hudEl.classList.add("hidden");
  titleEl.classList.remove("hidden");
  audio.clearScene();
  game.state = "menu";
};
document.getElementById("btn-respawn").onclick = () => {
  deathEl.classList.add("hidden");
  game.respawn();
};
document.getElementById("btn-next").onclick = () => {
  completeEl.classList.add("hidden");
  game.nextLevel();
};

// Initial: show/hide continue button based on save.
if (!game.hasSave()) document.getElementById("btn-continue").style.display = "none";

// ---- UI callbacks from game ----
game.onUiHud = (hud) => {
  depthValue.textContent = `${hud.depth} m`;
  modeValue.textContent = hud.modeName;
  fragmentsValue.textContent = `${hud.fragments} / ${hud.totalFragments}`;
  breathFill.style.width = `${(hud.breath * 100).toFixed(0)}%`;
  if (hud.breath < 0.3) breathBar.classList.add("warn");
  else breathBar.classList.remove("warn");

  // Abilities.
  const defs = [
    { id: "pulse", key: "J", label: "pulse" },
    { id: "bloom", key: "K", label: "bloom" },
    { id: "stillness", key: "L", label: "stillness" },
  ];
  abilitiesEl.innerHTML = "";
  for (const d of defs) {
    if (!hud.abilities.includes(d.id)) continue;
    const div = document.createElement("div");
    div.className = "ability";
    if (d.id === "bloom" && hud.bloom) div.classList.add("active");
    if (d.id === "stillness" && hud.stillness > 0) div.classList.add("active");
    div.innerHTML = `<kbd>${d.key}</kbd> <span>${d.label}</span>`;
    abilitiesEl.appendChild(div);
  }
};

game.onUiLevelCard = (def, idx) => {
  levelNumberEl.textContent = `descent · ${idx + 1} of 5`;
  levelTitleEl.textContent = def.title;
  levelModeEl.textContent = def.modeName;
  levelWhisperEl.textContent = def.whisper;
  levelCardEl.classList.remove("hidden");
  requestAnimationFrame(() => levelCardEl.classList.add("show"));
  setTimeout(() => {
    levelCardEl.classList.remove("show");
    setTimeout(() => levelCardEl.classList.add("hidden"), 1500);
  }, 3000);
};

let whisperTimeoutId;
game.onUiWhisper = (text) => {
  if (!text) return;
  whisperEl.textContent = text;
  whisperEl.classList.remove("hidden");
  requestAnimationFrame(() => whisperEl.classList.add("show"));
  clearTimeout(whisperTimeoutId);
  whisperTimeoutId = setTimeout(() => {
    whisperEl.classList.remove("show");
    setTimeout(() => whisperEl.classList.add("hidden"), 1400);
  }, 4600);
};

game.onUiPause = (on) => {
  if (on) pauseEl.classList.remove("hidden");
  else pauseEl.classList.add("hidden");
};

game.onUiDeath = (word) => {
  deathWordEl.textContent = word;
  deathEl.classList.remove("hidden");
};

game.onUiComplete = (def, stats) => {
  completeTitle.textContent = def.title + " · resolved";
  statPulses.textContent = stats.pulses;
  statFrag.textContent = stats.fragments;
  statTime.textContent = `${stats.time.toFixed(1)}s`;
  completeEl.classList.remove("hidden");
};

game.onUiEnding = (lines) => {
  hudEl.classList.add("hidden");
  endingTextEl.innerHTML = "";
  endingEl.classList.remove("hidden");
  for (let i = 0; i < lines.length; i++) {
    const div = document.createElement("div");
    div.className = "ending-line";
    div.textContent = lines[i];
    div.style.animationDelay = `${i * 2.4}s`;
    endingTextEl.appendChild(div);
  }
  // final button after the lines settle
  setTimeout(() => {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.style.marginTop = "60px";
    btn.textContent = "Return to surface";
    btn.onclick = () => location.reload();
    endingTextEl.appendChild(btn);
  }, lines.length * 2400 + 1800);
};

// ---- Main loop ----
let lastT = performance.now();
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  try {
    game.update(dt);
    game.render(dt);
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Resume audio on any first interaction
const resumeOnce = async () => {
  await audio.resume();
  window.removeEventListener("pointerdown", resumeOnce);
  window.removeEventListener("keydown", resumeOnce);
};
window.addEventListener("pointerdown", resumeOnce);
window.addEventListener("keydown", resumeOnce);
