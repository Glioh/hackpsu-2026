// Short synthesized impacts avoid network/loading delays during combat.
export function createCombatAudio({ createContext = () => new AudioContext({ latencyHint: 'interactive' }), random = Math.random } = {}) {
  let context, master, noise, enabled = true, volume = .65;
  const active = new Set();
  function stop() {
    for (const source of active) { try { source.stop(); } catch {} }
    active.clear();
  }
  function unlock() {
    try {
      if (!context) {
        context = createContext();
        master = context.createGain(); master.gain.value = enabled ? volume : 0;
        const limiter = context.createDynamicsCompressor();
        master.connect(limiter); limiter.connect(context.destination);
        noise = context.createBuffer(1, context.sampleRate * .25, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
      }
      void context.resume().catch(() => {});
    } catch { /* Combat remains playable when browser audio is unavailable. */ }
  }
  function layer(source, level, duration, filter) {
    const now = context.currentTime, gain = context.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    if (filter) { source.connect(filter); filter.connect(gain); } else source.connect(gain);
    gain.connect(master); active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration + .01);
  }
  return {
    unlock, stop,
    setEnabled(value) { enabled = !!value; if (master) master.gain.value = enabled ? volume : 0; if (!enabled) stop(); },
    setVolume(value) { volume = Math.max(0, Math.min(1, value)); if (master) master.gain.value = enabled ? volume : 0; },
    event(event) {
      const hit = event.type === 'hit' && event.source === 'fighter';
      if ((!hit && event.type !== 'punch') || !enabled || !context || context.state !== 'running') return;
      // Stronger launch recoil makes the impact deeper and weightier.
      const weight = Math.max(0, Math.min(1, ((event.strength ?? 5.5) - 5) / 6));
      const source = context.createBufferSource(), filter = context.createBiquadFilter();
      source.buffer = noise; filter.type = 'bandpass'; filter.Q.value = .7;
      filter.frequency.value = hit ? 850 + random() * 300 : 1600;
      layer(source, hit ? .3 + weight * .15 : .09, hit ? .12 : .09, filter);
      if (hit) {
        const thump = context.createOscillator(), now = context.currentTime;
        thump.type = 'sine';
        thump.frequency.setValueAtTime(150 - weight * 35, now);
        thump.frequency.exponentialRampToValueAtTime(45, now + .16);
        layer(thump, .4 + weight * .15, .18);
      }
    },
  };
}
