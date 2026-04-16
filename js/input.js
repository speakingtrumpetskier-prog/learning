// Keyboard + mouse input. Key-down edge detection.

const KEY_MAP = {
  left:    ["ArrowLeft", "KeyA"],
  right:   ["ArrowRight", "KeyD"],
  up:      ["ArrowUp", "KeyW", "Space"],
  down:    ["ArrowDown", "KeyS"],
  pulse:   ["KeyJ"],
  bloom:   ["KeyK"],
  still:   ["KeyL"],
  pause:   ["Escape"],
  confirm: ["Enter"],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedThisFrame = new Set();
    this.releasedThisFrame = new Set();
    this.mouse = { x: 0, y: 0, down: false, clickedThisFrame: false };

    window.addEventListener("keydown", this._onKey.bind(this, true));
    window.addEventListener("keyup", this._onKey.bind(this, false));

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener("mousedown", () => { this.mouse.down = true; this.mouse.clickedThisFrame = true; });
    canvas.addEventListener("mouseup", () => { this.mouse.down = false; });
    // prevent space-scroll
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    });
  }

  _onKey(isDown, e) {
    if (e.repeat) return;
    if (isDown) {
      if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
      this.down.add(e.code);
    } else {
      this.down.delete(e.code);
      this.releasedThisFrame.add(e.code);
    }
  }

  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.mouse.clickedThisFrame = false;
  }

  isDown(action) {
    return KEY_MAP[action].some(k => this.down.has(k));
  }

  wasPressed(action) {
    return KEY_MAP[action].some(k => this.pressedThisFrame.has(k));
  }

  wasReleased(action) {
    return KEY_MAP[action].some(k => this.releasedThisFrame.has(k));
  }
}
