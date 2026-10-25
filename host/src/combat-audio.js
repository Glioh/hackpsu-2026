// Short synthesized impacts avoid network/loading delays during combat.
export function createCombatAudio({ createContext = () => new AudioContext({ latencyHint: 'interactive' }), random = Math.random, fetcher = globalThis.fetch } = {}) {
  let context, master, noise, crowd, crowdLoad, generation = 0, enabled = true, volume = .65;
  const active = new Set();
  function stop() {
    generation++;
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
      crowdLoad ??= Promise.resolve().then(()=>fetcher('/host/audio/crowd-cheer.mp3'))
        .then(response=>{if(!response.ok)throw Error('Crowd audio unavailable');return response.arrayBuffer();})
        .then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{crowd=buffer;})
        .catch(()=>{crowdLoad=null;});
      return crowdLoad;
    } catch { /* Combat remains playable when browser audio is unavailable. */ }
  }
  function layer(source, level, duration, filter, sustain = false) {
    const now = context.currentTime, gain = context.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + .004);
    if (sustain) {
      gain.gain.setValueAtTime(level, now + duration * .6);
      gain.gain.exponentialRampToValueAtTime(level * .4, now + duration * .94);
    }
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    if (filter) { source.connect(filter); filter.connect(gain); } else source.connect(gain);
    gain.connect(master); active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration + .01);
  }
  return {
    unlock, stop,
    async cheer(duration = 10.35) {
      if (!enabled || !context) return;
      const started=context.currentTime,requestedGeneration=generation;
      await crowdLoad;
      if(!enabled||context.state!=='running'||requestedGeneration!==generation||!crowd)return;
      const elapsed=context.currentTime-started;
      duration=Math.min(duration-elapsed,crowd.duration);
      if(duration<=.05)return;
      const source=context.createBufferSource();source.buffer=crowd;
      layer(source,.5,duration,undefined,true);
    },
    countdown(fight = false) {
      if (!enabled || context?.state !== 'running') return;
      if (fight) {
        // A two-tone arena horn marks the same beat that releases the simulation.
        for (const frequency of [220, 330]) {
          const horn=context.createOscillator(),filter=context.createBiquadFilter();
          horn.type='sawtooth';horn.frequency.value=frequency;
          filter.type='lowpass';filter.frequency.value=1400;
          layer(horn,.24,.85,filter,true);
        }
        return;
      }
      const boom=context.createOscillator(),now=context.currentTime;
      boom.frequency.setValueAtTime(110,now);
      boom.frequency.exponentialRampToValueAtTime(35,now+.35);
      layer(boom,.4,.45);
      const crash=context.createBufferSource(),filter=context.createBiquadFilter();
      crash.buffer=noise;filter.type='highpass';filter.frequency.value=1800;
      layer(crash,.12,.24,filter);
    },
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
