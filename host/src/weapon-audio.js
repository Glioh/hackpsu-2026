// Synthesised weapon sounds (Web Audio, no sample files): grenade pin ping, fuse sizzle and the explosion.
// Like piano-audio.js, the context unlocks on the first click or key press; before that every call is silent.
// Follows the host's Sound effects toggle and volume (setEnabled / setVolume, like combat-audio.js).
export function createWeaponAudio() {
  let audio = null, master = null, noise = null, enabled = true, volume = .65;
  const level = () => enabled ? volume * .85 : 0;
  const fuses = new Map();
  async function unlock() {
    audio ??= new AudioContext();
    if (!master) {
      master = audio.createGain(); master.gain.value = level();
      const limiter = audio.createDynamicsCompressor(); master.connect(limiter); limiter.connect(audio.destination);
      noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
      const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    await audio.resume();
  }
  if (typeof window !== 'undefined') { addEventListener('pointerdown', () => void unlock()); addEventListener('keydown', () => void unlock()); }
  const ready = () => enabled && audio && audio.state === 'running';
  const env = (gain, t, peak, attack, decay) => {
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(peak, t + attack); gain.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
  };
  const noiseSource = (t, duration) => { const s = audio.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random()); s.stop(t + duration); return s; };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); nodes.at(-1).connect(master); nodes[0].onended = () => nodes.forEach(n => n.disconnect()); };

  return {
    // Pin pulled: a bright little metallic ping.
    ping() {
      if (!ready()) return;
      const t = audio.currentTime;
      for (const [f, peak] of [[2350, .18], [3720, .08]]) {
        const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; env(g, t, peak, .003, .25);
        o.start(t); o.stop(t + .3); chain(o, g);
      }
    },
    // Fuse sizzle for one grenade in flight; stop(id) when it goes off or disappears.
    fuse(id) {
      if (!ready() || fuses.has(id)) return;
      const t = audio.currentTime, s = noiseSource(t, 30), band = audio.createBiquadFilter(), g = audio.createGain(), lfo = audio.createOscillator(), depth = audio.createGain();
      band.type = 'bandpass'; band.frequency.value = 5200; band.Q.value = 1.4;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .05);
      lfo.frequency.value = 23; depth.gain.value = .06; lfo.connect(depth); depth.connect(g.gain); lfo.start(t); lfo.stop(t + 30);   // crackle
      chain(s, band, g); fuses.set(id, { s, g, lfo });
    },
    stopFuse(id) {
      const f = fuses.get(id); if (!f) return;
      fuses.delete(id); if (!ready()) return;
      const t = audio.currentTime; f.g.gain.cancelScheduledValues(t); f.g.gain.setTargetAtTime(0, t, .02); f.s.stop(t + .1); f.lfo.stop(t + .1);
    },
    // The explosion: sharp crack, deep pitch-dropping thump, long roaring rumble.
    explode(strength = 1) {
      if (!ready()) return;
      const t = audio.currentTime;
      const crack = noiseSource(t, .12), hp = audio.createBiquadFilter(), cg = audio.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1800; env(cg, t, .9 * strength, .002, .08); chain(crack, hp, cg);
      const thump = audio.createOscillator(), tg = audio.createGain();
      thump.type = 'sine'; thump.frequency.setValueAtTime(140, t); thump.frequency.exponentialRampToValueAtTime(32, t + .45);
      env(tg, t, 1.1 * strength, .004, .7); thump.start(t); thump.stop(t + .8); chain(thump, tg);
      const roar = noiseSource(t, 2.2), lp = audio.createBiquadFilter(), rg = audio.createGain();
      lp.type = 'lowpass'; lp.Q.value = .8; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(140, t + 1.8);
      env(rg, t, .8 * strength, .01, 1.9); chain(roar, lp, rg);
      for (let i = 0; i < 6; i++) {                                                  // debris pattering down
        const at = t + .25 + Math.random() * .9, d = noiseSource(at, .05), bp = audio.createBiquadFilter(), dg = audio.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1600; bp.Q.value = 3; env(dg, at, .12 * strength, .002, .04); chain(d, bp, dg);
      }
    },
    stopAll() { for (const id of [...fuses.keys()]) this.stopFuse(id); },
    setEnabled(value) { enabled = !!value; if (master) master.gain.value = level(); },
    setVolume(value) { volume = Math.max(0, Math.min(1, value)); if (master) master.gain.value = level(); },
  };
}
