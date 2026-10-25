// Simulation time only: paused frames never advance these windows.
export class CommentaryDetector {
  reset(round) { this.round=round; this.time=0; this.seq=0; this.lastContact=0; this.quietAt=-30; this.run=null; this.reversal=null; this.history=[]; this.finished=false; }
  constructor() { this.reset(0); }
  event(type,team,evidence={}) { return {id:`${this.round}:${++this.seq}`,round:this.round,time:this.time,type,team,evidence,priority:({ring_out:100,train_finish:100,double_fall:100,hazard_impact:80,counter_swing:60,pressure_run:50,trade:50,heavy_hit:40,round_start:30,quiet_brawl:10})[type],expires:this.time+(type.includes('finish')||type==='ring_out'||type==='double_fall'?8:type==='pressure_run'||type==='counter_swing'?3:1.5)}; }
  step(events,winner,dt,fighters=[]) {
    if(this.finished)return [];
    this.time+=dt;
    const hits=events.filter(e=>e.type==='hit');
    this.history.push(...hits.map(e=>({...e,time:this.time})));this.history=this.history.filter(e=>this.time-e.time<8).slice(-80);
    if(winner){this.finished=true;const loser=winner==='red'?'blue':'red';const last=this.history.filter(e=>e.team===loser).at(-1);return [this.event(winner==='draw'?'double_fall':last?.source==='hazard'&&last.hazard==='train'&&this.time-last.time<1.5?'train_finish':'ring_out',winner,{latestImpulse:last})];}
    const out=[];if(hits.length)this.lastContact=this.time;
    const combat=hits.filter(e=>e.source==='fighter'&&['red','blue'].includes(e.attacker)&&e.attacker!==e.team);
    const trade=new Set(combat.map(e=>e.attacker)).size===2;
    if(trade){out.push(this.event('trade',null,{hits:combat}));this.run=null;this.reversal=null;}
    else for(const hit of combat){
      if(this.run?.team!==hit.attacker){
        const previous=this.run;
        // Any opposing punch breaks the previous unanswered reply sequence.
        this.reversal=previous?.announced&&this.time-previous.last<=5
          ? {team:hit.attacker,start:previous.last,count:0}:null;
        this.run={team:hit.attacker,times:[],announced:false,last:this.time};
      }
      this.run.times=this.run.times.filter(time=>this.time-time<=4);
      this.run.times.push(this.time);this.run.last=this.time;
      if(this.reversal?.team===hit.attacker){this.reversal.count++;if(this.reversal.count===2&&this.time-this.reversal.start<=5)out.push(this.event('counter_swing',hit.attacker,{hits:2}));}
      if(this.run.times.length>=3&&!this.run.announced){this.run.announced=true;out.push(this.event('pressure_run',hit.attacker,{hits:3}));}
      else if(hit.damage>=15)out.push(this.event('heavy_hit',hit.attacker,{hit}));
    }
    for(const hit of hits)if(hit.source==='hazard'){this.run=null;this.reversal=null;out.push(this.event('hazard_impact',hit.team,{hazard:hit.hazard,hazardId:hit.hazardId}));}
    if(!hits.length&&fighters.every(f=>f.grounded&&!f.stun)&&this.time-this.lastContact>=10&&this.time-this.quietAt>=30){this.quietAt=this.time;out.push(this.event('quiet_brawl',null));}
    return out;
  }
}

export class CommentaryDirector {
  constructor({play,stop=()=>{},caption=()=>{},clock=()=>0}){Object.assign(this,{play,stop,caption,clock});this.recent=[];this.reset(0);}
  reset(round,context={}){this.cancel();this.round=round;this.context=context;this.pending=null;this.nextAt=0;this.paused=false;}
  cancel(){this.generation=(this.generation||0)+1;this.abort?.abort();this.stop();this.busy=false;this.pending=null;this.caption('');}
  offer(event){if(this.paused||event.round!==this.round)return;if(event.priority===100){this.cancel();this.nextAt=0;}if(!this.pending||event.priority>=this.pending.priority)this.pending=event;}
  async tick(scripts){
    const event=this.pending,now=this.clock();if(!event||this.busy||this.paused)return;
    if(event.expires<now){this.pending=null;return;}if(now<this.nextAt)return;
    this.pending=null;const {map,fighters={}}=this.context;
    const options=scripts.filter(s=>s.event===event.type&&s.team===(event.team==='draw'?null:event.team)
      &&(!s.map||s.map===map)&&(!s.fighter||(event.team?fighters[event.team]===s.fighter:Object.values(fighters).includes(s.fighter)))
      &&(!s.hazard||s.hazard===event.evidence?.hazard));
    // Exhaust fresh lines before repeating; prefer arena/character detail among equally fresh choices.
    const freshness=s=>this.recent.lastIndexOf(s.id);
    const specific=s=>Number(!!(s.map||s.fighter||s.hazard));
    const script=options.slice().sort((a,b)=>freshness(a)-freshness(b)||specific(b)-specific(a)
      ||Number(a.speaker===this.lastSpeaker)-Number(b.speaker===this.lastSpeaker))[0];if(!script)return;
    this.lastSpeaker=script.speaker;
    this.recent.push(script.id);this.recent=this.recent.slice(-128);this.busy=true;const generation=this.generation;this.abort=new AbortController();
    this.caption(script.text,script.speaker);
    try{await this.play(script,event,this.abort.signal);}catch{/* Audio is optional. */}
    finally{if(generation===this.generation){this.busy=false;this.nextAt=this.clock()+2;this.caption('');}}
  }
}
