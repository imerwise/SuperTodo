// 8-bit style sound effects via Web Audio API — no external files needed.

const ctx = new (window.AudioContext || window.webkitAudioContext)();

// Unlock audio on first user gesture (autoplay policy).
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  if (ctx.state === "suspended") ctx.resume();
}
document.addEventListener("pointerdown", unlock, { once: true });
document.addEventListener("keydown", unlock, { once: true });

function play(ops) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = ops.type || "square";
  osc.frequency.setValueAtTime(ops.freq || 440, now);
  if (ops.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(ops.freqEnd, 20),
      now + (ops.dur || 0.1)
    );
  }
  gain.gain.setValueAtTime(Math.min(ops.vol || 0.12, 1), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (ops.dur || 0.1));
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + (ops.dur || 0.1));
}

const sfx = {
  enabled: true,

  nav() {
    if (!this.enabled) return;
    play({ freq: 660, dur: 0.05, vol: 0.08, type: "square" });
  },

  enter() {
    if (!this.enabled) return;
    const now = ctx.currentTime;
    const dur = 0.12;
    [523, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, now + i * 0.05);
      g.gain.setValueAtTime(0.1, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.05);
      o.stop(now + i * 0.05 + dur);
    });
  },

  toggle() {
    if (!this.enabled) return;
    play({ freq: 880, dur: 0.04, vol: 0.06, type: "triangle" });
  },

  escape() {
    if (!this.enabled) return;
    play({ freq: 440, freqEnd: 220, dur: 0.15, vol: 0.08, type: "square" });
  },
};