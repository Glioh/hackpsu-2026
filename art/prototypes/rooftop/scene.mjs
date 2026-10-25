import * as T from 'three';

// Concept geometry only. No gameplay, physics, or application integration.
export function createRooftop() {
  const root = new T.Group(); root.name = 'SKYLINE / rooftop arena concept';
  const mats = new Map();
  function material(color) { if (!mats.has(color)) mats.set(color,new T.MeshStandardMaterial({color,roughness:.78})); return mats.get(color); }
  function box(name,x,y,z,w,h,d,color,parent=root) {
    const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(color)); m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function cylinder(name,x,y,z,r,h,color,r2=r,parent=root) {
    const m=new T.Mesh(new T.CylinderGeometry(r2,r,h,24),material(color));m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const concrete='#aeb7b0', dark='#35474c', teal='#4e8f88', orange='#ec9e55';
  box('Tower facade',0,-10.2,0,30,20,24,'#687a80');
  for(let y=-18;y<-1;y+=2.3) for(let x=-13;x<14;x+=2.5) {
    box('Front recessed window',x,y,12.025,1.35,1.25,.08,'#a5c9bd');
    box('Rear recessed window',x,y,-12.025,1.35,1.25,.08,'#a5c9bd');
  }
  for(let y=-18;y<-1;y+=2.3) for(let z=-10;z<11;z+=2.5) for(const x of [-15.025,15.025]) box('Side window',x,y,z,.08,1.25,1.35,'#a5c9bd');
  box('Oversailing roof slab',0,-.25,0,31,.65,25,concrete);
  box('Roof membrane',0,.105,0,29.9,.08,23.9,'#788c88');
  // Roof structure is the arena: staggered terraces with routes through and over utilities.
  for(let x=-14;x<=14;x+=2) box('Membrane seam',x,.151,0,.025,.008,23,'#637c76');
  for(let z=-10;z<=10;z+=2) box('Membrane seam',0,.152,z,29,.008,.025,'#637c76');
  function terrace(name,x,z,w,d,top) {
    box(name,x,(top+.15)/2,z,w,top-.15,d,'#7b918c');
    box(name+' coping',x,top,z,w+.16,.16,d+.16,concrete);
    for(const xx of [x-w/2,x+w/2])box('Terrace safety edge',xx,top+.09,z,.1,.035,d,orange);
  }
  function ramp(name,x,z,w,length,top) {
    const shape=new T.Shape();shape.moveTo(-length/2,.15);shape.lineTo(length/2,.15);shape.lineTo(-length/2,top);shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:w,bevelEnabled:false});
    geometry.rotateY(-Math.PI/2);geometry.translate(x+w/2,0,z);
    const m=new T.Mesh(geometry,material('#899d95'));m.name=name;m.castShadow=true;m.receiveShadow=true;root.add(m);
    // Top rises toward the back (negative Z).
    for(const xx of [x-w/2+.1,x+w/2-.1]) {
      const stripe=box('Ramp edge marking',xx,(top+.15)/2+.04,z,.08,.03,Math.hypot(length,top-.15),orange);
      stripe.rotation.x=Math.atan2(top-.15,length);
    }
  }
  terrace('West roof terrace',-6,0,6.5,6.5,1.65);
  terrace('East mechanical terrace',5,-1.6,6,5.4,2.65);
  ramp('West access incline',-6,5,3,3.5,1.65);
  // Broad staircase climbs from the lower front lane onto the east terrace.
  for(let i=0;i<7;i++) {
    const top=.15+(i+1)*2.5/7;
    box('East terrace stair',5,(top+.15)/2,4.5-i*.55,3,top-.15,.55,concrete);
    box('Stair tread marking',5,top+.015,4.72-i*.55,3,.025,.075,orange);
  }
  box('Connecting maintenance bridge',-.45,1.61,-1.8,4.7,.24,2.1,dark);
  for(let x=-2.7;x<1.9;x+=.22)box('Bridge grating',x,1.75,-1.8,.07,.035,2.1,'#aeb7b0');
  // Small step-up connects the bridge's lower end to the higher terrace.
  for(let i=0;i<3;i++)box('Bridge step-up',1+i*.45,1.83+i*.32,-1.8,.45,.2,2.1,concrete);
  // Obstacles sit in the traversable middle, not only around the perimeter.
  box('West rooftop air handler',-6,2.55,-.6,3.1,1.65,2.2,'#b6c6bb');
  for(let i=0;i<8;i++)box('Air handler grille',-6,1.95+i*.15,.515,2.6,.055,.035,dark);
  cylinder('Air handler top fan',-6,3.44,-.6,.8,.1,dark);
  for(let i=0;i<4;i++){const blade=box('Air handler fan cross',-6,3.5,-.6,1.4,.035,.08,'#8ca69b');blade.rotation.y=i*Math.PI/4;}
  box('East raised duct obstacle',4.8,3.25,-2.7,4.2,1.1,1.3,teal);
  box('Duct return elbow',6.2,3.7,-2.7,1.3,1.8,1.3,teal);
  for(let i=0;i<6;i++)box('Duct reinforcement band',3+i*.65,3.25,-2.7,.07,1.16,1.36,dark);
  // Angled skylights interrupt the lower lane and provide low jumpable cover.
  for(const [x,z] of [[-1,5.6],[9,5.8]]) {
    box('Skylight curb',x,.48,z,2.5,.65,3.6,dark);
    const glass=box('Sloped skylight glazing',x,1.03,z,2.35,.12,3.4,'#7cb4b8');glass.rotation.x=.23;
    for(const xx of [x-1.15,x,x+1.15]){const frame=box('Skylight mullion',xx,1.11,z,.065,.06,3.45,concrete);frame.rotation.x=.23;}
    for(const zz of [-1.65,0,1.65])box('Skylight cross frame',x,1.11-Math.sin(.23)*zz,z+zz,2.4,.06,.07,concrete);
  }
  box('Low pipe crossing',-.4,.7,-4,4.5,.65,.8,teal);
  for(const x of [-2.2,1.4])box('Pipe support',x,.4,-4,.35,.5,1,dark);
  for(const [x,z] of [[-9,6.8],[9.4,.2]]) {
    cylinder('Exhaust plinth',x,.4,z,.8,.5,dark);
    cylinder('Exhaust obstacle',x,1.15,z,.48,1.3,'#a7bbb2');
    cylinder('Mushroom vent cap',x,1.85,z,.8,.18,concrete);
  }
  for(const x of [-14.9,14.9]) box('Side parapet',x,.64,0,.35,1.1,24,concrete);
  box('Rear parapet',0,.64,-11.9,30,1.1,.35,concrete);
  // Broken front parapet makes the height and ring-out edge readable.
  for(const x of [-11.6,11.6]) box('Front parapet wing',x,.64,11.9,6.6,1.1,.35,concrete);
  box('Exposed ring-out lip',0,.15,11.9,16,.18,.45,orange);
  for(let x=-7.5;x<8;x+=.8) {const m=box('Warning stripe',x,.25,11.9,.24,.015,.42,dark);m.rotation.y=.45;}
  box('Service penthouse',-8.5,2.25,-8.1,8.5,4.2,5.2,'#b8b9a4');
  box('Penthouse roof coping',-8.5,4.43,-8.1,9,.25,5.7,concrete);
  box('Access door',-7.5,1.65,-5.47,1.6,2.9,.1,teal);
  box('Door inset',-7.5,2.15,-5.39,1,.6,.04,'#a4c9c1');
  cylinder('Door handle',-6.97,1.5,-5.28,.055,.25,orange);
  box('Exit light',-7.5,3.4,-5.35,1,.25,.22,'#d8e8ad');
  for(let i=0;i<5;i++) box('Access stair',-3.1,.2+i*.18,-7.8+i*.6,2.1,.25+i*.36,.6,concrete);
  box('Raised service deck',7.8,.7,-8.2,9,1.1,5.2,dark);
  for(const x of [5.2,8.4]) {
    box('HVAC housing',x,1.9,-8.3,2.55,1.5,3,'#b6c6bb');
    cylinder('Fan rim',x,2.69,-8.3,.92,.12,dark);
    cylinder('Fan hub',x,2.78,-8.3,.19,.08,concrete);
    for(let i=0;i<6;i++){const blade=box('Fan blade',x,2.76,-8.3,1.55,.035,.12,'#758b84');blade.rotation.y=i*Math.PI/3;}
    for(let i=0;i<6;i++)box('Vent grille',x,1.55+i*.13,-6.78,2,.045,.03,dark);
  }
  box('Vent duct',11.2,1.65,-9,1.4,1.7,1.4,'#79948e');
  box('Vent elbow',11.2,2.35,-8.4,1.4,.5,2.6,'#79948e');
  // Water tower on the penthouse, with legs and banded wooden tank.
  for(const x of [-11,-8.4])for(const z of [-9.3,-6.7]) cylinder('Tank steel leg',x,5.35,z,.09,1.65,dark);
  cylinder('Wood water tank',-9.7,7.3,-8,1.8,2.6,'#b37f52');
  for(const y of [6.3,7.25,8.3])cylinder('Tank steel band',-9.7,y,-8,1.84,.1,dark);
  cylinder('Tank conical roof',-9.7,8.95,-8,2.02,.85,dark,0);
  for(let y=4.7;y<8.6;y+=.38)box('Ladder rung',-11.62,y,-8,.08,.065,.7,dark);
  for(const z of [-8.38,-7.62])box('Ladder rail',-11.62,6.55,z,.07,4.2,.07,dark);
  // Social / maintenance dressing outside the fighting lane.
  for(const z of [-1.5,3.2,7.9]) {
    box('Planter trough',-12.6,.65,z,1.65,1,3,'#bdad8e');
    box('Soil',-12.6,1.17,z,1.4,.06,2.75,'#4f6053');
    for(let i=0;i<5;i++) {const bush=new T.Mesh(new T.IcosahedronGeometry(.62,1),material(i%2?'#6e976c':'#91a574'));bush.position.set(-12.6,1.5,z-1+i*.5);bush.scale.y=.7;root.add(bush);}
  }
  for(const z of [0,5]) {
    box('Bench seat',12.5,.8,z,1.2,.18,2.8,'#b88859');
    for(const zz of [z-.9,z+.9])box('Bench footing',12.5,.43,zz,.8,.6,.16,dark);
  }
  for(const x of [-13.7,13.7])for(const z of [-10.8,10.8]) {
    cylinder('Roof light mast',x,2.6,z,.06,5,dark);
    box('Area luminaire',x,5.1,z,.75,.15,.45,'#f2dcac');
  }
  cylinder('Antenna mast',-5.9,6,-9.8,.045,3.2,dark);
  for(const y of [5.2,5.8,6.4])box('Antenna crossbar',-5.9,y,-9.8,1.8,.045,.045,dark);
  for(const z of [-3,7]) {cylinder('Vent stack',13.1,.65,z,.25,.9,dark);cylinder('Vent cap',13.1,1.15,z,.4,.12,concrete);}
  // Stylized scale references, not playable fighters.
  for(const [x,color] of [[-4,'#ea7865'],[4,'#78b9ce']]) {
    const body=new T.Mesh(new T.CapsuleGeometry(.38,.65,4,10),material(color));body.position.set(x,1.25+(x<0?1.5:0),x<0?1.5:7.5);body.name='Fighter scale mannequin';root.add(body);
    cylinder('Mannequin head',x,2+(x<0?1.5:0),x<0?1.5:7.5,.29,.45,color);
    for(const dx of [-.22,.22])box('Mannequin leg',x+dx,.53+(x<0?1.5:0),x<0?1.5:7.5,.22,.6,.25,dark);
  }
  return root;
}

export function createCity() {
  const city=new T.Group();city.name='Surrounding skyline / presentation context';
  let seed=21; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<65;i++) {
    const angle=rnd()*Math.PI*2,dist=38+rnd()*85,h=10+rnd()*42,w=6+rnd()*9,d=6+rnd()*9;
    const b=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:new T.Color().setHSL(.48+rnd()*.07,.09,.25+rnd()*.15),roughness:1}));
    b.position.set(Math.cos(angle)*dist,-24+h/2,Math.sin(angle)*dist);b.castShadow=true;b.receiveShadow=true;city.add(b);
    for(let y=3;y<h-2;y+=3.1)for(let x=-w/2+1;x<w/2-1;x+=2) {
      const win=new T.Mesh(new T.PlaneGeometry(.7,1),new T.MeshBasicMaterial({color:rnd()>.5?'#b5b899':'#6d8883'}));win.position.set(b.position.x+x,-24+y,b.position.z+d/2+.02);city.add(win);
    }
  }
  return city;
}
