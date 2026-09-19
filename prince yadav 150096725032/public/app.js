/**
 * Shared Client Utilities & Web Audio Sound Engine
 * Provides synthesized audio (no external MP3 dependencies) and UI helpers.
 */

// Web Audio API Synthesizer
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio playback fails silently if user has not interacted
    }
  }

  playTick() {
    this.playTone(880, 'sine', 0.08, 0.12);
  }

  playWarningTick() {
    this.playTone(1200, 'square', 0.1, 0.18);
  }

  playLock() {
    if (this.muted) return;
    this.playTone(520, 'triangle', 0.15, 0.25);
  }

  playCorrect() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C E G C chord
      freqs.forEach((f, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.18, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.35);
      });
    } catch (e) {}
  }

  playIncorrect() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const freqs = [350, 310, 260];
      freqs.forEach((f, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + i * 0.1);
        gain.gain.setValueAtTime(0.15, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
    } catch (e) {}
  }

  playFanfare() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.6];
      let t = this.audioCtx.currentTime;
      notes.forEach((freq, idx) => {
        const dur = durations[idx];
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur * 0.85;
      });
    } catch (e) {}
  }
}

const sound = new SoundEngine();

// UI Toast Notification helper
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `quiz-toast toast-${type}`;
  toast.innerText = message;
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '10px';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '600';
  toast.style.color = '#fff';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
  toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  toast.style.transform = 'translateX(50px)';
  toast.style.opacity = '0';
  toast.style.backdropFilter = 'blur(10px)';

  if (type === 'error') {
    toast.style.background = 'rgba(239, 68, 68, 0.9)';
    toast.style.border = '1px solid #f87171';
  } else if (type === 'success') {
    toast.style.background = 'rgba(16, 185, 129, 0.9)';
    toast.style.border = '1px solid #34d399';
  } else {
    toast.style.background = 'rgba(30, 41, 59, 0.92)';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  }

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translateX(50px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Lightweight Confetti Particles Animation
function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#e21b3c', '#1368ce', '#ffa602', '#26890c', '#ec4899', '#8b5cf6', '#06b6d4'];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 4,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  let animationFrame;
  let startTime = Date.now();

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - startTime;

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (elapsed < 6000) {
      animationFrame = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrame);
      canvas.remove();
    }
  }

  animationFrame = requestAnimationFrame(render);
}

// Option Metadata for Kahoot 4-Color shapes
const OPTION_META = [
  { index: 0, label: 'A', name: 'Red', color: '#e21b3c', shape: '▲', shapeName: 'triangle' },
  { index: 1, label: 'B', name: 'Blue', color: '#1368ce', shape: '◆', shapeName: 'diamond' },
  { index: 2, label: 'C', name: 'Yellow', color: '#d89e00', shape: '●', shapeName: 'circle' },
  { index: 3, label: 'D', name: 'Green', color: '#26890c', shape: '■', shapeName: 'square' }
];

window.sound = sound;
window.showToast = showToast;
window.triggerConfetti = triggerConfetti;
window.OPTION_META = OPTION_META;
