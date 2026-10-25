// Synthesised weapon sounds (Web Audio, no sample files): grenade pin ping, fuse sizzle and the explosion, the
// hammer's squeak, the frying pan's BONK and the rubber chicken's squawks.
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
    // Squeaky toy: a rubbery whistle that bends up then down, with a wobble. pitch < 1 for the sad deflating miss.
    squeak(pitch = 1, strength = 1) {
      if (!ready()) return;
      const t = audio.currentTime, len = pitch < 1 ? .45 : .26;
      for (const [mult, type, peak] of [[1, 'triangle', .32], [2.01, 'sine', .08]]) {
        const o = audio.createOscillator(), g = audio.createGain(), lfo = audio.createOscillator(), depth = audio.createGain(), f = 1250 * pitch * mult;
        o.type = type; o.frequency.setValueAtTime(f * .7, t); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + len * .3);
        o.frequency.exponentialRampToValueAtTime(f * (pitch < 1 ? .45 : .8), t + len);
        lfo.frequency.value = 28; depth.gain.value = f * .06; lfo.connect(depth); depth.connect(o.frequency); lfo.start(t); lfo.stop(t + len + .05);
        env(g, t, peak * strength, .01, len); o.start(t); o.stop(t + len + .05); chain(o, g);
      }
      const air = noiseSource(t, len), bp = audio.createBiquadFilter(), ag = audio.createGain();      // breathy rubber
      bp.type = 'bandpass'; bp.frequency.value = 2400 * pitch; bp.Q.value = 4; env(ag, t, .1 * strength, .01, len * .8); chain(air, bp, ag);
    },
    // Frying pan BONK: a dull thud plus a ring of inharmonic metallic partials that hangs in the air.
    bonk(strength = 1) {
      if (!ready()) return;
      const t = audio.currentTime;
      const thud = audio.createOscillator(), tg = audio.createGain();
      thud.frequency.setValueAtTime(220, t); thud.frequency.exponentialRampToValueAtTime(90, t + .12);
      env(tg, t, .7 * strength, .002, .16); thud.start(t); thud.stop(t + .2); chain(thud, tg);
      for (const [f, peak, decay] of [[523, .3, 1.1], [1187, .2, .8], [1934, .14, .6], [2851, .1, .45], [3790, .06, .3]]) {
        const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f * (.98 + Math.random() * .04);
        env(g, t, peak * strength, .001, decay); o.start(t); o.stop(t + decay + .05); chain(o, g);
      }
      const clank = noiseSource(t, .04), hp = audio.createBiquadFilter(), cg = audio.createGain();
      hp.type = 'highpass'; hp.frequency.value = 3000; env(cg, t, .4 * strength, .001, .03); chain(clank, hp, cg);
    },
    // Rubber chicken: nasal "bawk" syllables. A hit gets the full strangled scream; a swing a couple of clucks.
    chicken(scream = false) {
      if (!ready()) return;
      const t0 = audio.currentTime, notes = scream ? [[0, .55, 780, 1350]] : [[0, .09, 520, 640], [.13, .12, 560, 700]];
      if (!scream && Math.random() < .5) notes.push([.28, .16, 600, 820]);
      for (const [at, len, from, to] of notes) {
        const t = t0 + at, o = audio.createOscillator(), f1 = audio.createBiquadFilter(), f2 = audio.createBiquadFilter(), g = audio.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + len * .35);
        o.frequency.exponentialRampToValueAtTime(from * .8, t + len);
        if (scream) { const lfo = audio.createOscillator(), d = audio.createGain(); lfo.frequency.value = 17; d.gain.value = 90; lfo.connect(d); d.connect(o.frequency); lfo.start(t); lfo.stop(t + len); }
        f1.type = 'bandpass'; f1.frequency.value = 1100; f1.Q.value = 3;                   // nasal formants
        f2.type = 'peaking'; f2.frequency.value = 2600; f2.gain.value = 10; f2.Q.value = 2;
        env(g, t, scream ? .45 : .3, .008, len); o.start(t); o.stop(t + len + .05); chain(o, f1, f2, g);
      }
    },
    stopAll() { for (const id of [...fuses.keys()]) this.stopFuse(id); },
    setEnabled(value) { enabled = !!value; if (master) master.gain.value = level(); },
    setVolume(value) { volume = Math.max(0, Math.min(1, value)); if (master) master.gain.value = level(); },
  };
}
