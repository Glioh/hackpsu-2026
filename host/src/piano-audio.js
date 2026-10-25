export function createPianoAudio(){
 let audio,master;
 async function unlock(){
  audio??=new AudioContext();
  if(!master){master=audio.createGain();master.gain.value=.35;const limiter=audio.createDynamicsCompressor();master.connect(limiter);limiter.connect(audio.destination);}
  await audio.resume();
 }
 if(typeof window!=='undefined'){
  addEventListener('pointerdown',()=>void unlock());
  addEventListener('keydown',()=>void unlock());
 }
  function note(midi){
    if(!audio||audio.state!=='running')return;
    const now=audio.currentTime,f=440*2**((midi-69)/12);
    for(let h=1;h<=8;h++){
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.frequency.value=f*h*Math.sqrt(1+.00012*h*h);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.32/(h*h),now+.005);
      gain.gain.exponentialRampToValueAtTime(.0001,now+Math.max(.25,2.8/h));
      oscillator.connect(gain);gain.connect(master);oscillator.start(now);oscillator.stop(now+3);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
    const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

  }
return note;
}
