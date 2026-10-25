import { CHARACTERS, rollFrame } from './party.js';
import { MAPS } from './maps.js';

export function choiceCard(id, kind, onPick) {
  const item = (kind === 'character' ? CHARACTERS : MAPS).find(c => c.id === id);
  const card = document.createElement(onPick ? 'button' : 'div');
  card.className = 'choice-card' + (kind === 'map' ? ' map-card' : ''); card.dataset.choice = id;
  if (onPick) { card.type = 'button'; card.onclick = () => onPick(id); }
  if (kind === 'character') {
    const image = document.createElement('img'); image.src = item.portrait; image.alt = ''; card.append(image);
  } else {
    const label = document.createElement('span'); label.className = 'map-number'; label.textContent = item.tier.toUpperCase(); card.append(label);
  }
  const name = document.createElement('strong'); name.textContent = item.name;
  const detail = document.createElement('small'); detail.dataset.detail = ''; card.append(name, detail);
  return card;
}

export function updateChoices(container, { vote, partnerVote, counts, roll, now = Date.now() }) {
  const current = roll && rollFrame(roll, now), done = roll && now >= roll.startedAt + roll.duration - 450;
  for (const card of container.querySelectorAll('[data-choice]')) {
    const id = card.dataset.choice;
    card.classList.toggle('selected', !roll && id === vote);
    card.classList.toggle('partner-pick', !roll && id === partnerVote);
    card.classList.toggle('rolling', !!roll && id === current && !done);
    card.classList.toggle('winner', !!roll && done && id === roll.winner);
    if (card.tagName === 'BUTTON') card.disabled = !!roll;
    card.setAttribute('aria-pressed', String(roll ? id === current : id === vote));
    const detail = card.querySelector('[data-detail]');
    const value = roll ? id === current ? done ? 'LOCKED IN' : 'ROLLING...' : ''
      : counts ? `${counts[id] || 0} ${(counts[id] || 0) === 1 ? 'vote' : 'votes'}` : id === vote ? 'YOUR PICK' : 'TAP TO PICK';
    if (detail.textContent !== value) detail.textContent = value;
  }
}
