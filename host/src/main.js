import { createWinnerView } from './winner-view.js';
import { createCombatAudio } from './combat-audio.js';
import { createCommentary } from './commentary-audio.js';
import { Simulation } from './simulation.js';
import { createRenderer } from './render.js';
import { CONFIG as C } from '../../shared/config.js';
import { connectSocket } from '../../shared/connection.js';
import { CHARACTERS, matchRules, rollFrame } from '../../shared/party.js';
import { choiceCard, updateChoices } from '../../shared/selection-view.js';
import { createMotion, resetMotion, stepMotion, interpolateMotion } from './motion.js';
import { createPresentation } from './presentation.js';
import { MAPS } from '../../shared/maps.js';
import { createBotController } from './bot.js';
import { FINISH_DURATION, FINISH_TIME_SCALE, stepFinish } from './ko-finish.js';
const $ = id => document.getElementById(id), socket = connectSocket(), sim = new Simulation();
const commentary = createCommentary(socket), combatAudio = createCombatAudio(), presentation = createPresentation($('gameScreen'));
let draw, motions = [], renderFighters = [];
let roomCode = '', phase = 'lobby', debug = false, match = null, selection = null, slots = [], ready = false;
let serverOffset = 0, mapPreview = false, finishAge = null, visualTime = 0, introUntil = 0, lastCountdown = '';
const winnerView = createWinnerView($('winnerSprite'));
const snapshots = new Map(), keys = new Set(), edges = new Set(), bot = createBotController();
let previous = performance.now(), accumulator = 0;
try { draw = createRenderer($('arena'), (i, rig) => sim.setCombatRig(i, rig)); }
catch { $('arena').textContent = 'WebGL is unavailable. Open the host in a browser with hardware acceleration.'; }
function resetPoses() { motions = sim.fighters.map(createMotion); renderFighters = motions.map(m => m.output); draw?.resetMotion(); }
resetPoses();
function clearFinish() { finishAge = null; introUntil = 0; draw?.clearKO(); $('faceoff').classList.add('hidden'); }
function error(message) { $('error').textContent = message || ''; }
function updateURL() {
  let origin;
  try { const url = new URL($('origin').value.trim() || location.origin); if (!['https:', 'http:'].includes(url.protocol)) throw Error(); origin = url.origin; }
  catch { return error('Enter a valid HTTP(S) origin.'); }
  const url = `${origin}/controller?room=${roomCode}`;
  $('qr').src = '/qr?url=' + encodeURIComponent(url); $('joinlink').href = url;
  $('httpsNote').textContent = origin.startsWith('https:') ? 'HTTPS join URL. Open it on every phone.' : 'Use a deployed HTTPS origin or secure tunnel for phone motion access.';
}
$('origin').value = localStorage.getItem('brawl-origin') || location.origin;
$('setOrigin').onclick = () => { localStorage.setItem('brawl-origin', $('origin').value); updateURL(); };
socket.on('connect', () => socket.emit('room:create', {}, p => {
  if (p.error) return error(p.error); roomCode = p.roomCode; $('code').textContent = roomCode; error(''); updateURL();
}));
socket.on('disconnect', () => {
  phase = 'lobby'; slots = []; ready = false; snapshots.clear(); clearFinish(); syncScreen(); renderRoster();
  presentation.setPhase(phase); error('Connection lost. Reconnecting creates a new room; phones must rejoin.');
});
function kickButton(slot) {
  const button = document.createElement('button'); button.className = 'secondary kick-player'; button.textContent = '×';
  button.setAttribute('aria-label', `Remove ${slot.name}`);
  button.onclick = () => socket.emit('player:kick', { key: slot.id }, result => { if (result.error) error(result.error); }); return button;
}
function renderRoster() {
  const count = slots.filter(s => s.connected).length, valid = count >= 4 && count % 2 === 0;
  $('playerCount').textContent = `${count} ${count === 1 ? 'PLAYER' : 'PLAYERS'}`;
  $('start').disabled = !valid || !socket.connected;
  $('start').textContent = valid ? 'Everybody in? Start' : count >= 4 ? 'One more player needed' : 'Waiting for players';
  $('lobbyHint').textContent = valid ? (() => { const r = matchRules(count); return r.mode === 'ffa' ? `${r.count} duos. Free-for-all. One life. Last duo standing wins.` : `${r.count / 2} ${r.count === 2 ? 'duo' : 'duos'} per team. ${r.lives} shared lives each. Pairings revealed after Start.`; })()
    : count >= 4 ? 'Odd player out! Invite one more friend so everyone has a partner.' : 'Bring at least 4 players. Everyone needs a partner.';
  $('roster').replaceChildren(...slots.map(slot => {
    const tile = document.createElement('div'); tile.className = 'player-tile';
    const avatar = document.createElement('span'); avatar.className = 'player-avatar'; avatar.textContent = slot.name[0].toUpperCase();
    const label = document.createElement('div'), name = document.createElement('strong'), status = document.createElement('small');
    name.textContent = slot.name; status.textContent = slot.connected ? 'IN THE CREW' : 'RECONNECTING';
    label.append(name, status); tile.append(avatar, label, kickButton(slot)); return tile;
  }));
  $('resumeGame').disabled = !debug && !ready;
}
socket.on('room:roster', p => { slots = p.slots; ready = slots.length > 0 && slots.every(s => s.connected && s.ready); renderRoster(); if (selection || phase === 'calibrating') renderPreparation(); });
function syncScreen() {
  const setup = !['playing', 'paused', 'results'].includes(phase);
  $('setup').classList.toggle('hidden', !setup); $('gameScreen').classList.toggle('hidden', setup);
  $('gameScreen').classList.toggle('showing-results', phase === 'results');
  if (phase !== 'results') winnerView.hide();
  $('joinStep').classList.toggle('hidden', phase !== 'lobby'); $('preparationStage').classList.toggle('hidden', phase === 'lobby');
  $('joinBanner').classList.toggle('hidden', phase !== 'lobby'); $('pauseOverlay').classList.toggle('hidden', phase !== 'paused'); $('result').classList.toggle('hidden', phase !== 'results');
  $('phase').textContent = phase === 'playing' ? debug ? 'DEVELOPER MATCH' : match?.mode === 'ffa' ? 'FREE-FOR-ALL / LAST DUO STANDING' : 'RED VS BLUE / SHARED LIVES' : phase.toUpperCase();
}
function renderPreparation() {
  const characterStage = phase.startsWith('character');
  $('prepEyebrow').textContent = characterStage ? 'FIND YOUR OTHER HALF' : 'EVERY PHONE GETS A VOTE';
  $('prepTitle').textContent = phase === 'character-select' ? 'PICK YOUR BODY.' : phase === 'character-roll' ? 'LET FATE DECIDE.' : phase === 'map-vote' ? 'WHERE ARE WE DROPPING?' : phase === 'map-roll' ? 'YOUR ARENA AWAITS.' : 'GET A GRIP.';
  $('prepSubtitle').textContent = characterStage ? 'Choose together on your phones. Agree to lock it in. Disagree and we roll.' : phase === 'calibrating' ? 'Enable motion and calibrate every phone. The brawl starts when everyone is ready.' : 'Six arenas. Majority wins. Tied at the top? We roll for it.';
  const container = $('partyChoices'); container.replaceChildren();
  if (characterStage) {
    const grid = document.createElement('div'); grid.className = 'duo-grid';
    for (const fighter of match.fighters) {
      const card = document.createElement('section'); card.className = 'duo-card'; card.dataset.duo = fighter.id; card.style.setProperty('--duo-color', fighter.color);
      const title = document.createElement('h3'); title.textContent = fighter.label;
      const image = document.createElement('img'); image.className = 'duo-portrait'; image.alt = ''; image.hidden = true;
      const picked = document.createElement('strong'); picked.dataset.duoPick = ''; card.append(title, image, picked);
      fighter.players.forEach((id, i) => {
        const row = document.createElement('p'), player = slots.find(s => s.id === id), vote = selection?.votes[id];
        row.textContent = `${player?.name || 'Reconnecting'} · ${i ? 'ARM' : 'LEGS'} · ${CHARACTERS.find(c => c.id === vote)?.name || 'Picking...'}`; card.append(row);
      }); grid.append(card);
    } container.append(grid);
  } else if (selection?.options) {
    const grid = document.createElement('div'); grid.className = 'choice-grid'; grid.append(...selection.options.map(id => choiceCard(id, 'map'))); container.append(grid);
  } else {
    const grid = document.createElement('div'); grid.className = 'duo-grid';
    for (const slot of slots) {
      const card = document.createElement('div'); card.className = 'duo-card'; card.style.setProperty('--duo-color', slot.ready ? '#d5ff61' : '#ffab74');
      const title = document.createElement('h3'); title.textContent = slot.name;
      const status = document.createElement('p'); status.textContent = slot.message; card.append(title, status); grid.append(card);
    } container.append(grid);
  } tickSelection();
}
function tickSelection() {
  if (!selection) { $('selectionClock').textContent = ''; return; }
  const now = Date.now() + serverOffset;
  const clock = phase.endsWith('roll') ? '✦' : String(Math.max(0, Math.ceil((selection.deadline - now) / 1000)));
  if ($('selectionClock').textContent !== clock) $('selectionClock').textContent = clock;
  if (phase.startsWith('character')) for (const fighter of match.fighters) {
    const roll = selection.rolls?.[fighter.id], card = document.querySelector(`[data-duo="${fighter.id}"]`); if (!card) continue;
    const id = roll ? rollFrame(roll, now) : selection.votes[fighter.players[0]] || selection.votes[fighter.players[1]];
    const character = CHARACTERS.find(c => c.id === id), image = card.querySelector('img');
    if (character) { if (!image.src.endsWith(character.portrait)) image.src = character.portrait; image.hidden = false; }
    const label = card.querySelector('[data-duo-pick]'), value = character?.name || 'Waiting for your picks';
    if (label.textContent !== value) label.textContent = value;
    card.classList.toggle('rolling', !!roll);
  } else {
    const counts = {}; for (const vote of Object.values(selection.votes)) counts[vote] = (counts[vote] || 0) + 1;
    updateChoices($('partyChoices'), { counts, roll: selection.roll, now });
  }
}
socket.on('game:state', p => {
  const oldPhase = phase; phase = p.phase; debug = p.debug; match = p.match; selection = p.selection;
  serverOffset = p.serverTime ? p.serverTime - Date.now() : 0; syncScreen();
  if (phase === 'playing' && oldPhase !== 'playing') {
    if (!p.resumed) {
      sim.configureMatch(debug ? null : match); clearFinish(); resetPoses();
      if (match) draw?.configure(match.fighters); else draw?.configure([{ id: 'red', character: 'wukong', color: '#ff665b' }, { id: 'blue', character: 'squish', color: '#63c7ec' }]);
      $('mapName').textContent = MAPS.find(m => m.id === sim.mapId)?.name.toUpperCase();
      introUntil = mapPreview ? 0 : performance.now() + 4150; lastCountdown = '';
      $('faceoffCountdown').textContent = '3';
      $('faceoffTitle').textContent = match?.mode === 'ffa' ? `${match.count} DUOS. ONE SURVIVOR.` : 'RED. BLUE. BRAWL.';
      $('faceoffMap').textContent = MAPS.find(m => m.id === sim.mapId)?.name; $('faceoff').classList.toggle('hidden', !introUntil);
      if (match?.mode !== 'ffa') commentary.phase('playing', false, { map: sim.mapId });
    }
    snapshots.clear(); keys.clear(); edges.clear(); accumulator = 0; previous = performance.now(); error(''); presentation.setPhase(phase); $('gameScreen').focus();
    if (p.resumed && match?.mode !== 'ffa') commentary.phase('playing', true);
  } else if (phase !== 'playing') { introUntil = 0; $('faceoff').classList.add('hidden'); presentation.setPhase(phase); commentary.phase(phase); }
  if (phase === 'paused') { snapshots.clear(); keys.clear(); edges.clear(); $('pauseReason').textContent = `${p.interruption?.key || ''} ${p.interruption?.message || 'Recalibrate every phone to continue.'}`; }
  if (phase === 'results') {
    const winner = match?.fighters.find(f => f.id === p.winner); $('winner').textContent = p.winner === 'draw' ? 'DRAW' : `${winner?.label || p.winner.toUpperCase()} WINS!`;
    const winners = match ? match.fighters.filter(f => p.winner === 'draw' || (match.mode === 'ffa' ? f.id : f.side) === p.winner) : [];
    void winnerView.show(p.winner, ['wukong', 'squish'], winners.length ? winners.map(f => f.character) : undefined);
    $('winner').style.color = winner?.color || (p.winner === 'red' ? '#ff665b' : '#63c7ec');
  }
  if (phase === 'lobby') { clearFinish(); snapshots.clear(); renderRoster(); }
  if (!['lobby', 'playing', 'paused', 'results'].includes(phase)) renderPreparation();
});
function start(isDebug = false) { commentary.unlock(); combatAudio.unlock(); presentation.request(); socket.emit('game:start', { debug: isDebug }, result => { if (result.error) { error(result.error); presentation.setPhase(phase); } }); }
$('start').onclick = () => { mapPreview = false; start(); };
$('debugStart').onclick = () => { mapPreview = false; sim.setMap($('devMap').value); start(true); };
$('devMode').onclick = () => { mapPreview = true; sim.setMap($('devMap').value); start(true); };
$('devMap').replaceChildren(...MAPS.map(m => { const option = document.createElement('option'); option.value = m.id; option.textContent = m.name; return option; }));
const lobby = () => socket.emit('game:state', { phase: 'lobby' });
for (const id of ['cancelSetup', 'leaveGame', 'pauseLobby', 'resultLobby']) $(id).onclick = lobby;
$('rematch').onclick = () => start(debug);
$('resumeGame').onclick = () => { combatAudio.unlock(); presentation.request(); socket.emit('game:resume', {}, p => { if (p.error) $('pauseReason').textContent = p.error; }); };
$('combatSoundEnabled').onchange = e => { combatAudio.setEnabled(e.target.checked); draw?.weaponAudio.setEnabled(e.target.checked); };
$('combatSoundVolume').oninput = e => { combatAudio.setVolume(+e.target.value); draw?.weaponAudio.setVolume(+e.target.value); };
$('showStats').onchange = () => $('stats').classList.toggle('hidden', !$('showStats').checked);
$('motionEnabled').onchange = resetPoses; $('motionPreset').onchange = resetPoses;
addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) edges.add(e.code); keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => { keys.clear(); edges.clear(); });
function keyboard(team) {
  const red = team === 'red', has = k => +keys.has(k), edge = k => { const hit = edges.has(k); edges.delete(k); return hit; };
  return { legs: { moveX: red ? has('KeyD') - has('KeyA') : has('ArrowRight') - has('ArrowLeft'), moveZ: red ? has('KeyW') - has('KeyS') : has('ArrowUp') - has('ArrowDown'), jump: edge(red ? 'Space' : 'KeyI') }, arm: { turn: red ? has('KeyE') - has('KeyQ') : has('KeyL') - has('KeyJ'), punch: edge(red ? 'KeyF' : 'KeyK'), power: 1 } };
}
for (const role of ['legs', 'arm']) socket.on('input:' + role, p => {
  const s = snapshots.get(p.key) || { seq: -1, lastAction: 0, actions: [], p: {}, at: 0 }; if (p.seq <= s.seq) return;
  const action = p[role === 'legs' ? 'jumpId' : 'actId']; if (action > s.lastAction) { s.lastAction = action; s.actions.push(p.power ?? 1); if (s.actions.length > 4) s.actions.shift(); }
  Object.assign(s, { seq: p.seq, p, at: performance.now() }); snapshots.set(p.key, s);
});
function phone(id, now) {
  const result = {};
  for (const role of ['legs', 'arm']) {
    const s = snapshots.get(`${id}:${role}`); if (!s || now - s.at > C.staleMs) { if (s) s.actions = []; result[role] = {}; continue; }
    const action = s.actions.shift(); result[role] = { ...s.p, jump: role === 'legs' && action !== undefined, punch: role === 'arm' && action !== undefined }; if (action !== undefined) result[role].power = action;
  } return result;
}
function livesHUD() {
  if (!['playing', 'paused', 'results'].includes(phase)) return;
  $('livesHud').classList.toggle('hidden', match?.mode === 'ffa'); if (match?.mode === 'ffa') return;
  const max = match?.lives || C.lives;
  for (const side of ['red', 'blue']) {
    let label = $(side + 'Lives'); if (!label) { label = document.createElement('span'); label.id = side + 'Lives'; label.className = side; label.setAttribute('role', 'status'); $('livesHud').append(label); }
    const lives = sim.teamLives?.[side] ?? sim.fighters.find(f => f.team === side)?.lives ?? max;
    const value = `${side.toUpperCase()}  ${'●'.repeat(lives)}${'○'.repeat(max - lives)}`;
    if (label.textContent !== value) { label.textContent = value; label.setAttribute('aria-label', `${side} team: ${lives} of ${max} shared lives remaining`); }
  }
}
function frame(now) {
  const frameDt = Math.max(0, Math.min((now - previous) / 1000, .1)); previous = now; tickSelection();
  if (introUntil && phase === 'playing') {
    const remaining = introUntil - now, elapsed = 4150 - remaining;
    const beat = Math.min(3, Math.floor(elapsed / 1200)), text = ['3', '2', '1', 'START!'][beat];
    if (lastCountdown !== text) { $('faceoffCountdown').textContent = text; lastCountdown = text; combatAudio.countdown(beat === 3); if (beat === 3) commentary.fight(); if (match?.mode !== 'ffa') commentary.countdown(beat); }
    if (remaining <= 0) { introUntil = 0; $('faceoff').classList.add('hidden'); snapshots.clear(); accumulator = 0; }
  }
  const scale = finishAge === null ? 1 : FINISH_TIME_SCALE;
  if (phase === 'playing' && !introUntil) visualTime += frameDt * scale;
  if (phase === 'playing' && finishAge !== null && !document.hidden) {
    finishAge += frameDt; stepFinish(sim, frameDt * scale); motions.forEach((m, i) => stepMotion(m, sim.fighters[i], [], frameDt * scale, $('motionPreset').value, $('motionEnabled').checked));
    if (finishAge >= FINISH_DURATION) { phase = 'results'; socket.emit('game:state', { phase: 'results', winner: sim.winner }); }
  }
  accumulator += frameDt;
  while (accumulator >= C.tick) {
    if (phase === 'playing' && !introUntil && finishAge === null && !document.hidden) {
      const inputs = mapPreview ? {} : debug ? { red: keyboard('red'), blue: $('bot').checked ? bot(sim) : keyboard('blue') } : Object.fromEntries(sim.fighters.map(f => [f.team, phone(f.team, now)]));
      for (const id of sim.step(inputs)) { socket.emit('player:hit', { team: id }); draw?.hit(sim.fighters.find(f => f.team === id), sim.motionEvents.find(e => e.type === 'hit' && e.team === id)); }
      for (const event of sim.motionEvents) combatAudio.event(event);
      const ringouts = sim.motionEvents.filter(e => e.type === 'ringout'); if (ringouts.length) draw?.startKO(ringouts);
      for (const event of sim.motionEvents) if (event.type === 'respawn') { const i = sim.fighters.findIndex(f => f.team === event.team); resetMotion(motions[i], sim.fighters[i]); }
      if (debug || match?.mode === 'teams') {
        const side = id => sim.fighters.find(f => f.team === id)?.side || id;
        commentary.step(match ? { ...sim, fighters: ['red', 'blue'].map(team => {
          const fighters = sim.fighters.filter(f => f.side === team);
          return { team, damage: Math.max(...fighters.map(f => f.damage)), grounded: fighters.every(f => f.grounded), stun: Math.max(...fighters.map(f => f.stun)), lives: sim.teamLives[team] };
        }), motionEvents: sim.motionEvents.map(event => ({ ...event, team: side(event.team), attacker: side(event.attacker) })) } : sim, C.tick);
      }
      motions.forEach((m, i) => stepMotion(m, sim.fighters[i], sim.motionEvents, C.tick, $('motionPreset').value, $('motionEnabled').checked)); if (sim.winner) finishAge = 0;
    } accumulator -= C.tick;
  }
  motions.forEach(m => interpolateMotion(m, phase === 'playing' && finishAge === null ? accumulator / C.tick : 1)); livesHUD();
  if (['playing', 'paused', 'results'].includes(phase)) draw?.(renderFighters, visualTime, sim.fighters, sim.arena, { active: phase === 'playing' && !introUntil, motionEnabled: $('motionEnabled').checked, finishAge, weapons: sim.weapons.state });
  if ($('showStats').checked) $('stats').textContent = sim.fighters.map(f => `${f.team}: X ${f.x.toFixed(2)} Z ${f.z.toFixed(2)} Y ${f.y.toFixed(2)} / ${f.damage}%`).join('\n');
  commentary.tick(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => { if (['playing', 'paused'].includes(phase) && !document.hidden) fetch('/health', { cache: 'no-store' }).catch(() => {}); }, 60000);
document.addEventListener('visibilitychange', () => { previous = performance.now(); accumulator = 0; if (document.hidden && phase === 'playing') { socket.emit('game:pause', {}); snapshots.clear(); keys.clear(); edges.clear(); } });
