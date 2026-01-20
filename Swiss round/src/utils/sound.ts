// Web Audio API helper for synthesizing coin sounds without external assets

const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

export const playTossSound = () => {
  if (ctx.state === 'suspended') ctx.resume();
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Create a "whoosh" sound using filtered noise or sweeping oscillator
  // Simulating wind/air resistance
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.2);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};

export const playLandSound = (material: 'gold' | 'silver' | 'bronze' = 'silver') => {
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  
  // Base frequencies for different materials
  const baseFreq = material === 'gold' ? 1200 : material === 'silver' ? 1500 : 1000;
  const decay = material === 'gold' ? 0.8 : material === 'silver' ? 1.2 : 0.4;

  // Metal ping
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, t);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.98, t + 0.1); // Slight pitch bend

  // Sharp attack, long metallic decay
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + decay);

  // Secondary resonance (harmonic)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(baseFreq * 2.5, t);
  gain2.gain.setValueAtTime(0, t);
  gain2.gain.linearRampToValueAtTime(0.05, t + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.5);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + decay * 0.5);
};

export const playBounceSound = (intensity: number = 1) => {
  if (ctx.state === 'suspended') ctx.resume();
  if (intensity < 0.1) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.1 * intensity, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(t);
  osc.stop(t + 0.1);
};
