// Piano-like struck-string synthesis: no downloads or network needed for sound.
export function setupWalking({T,scene,camera,controls,renderer,model}) {
  let audio,master,active=false,previousKey=null,vy=0,grounded=false;
  const held=new Set(),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  const player=new T.Group();scene.add(player);
  const material=new T.MeshStandardMaterial({color:'#e77e69'});
  const body=new T.Mesh(new T.CapsuleGeometry(.32,.85,5,12),material);body.position.y=.95;body.castShadow=true;player.add(body);
  const visor=new T.Mesh(new T.BoxGeometry(.5,.15,.1),new T.MeshStandardMaterial({color:'#182127'}));visor.position.set(0,1.25,-.3);player.add(visor);
  const surfaces=model.root.children.filter(m=>m.isMesh&&!/lid|support|ring|leg|caster|pedal|lyre|Brass string/i.test(m.name));
  function reset(){player.position.set(0,.11,21.5);vy=0;previousKey=null;grounded=true;}
  reset();
  async function enable(){
    if(!active){camera.position.set(player.position.x+12,16,player.position.z+22);controls.target.set(player.position.x,1,player.position.z);controls.update();}
    audio??=new AudioContext();
    if(!master){master=audio.createGain();master.gain.value=.4;const compressor=audio.createDynamicsCompressor();master.connect(compressor);compressor.connect(audio.destination);}
    await audio.resume();active=true;document.querySelector('#play').textContent='Sound on · walk across the keys';
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
    document.querySelector('#note').textContent=`Playing ${names[midi%12]}${Math.floor(midi/12)-1}`;
  }
  document.querySelector('#play').onclick=enable;
  const movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyR'];
  addEventListener('keydown',e=>{
    if(!movement.includes(e.code)||/INPUT|TEXTAREA/.test(e.target.tagName))return;
    e.preventDefault();held.add(e.code);if(!active)void enable();
    if(e.code==='KeyR')reset();
    if(e.code==='Space'&&!e.repeat&&grounded){vy=7;grounded=false;}
  });
  addEventListener('keyup',e=>held.delete(e.code));addEventListener('blur',()=>held.clear());
  const originalColors=new Map(model.keys.map(key=>{key.material=key.material.clone();return [key,key.material.color.clone()];}));
  function update(dt){
    if(!active)return;
    let dx=Number(held.has('KeyD')||held.has('ArrowRight'))-Number(held.has('KeyA')||held.has('ArrowLeft'));
    let dz=Number(held.has('KeyS')||held.has('ArrowDown'))-Number(held.has('KeyW')||held.has('ArrowUp'));
    const length=Math.hypot(dx,dz),speed=held.has('ShiftLeft')||held.has('ShiftRight')?15:8;
    if(length){dx/=length;dz/=length;player.position.x+=dx*speed*dt;player.position.z+=dz*speed*dt;player.rotation.y=Math.atan2(-dx,-dz);}
    ray.set(new T.Vector3(player.position.x,3,player.position.z),down);
    const hit=ray.intersectObjects(surfaces,false)[0];
    vy-=19*dt;player.position.y+=vy*dt;
    grounded=false;
    if(hit&&vy<=0&&player.position.y<=hit.point.y&&player.position.y>=hit.point.y-1.2){player.position.y=hit.point.y;vy=0;grounded=true;}
    if(player.position.y < -12)reset();
    const key=grounded&&hit?.object.userData.key?hit.object:null;
    if(key!==previousKey){
      if(previousKey)previousKey.material.color.copy(originalColors.get(previousKey));
      if(key){key.material.color.set('#e3b65e');note(key.userData.midi);}
      previousKey=key;
    }
    if(length){const target=new T.Vector3(player.position.x,1,player.position.z);const delta=target.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(target);}
  }
  return {player,update,reset,enable};
}
