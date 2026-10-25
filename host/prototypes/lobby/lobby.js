const assets = '/host/assets/ui/';
const fighters = [{id:'crank',name:'Crank',tag:'A LITTLE SHELL. A LOT OF ATTITUDE.'},{id:'squish',name:'Sir Squish',tag:'SOFT BODY. HARD FEELINGS.'},{id:'bonk',name:'Bonk-3000',tag:'BUILT DIFFERENT. MOSTLY BOLTS.'},{id:'nik',name:'Nik',tag:'ALL GLOVES. NO PLAN.'}];
let picks = [0,1], activeTeam = 0, filled = false;
const $ = id => document.getElementById(id);
const join = new URL('/controller',location.origin);
$('qr').src = '/qr?url='+encodeURIComponent(join.href);
$('joinLink').href = join.href;
function render() {
  $('teams').replaceChildren(...picks.map((pick,team)=>{
    const f = fighters[pick], card = document.createElement('article');
    card.className = 'team '+(team?'cyan':'coral');
    card.innerHTML = `<div class="team-top"><span>TEAM ${team?'CYAN':'CORAL'}</span><span>0${team+1}</span></div><button class="fighter-art" aria-label="Change ${team?'Cyan':'Coral'} team fighter"><span class="ghost-name" aria-hidden="true">${f.name}</span><img class="portrait" src="${assets}portraits/${f.id}_portrait.png" alt="${f.name}"><span class="change">CHANGE FIGHTER ↗</span></button><div class="fighter-name"><h3>${f.name}</h3><span>TWO PLAYERS / ONE BODY</span></div><div class="players"><div><span class="role">↔</span><span><b>${team?'JAMIE':'ALEX'}</b><small>LEGS</small></span><span class="ready">● READY</span></div><div class="${filled?'':'empty'}"><span class="role">✳</span><span><b>${filled?(team?'JORDAN':'SAM'):'YOUR OTHER HALF?'}</b><small>ARMS</small></span><span class="ready">${filled?'● READY':'+ JOIN'}</span></div></div>`;
    card.querySelector('button').onclick=()=>showPicker(team);
    return card;
  }));
  $('count').textContent=filled?'4 / 4 PHONES':'2 / 4 PHONES';
  $('hint').textContent=filled?'The crew is here. Pick a body. Share the blame.':'Two more friends, then it’s everybody’s problem.';
  $('continue').textContent=filled?'Choose your fighters ↗':'Preview fighter select ↗';
  renderChoices();
}
function renderChoices(){
  document.querySelectorAll('[data-team]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.team===activeTeam)));
  $('selectionNote').textContent=`Select a card to change ${activeTeam?'Cyan':'Coral'} team’s fighter.`;
  $('choices').replaceChildren(...fighters.map((f,i)=>{
    const b=document.createElement('button');b.className='character';b.setAttribute('aria-pressed',String(picks[activeTeam]===i));
    b.innerHTML=`<img class="card-frame" src="${assets}frames/character_frame_${picks[activeTeam]===i?'selected':'normal'}.svg" alt=""><img class="card-head" src="${assets}portraits/${f.id}_head.png" alt=""><strong>${f.name}</strong><small>${f.tag}</small>`;
    b.onclick=()=>{picks[activeTeam]=i;render();};return b;
  }));
}
function step(index){document.querySelectorAll('[data-step]').forEach(b=>{b.classList.toggle('current',+b.dataset.step===index);b.setAttribute('aria-current',+b.dataset.step===index?'step':'false');});$('picker').hidden=index!==1;$('arenaPreview').hidden=index!==2;}
function showPicker(team=activeTeam){activeTeam=team;step(1);renderChoices();$('picker').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>+b.dataset.step===1?showPicker():step(+b.dataset.step));
document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{activeTeam=+b.dataset.team;renderChoices();});
$('continue').onclick=()=>showPicker();
$('simulate').onclick=()=>{filled=true;render();};
$('reset').onclick=()=>{filled=false;picks=[0,1];activeTeam=0;step(0);render();};
$('palette').onclick=()=>{const dusk=document.body.classList.toggle('dusk');$('palette').setAttribute('aria-pressed',String(dusk));$('palette').textContent=dusk?'Use arcade gradient':'Try dusk gradient';};
render();step(0);
