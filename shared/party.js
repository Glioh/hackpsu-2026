export const CHARACTERS = [
  ['squish', 'Sir Squish'], ['bonk', 'Bonk-3000'], ['toast', 'Toast Malone'],
  ['conehead', 'Conehead'], ['bubbles', 'Captain Bubbles'], ['wukong', 'Wukong'], ['lebron', 'LeBron James'],
].map(([id, name]) => ({ id, name, portrait: `/host/assets/ui/portraits/${id}_portrait.png` }));

export const FFA_IDENTITIES = [
  { name: 'GOLD', color: '#ffd447' }, { name: 'PURPLE', color: '#b58cff' },
  { name: 'TEAL', color: '#35d6bd' }, { name: 'ORANGE', color: '#ff8a3d' },
  { name: 'PINK', color: '#ff70b7' }, { name: 'LIME', color: '#a7e85c' },
  { name: 'CYAN', color: '#39bff2' }, { name: 'CORAL', color: '#ff7163' },
];
export const FFA_COLORS = FFA_IDENTITIES.map(identity => identity.color);
export const SELECTION_MS = 25000;
export const ROLL_MS = 3400;
export const AGREE_MS = 900;

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function matchRules(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount % 2) throw new Error('Need an even number of players, at least 4.');
  const count = playerCount / 2, mode = count % 2 ? 'ffa' : 'teams';
  return { mode, count, lives: mode === 'ffa' ? 1 : count <= 4 ? 2 : 3 };
}

export function makeMatch(playerIds, random = Math.random) {
  const rules = matchRules(playerIds.length), ids = shuffled(playerIds, random);
  const fighters = Array.from({ length: rules.count }, (_, i) => {
    const side = rules.mode === 'ffa' ? `fighter-${i + 1}` : i < rules.count / 2 ? 'red' : 'blue';
    const identity=FFA_IDENTITIES[i%FFA_IDENTITIES.length];
    return { id: `fighter-${i + 1}`, side, label: rules.mode === 'ffa' ? identity.name : `${side === 'red' ? 'Red' : 'Blue'} ${i % (rules.count / 2) + 1}`,
      color: rules.mode === 'ffa' ? identity.color : side === 'red' ? '#ff665b' : '#63c7ec',
      players: ids.slice(i * 2, i * 2 + 2), character: null };
  });
  return { ...rules, fighters, mapId: null };
}

export function voteLeaders(votes, options) {
  const counts = Object.fromEntries(options.map(id => [id, 0]));
  for (const vote of Object.values(votes)) if (Object.hasOwn(counts, vote)) counts[vote]++;
  const max = Math.max(...Object.values(counts));
  return options.filter(id => counts[id] === max);
}

// The server chooses once; all clients animate the same slowing sequence.
export function makeRoll(options, { random = Math.random, now = Date.now(), unanimous = false } = {}) {
  const winner = options[Math.floor(random() * options.length)], frames = [];
  if (unanimous || options.length === 1) frames.push({ at: 0, id: winner });
  else {
    let at = 0, index = 0;
    while (at < ROLL_MS - 520) {
      frames.push({ at, id: options[index++ % options.length] });
      at += 65 + 340 * (at / ROLL_MS) ** 2;
    }
    frames.push({ at: ROLL_MS - 450, id: winner });
  }
  return { startedAt: now, duration: unanimous || options.length === 1 ? AGREE_MS : ROLL_MS, winner, frames };
}

export function rollFrame(roll, now = Date.now()) {
  const elapsed = now - roll.startedAt;
  return [...roll.frames].reverse().find(frame => frame.at <= elapsed)?.id ?? roll.frames[0].id;
}
