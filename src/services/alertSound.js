// ── Web Audio API Alert Sounds ────────────────────────────────
// No external libraries — works in all modern browsers
// Must be triggered by a user interaction first (browser policy)
// After first interaction (login click), sounds play freely

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── Core beep generator ────────────────────────────────────────
function beep({ frequency = 880, duration = 200, type = 'sine', volume = 0.4, startTime = 0 }) {
  const ctx       = getCtx();
  const oscillator = ctx.createOscillator();
  const gainNode   = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type      = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);

  gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration / 1000);

  oscillator.start(ctx.currentTime + startTime);
  oscillator.stop(ctx.currentTime + startTime + duration / 1000 + 0.05);
}

// ── Named alert sounds ─────────────────────────────────────────

// WARNING — 3 medium beeps (yellow alert)
export function playWarningSound() {
  try {
    beep({ frequency: 660, duration: 200, volume: 0.35, startTime: 0.0 });
    beep({ frequency: 660, duration: 200, volume: 0.35, startTime: 0.3 });
    beep({ frequency: 660, duration: 200, volume: 0.35, startTime: 0.6 });
  } catch (e) { console.warn('Audio error:', e); }
}

// DANGER — rapid high-pitched repeating alarm
export function playDangerSound() {
  try {
    for (let i = 0; i < 6; i++) {
      beep({ frequency: 1200, duration: 150, type: 'square', volume: 0.5, startTime: i * 0.22 });
      beep({ frequency: 900,  duration: 150, type: 'square', volume: 0.4, startTime: i * 0.22 + 0.11 });
    }
  } catch (e) { console.warn('Audio error:', e); }
}

// SOS — classic SOS pattern (3 short, 3 long, 3 short)
export function playSOSSound() {
  try {
    const short = 0.12, long = 0.36, gap = 0.08, pause = 0.3;
    let t = 0;
    // 3 short
    for (let i = 0; i < 3; i++) {
      beep({ frequency: 1000, duration: short * 1000, volume: 0.5, startTime: t });
      t += short + gap;
    }
    t += pause;
    // 3 long
    for (let i = 0; i < 3; i++) {
      beep({ frequency: 1000, duration: long * 1000, volume: 0.5, startTime: t });
      t += long + gap;
    }
    t += pause;
    // 3 short
    for (let i = 0; i < 3; i++) {
      beep({ frequency: 1000, duration: short * 1000, volume: 0.5, startTime: t });
      t += short + gap;
    }
  } catch (e) { console.warn('Audio error:', e); }
}

// ESCALATION — 2 descending tones (urgent but different from SOS)
export function playEscalationSound() {
  try {
    beep({ frequency: 1400, duration: 300, volume: 0.5, startTime: 0.0 });
    beep({ frequency: 1000, duration: 300, volume: 0.5, startTime: 0.4 });
    beep({ frequency: 700,  duration: 400, volume: 0.5, startTime: 0.8 });
  } catch (e) { console.warn('Audio error:', e); }
}

// DEAD MAN WARNING — slow pulsing beeps (time running out feel)
export function playDeadManWarning() {
  try {
    beep({ frequency: 750, duration: 400, type: 'triangle', volume: 0.4, startTime: 0.0 });
    beep({ frequency: 750, duration: 400, type: 'triangle', volume: 0.4, startTime: 0.7 });
  } catch (e) { console.warn('Audio error:', e); }
}

// ACKNOWLEDGE / SAFE — soft positive tone (double chime)
export function playAcknowledgeSound() {
  try {
    beep({ frequency: 523, duration: 150, type: 'sine', volume: 0.3, startTime: 0.0 }); // C5
    beep({ frequency: 659, duration: 200, type: 'sine', volume: 0.3, startTime: 0.2 }); // E5
  } catch (e) { console.warn('Audio error:', e); }
}

// ── Unlock audio context on first user interaction ─────────────
// Call this once on app start after any click
export function unlockAudio() {
  try {
    const ctx = getCtx();
    // Play a silent beep to unlock
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.001);
  } catch (e) { /* silent fail */ }
}