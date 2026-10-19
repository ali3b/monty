/**
 * The 1984 game is famous for its jingle, and the original had nothing but beeps. There are no audio assets in the
 * generator, so these are plain WebAudio blips: no files, no downloads.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(freq: number, duration: number, type: OscillatorType = 'square', gain = 0.06, slide = 0) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + duration);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration);
  osc.connect(g).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + duration);
}

function tune(notes: [number, number][], type: OscillatorType = 'square', gain = 0.06) {
  const a = audio();
  if (!a) return;
  let t = 0;
  for (const [freq, len] of notes) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, a.currentTime + t);
    g.gain.setValueAtTime(gain, a.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t + len);
    osc.connect(g).connect(a.destination);
    osc.start(a.currentTime + t);
    osc.stop(a.currentTime + t + len);
    t += len;
  }
}

export const sfx = {
  /** A jewel or a coin. */
  pickup: () => tune([[784, 0.06], [1046, 0.06], [1318, 0.1]]),
  /** A key in a locked door. */
  key: () => tune([[523, 0.07], [659, 0.07], [784, 0.12]]),
  /** A vase or a skull going down. */
  break: () => blip(220, 0.12, 'square', 0.05, -120),
  /** Joe caught. */
  death: () => tune([[392, 0.12], [311, 0.12], [233, 0.28]], 'sawtooth', 0.05),
  /** A locked door with no key. */
  locked: () => blip(140, 0.14, 'square', 0.05),
  /** Walking through a door. */
  door: () => blip(300, 0.16, 'triangle', 0.05, 220),
  /** The idol: the level is done. */
  idol: () => tune([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.3]], 'square', 0.07),
  /** The bonus room is over. */
  bonus: () => tune([[880, 0.08], [660, 0.08], [440, 0.08], [330, 0.16]]),
  /** An extra life. */
  extra: () => tune([[880, 0.07], [1174, 0.07], [1568, 0.16]], 'square', 0.06),
};