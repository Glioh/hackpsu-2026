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
 add('hazard_impact',team,[['a',`${name} gets caught by the train!`],['b',`${name}: that connection was not on the itinerary.`]]);
 add('ring_out',team,[['a',`${name} wins! The other team goes over the edge!`],['b',`${name} takes the round!`]]);
 add('train_finish',team,[['a',`${name} wins after that train collision!`],['b',`${name} takes it. The train had the final word.`]]);
}
add('round_start',null,[['a','Two bodies, four operators. Let the brawl begin!'],['b','Arms and legs, please coordinate your opening statement.']]);
add('trade',null,[['a','Both uppercuts connect!'],['b','An exchange of strongly held opinions.']]);
add('double_fall',null,[['a','Both go over! This round is a draw!'],['b','A draw. Equal commitment to the wrong direction.']]);
add('quiet_brawl',null,[['b','Four people. Two bodies. No motion carried.'],['a','I once waited this long for an opening. Worth every second.'],['b','The legs and arms are still in negotiations.']]);
export const scriptById = id => SCRIPTS.find(s=>s.id===id);
