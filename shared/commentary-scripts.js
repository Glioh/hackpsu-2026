export const VOICES = { a: 'Jacks Dad', b: 'Jacks Dad' };
export const SCRIPTS = [];
function add(event, team, variants) {
  variants.forEach(([speaker,text],i) => SCRIPTS.push({id:`${event}-${team || 'any'}-${i}`,event,team,speaker,text,intensity:event==='ring_out'?5:3,offset:0,version:1}));
}
for (const team of ['red','blue']) {
 const name=team==='red'?'Red':'Blue';
 add('heavy_hit',team,[['a',`${name} lands a huge uppercut!`],['b',`${name} puts some weight behind that one.`]]);
 add('pressure_run',team,[['a',`${name}: three unanswered hits!`],['b',`${name} is keeping the pressure on.`]]);
 add('counter_swing',team,[['b',`${name} answers with two of their own!`],['a',`${name} turns the pressure around!`]]);
 add('hazard_impact',team,[['a',`${name} gets caught by the arena!`],['b',`${name}: the scenery hits back.`]]);
 add('ring_out',team,[['a',`${name} wins! The other team goes over the edge!`],['b',`${name} takes the round!`]]);
 add('train_finish',team,[['a',`${name} wins after that train collision!`],['b',`${name} takes it. The train had the final word.`]]);
}
add('round_start',null,[['a','Two bodies, four operators. Let the brawl begin!'],['b','Arms and legs, please coordinate your opening statement.']]);
add('trade',null,[['a','Both uppercuts connect!'],['b','An exchange of strongly held opinions.']]);
add('double_fall',null,[['a','Both go over! This round is a draw!'],['b','A draw. Equal commitment to the wrong direction.']]);
add('quiet_brawl',null,[['b','Four people. Two bodies. No motion carried.'],['a','I once waited this long for an opening. Worth every second.'],['b','The legs and arms are still in negotiations.']]);
// Scoped IDs leave existing clips stable when new arena or fighter lines are added.
function scoped(event,team,scope,lines) {
 const tag=Object.values(scope).join('-');
 lines.forEach((text,i)=>SCRIPTS.push({id:`${event}-${team||'any'}-${tag}-${i}`,event,team,...scope,speaker:i%2?'b':'a',text,intensity:3,offset:0,version:1}));
}
const arenas={
 classic:[['Classic Ring. Solid ground, open edges. Tonight the floor has an alibi.','No traps, no excuses. Just four people trying to agree on a direction.'],['That floor is staying put. Somebody else needs to move.','Classic Ring: the only moving hazard is your teammate.'], 'Clean ring-out. No scenery required.'],
 ice:[['Welcome to the Ice Rink. Brakes are not included.','On this ice, every shove comes with free delivery to the edge.'],['All that ice and nobody brought skates. Excellent planning.','Momentum has custody of this match now.'], 'Slid straight out of contention. That ice does not forgive.'],
 quake:[['Earthquake Arena. These rock shelves are about to have a disagreement.','A fractured summit, four operators. Watch the tremors before the mountain pulls apart.'],['The mountain is splitting up faster than these teams can coordinate.','Those rock shelves are not signing a long-term lease.'], 'Off the summit! The mountain keeps its title.'],
 skyline:[['Skyline Rooftop. Stairs, ramps, and a very long trip down.','Tonight we settle this above the city. Please keep all grudges away from the open edges.'],['Rooftop utilities provide cover. They do not provide a parachute.','Somewhere below, a building manager is updating the insurance policy.'], 'Sent off the rooftop. That is one way to leave the building.'],
 station:[['Crossline Station. Watch the warning signals. These trains do not stop for boxing.','Terraces, a transfer bridge, and two very active tracks. Mind the gap and your opponent.'],['Those amber signals mean move. The train will not wait for negotiations.','A footbridge is available. Standing on the tracks remains a terrible shortcut.'], 'Departing Crossline Station, with no return ticket.'],
 mountain:[['Cloudpeak Dojo. Stone terraces above the clouds, with cliffs below every bad decision.','Welcome to Cloudpeak. Training obstacles, mountain air, and absolutely no safety net.'],['Those training dummies have better footwork than this.','The dojo offers enlightenment. The cliff offers a much shorter lesson.'], 'Off Cloudpeak! That lesson ended below the clouds.'],
 twinspire:[['Twinspire. Two skyscrapers, two skybridges, one argument that will not stay on its own roof.','Opposite towers tonight. Cross the bridge before you try to cross your opponent.'],['Two entire rooftops and somehow the argument is still on the bridge.','The skybridges have fences. The rest of the roof makes no promises.'], 'One tower too far. Twinspire claims another commuter.'],
 piano:[['Forte Grand Piano. Eighty-eight playable keys, and tonight we are hitting more than notes.','A concert grand becomes a fight club. Watch the sharps and the edge of the case.'],['Someone play a chord. This silence is in the wrong key.','The black keys are steps. The edge of the piano is not an encore.'], 'Off the piano! A very abrupt finale.'],
 archery:[['Bullseye Brawl. A giant target, incoming arrows. Do not stand in the marked circles.','The archers are aiming from above. Your opponent is only half the problem.'],['Those circles are landing zones, not reserved seating.','On a giant bullseye, standing still is a bold tactical statement.'], 'Off the target. Somehow still not a miss.'],
 sumo:[['Sumo Laser Arena. Three giant champions are taking aim. Watch the marked spots.','Open sumo stage, incoming lasers. This tournament has unusual referees.'],['Those giant champions are lining up a shot. Pick somewhere else to stand.','The marked spots are a warning, not a spotlight audition.'], 'Out of the sumo stage. The giants are unimpressed.'],
 tiles:[['Disappearing Tiles. If the floor starts blinking, take the hint.','The tiles come back. Your chance to stand on them may not.'],['A blinking tile is not asking for a dance partner.','The floor is taking breaks. Perhaps try walking before its next one.'], 'Gone through the tiles! The floor will be back without you.'],
 split:[['Splitting Floor. The arena opens up, then slams shut. Choose your side carefully.','Two halves of a floor, two halves of a brain per fighter. This should go beautifully.'],['That gap is growing. Please conclude the meeting on one side.','The floor is doing the splits. Neither fighter looks qualified to follow.'], 'Lost to the split! That gap settled the argument.'],
 platforms:[['Moving Platforms. A small island and drifting floors. Time your crossings.','Tonight even the ground has somewhere else to be. Stay aboard.'],['The next platform is drifting past. Missing it is not a travel strategy.','Small island, big personal space issues.'], 'Missed the connection! The platforms keep moving.'],
 lava:[['Lava Floor. Watch those eruptions. The ground is about to get personal.','Tonight the floor really is lava. Childhood prepared nobody for the uppercuts.'],['Those lava bursts are not central heating.','Keep moving. The floor is preheating the next mistake.'], 'Out of the frying pan and out of the arena.'],
 falling:[['Falling Platform Arena. These tiles crumble underfoot, and they never come back.','Every step spends a little floor. Make this round count before the arena runs out.'],['That tile is a one-way ticket. Standing still will not extend it.','The floor budget is shrinking. So is the room for negotiation.'], 'Down with the platform! No replacement tiles on order.'],
 conveyor:[['Factory chaos. The belts carry you toward the edge, then reverse. Watch your footing.','Welcome to the factory. Please keep hands, feet, and unresolved grudges off the conveyor.'],['The belt has changed direction. Has anyone told the legs?','That conveyor is working harder than either team.'], 'Removed from the production line. Quality control is brutal.'],
};
for(const [map,[intros,quiet,finish]] of Object.entries(arenas)){
 scoped('round_start',null,{map},intros);
 scoped('quiet_brawl',null,{map},quiet);
 for(const team of ['red','blue'])scoped('ring_out',team,{map},[`${team==='red'?'Red':'Blue'} takes it! ${finish}`]);
}
const characters={
 tung:[['Tung Tung Sahur brought the bat. The meme has entered the building.','That is a wooden fighter carrying more wood. Tung Tung Sahur believes in a theme.'],['Tung Tung Sahur connects! That knock was not a courtesy call.','The walking log is handing out splinters and regrets.'],'Tung Tung Sahur keeps knocking. Nobody is answering.','Tung Tung Sahur answers back. The meme has a second act.','Tung Tung Sahur wins. That is going on the internet.'],
 bubbles:[['Captain Bubbles is a goldfish piloting a diving suit. The captain has left the bowl.','A fish in a captain hat, inside a walking suit. Captain Bubbles runs a complicated ship.'],['Captain Bubbles connects! Small fish, enormous personal problem.','That diving suit packs more than water pressure.'],'Captain Bubbles keeps the pressure up. All hands on deck.','Captain Bubbles fights back. This ship is not sinking yet.','Captain Bubbles wins. The smallest captain takes the biggest bow.'],
 crank:[['Crank brought a shell and an oversized pincer. Subtlety stayed at the beach.','A nervous hermit crab in a brawl. Crank would like this settled outside the shell.'],['Crank connects with the pincer! That is not a handshake.','Crank comes out of the shell swinging.'],'Crank keeps pinching away at the opposition.','Crank snaps back. Never mistake nerves for surrender.','Crank wins. Finally, some peace and quiet in that shell.'],
 squish:[['Sir Squish has arrived. Soft body, extremely firm intentions.','Sir Squish looks cuddly. Please submit hug requests after the fighting.'],['Sir Squish connects! That softness is deeply misleading.','A very squishy fighter delivers a very solid objection.'],'Sir Squish keeps pressing. Soft does not mean gentle.','Sir Squish bounces back with an answer.','Sir Squish wins. Soft landing unavailable for the opposition.'],
 bonk:[['Bonk-3000 is online. Please ignore the loose bolts.','Homemade robot, dryer-hose limbs. Bonk-3000 passed an extremely generous inspection.'],['Bonk-3000 connects! Percussive maintenance on the opposition.','That homemade hardware just delivered a factory-strength problem.'],'Bonk-3000 keeps working. Apparently the warranty covers this.','Bonk-3000 reboots the argument with a counterattack.','Bonk-3000 wins. Assembly instructions clearly optional.'],
 nik:[['Nik brought the hoodie, the hair, and a suspicious amount of confidence.','Big hair, big gloves. Nik looks ready to turn confidence into contact.'],['Nik connects! The smirk is starting to look justified.','That hoodie does not soften the hit.'],'Nik keeps pressing. Confidence is getting expensive for the other team.','Nik answers back. The smirk survives another exchange.','Nik wins. Somehow the hair survived too.'],
 toast:[['Toast Malone is in the ring. Golden crust, boxing gloves, no breakfast plans.','Sentient toast has entered a contact sport. Watch for crumbs.'],['Toast Malone connects! That one came with extra crunch.','A slice of toast just served a full-course uppercut.'],'Toast Malone keeps cooking. The pressure is well done.','Toast Malone answers back. Still some fight in that crust.','Toast Malone wins. Breakfast is served.'],
 conehead:[['Conehead brought the traffic cone and the high-visibility vest. This is now a work zone.','Please observe the safety cone. Conehead certainly makes that difficult to avoid.'],['Conehead connects! Consider that a construction notice.','High visibility, high impact. Conehead makes a point.'],'Conehead keeps working. This demolition is ahead of schedule.','Conehead answers back. The work zone is expanding.','Conehead wins. Site cleared, inspection failed.'],
};
for(const [fighter,[intros,hits,pressure,counter,finish]] of Object.entries(characters)){
 scoped('round_start',null,{fighter},intros);
 for(const team of ['red','blue']){
  scoped('heavy_hit',team,{fighter},hits);
  scoped('pressure_run',team,{fighter},[pressure]);
  scoped('counter_swing',team,{fighter},[counter]);
  scoped('ring_out',team,{fighter},[finish]);
 }
}
for(const team of ['red','blue']){
 const name=team==='red'?'Red':'Blue';
 for(const [hazard,lines] of Object.entries({
  train:[`${name} gets caught by the train! Mind the warning signals.`,`${name} caught the express. No ticket, no brakes.`],
  arrow:[`${name} gets hit by an arrow! That marked circle was a warning.`,`${name} caught in the landing zone. Bullseye.`],
  laser:[`${name} takes a laser! The giant champion found the target.`,`${name} stayed in the marked spot too long.`],
  lava:[`${name} gets launched by a lava burst!`,`${name} found the hot spot. Literally.`],
  quake:[`${name} gets shaken by the mountain!`,`${name} caught in the tremor. Watch those shelves.`],
 }))scoped('hazard_impact',team,{hazard},lines);
}
export const scriptById = id => SCRIPTS.find(s=>s.id===id);
