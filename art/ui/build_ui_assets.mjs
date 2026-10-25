// Generates the arcade character-select art as standalone SVGs in host/assets/ui/ (served by the game):
// the red/blue VS burst backgrounds, the giant VS logo and the character card frames (4 states).
// Usage: node art/ui/build_ui_assets.mjs
// Self-contained vector art (no fonts, no external images) from one palette, so it can be restyled here.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../../host/assets/ui/', import.meta.url);
const C = { navy: '#101124', red: '#FF4757', blue: '#31C8FF', yellow: '#FFD447', purple: '#A45CFF', magenta: '#FF4FD8', text: '#FFF4D6',
  ink: '#0B0C1A', orange: '#FF8A3D', redDeep: '#8E1430', blueDeep: '#0B4F8A', navy2: '#1B1D3D', steel: '#3A3D66' };
const files = {};
const save = (path, svg) => { files[path] = svg; };
const svg = (w, h, body, defs = '') => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs ? `<defs>${defs}</defs>\n` : ''}${body}
</svg>
`;
const f = n => +n.toFixed(2);

// Deterministic randomness so regenerating gives identical files.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const grad = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const glow = (id, sd = 6) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const halftoneDefs = (id, size, r, color, opacity) => `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}" fill-opacity="${opacity}"/></pattern>`;

// ---------- VS backgrounds (1920x1080) ----------
function vsBackground(team) {
  const [base, deep, hot] = team === 'red' ? [C.red, C.redDeep, '#FFB36B'] : [C.blue, C.blueDeep, '#B8F4FF'];
  const W = 1920, H = 1080, cx = W / 2, cy = H / 2, R = 1400, N = 28;
  const wedges = Array.from({ length: N }, (_, i) => {
    const a0 = (i / N) * 2 * Math.PI, a1 = ((i + .5) / N) * 2 * Math.PI;
    return `<path d="M${cx} ${cy}L${f(cx + R * Math.cos(a0))} ${f(cy + R * Math.sin(a0))}L${f(cx + R * Math.cos(a1))} ${f(cy + R * Math.sin(a1))}Z"/>`;
  }).join('');
  seed = team === 'red' ? 11 : 23;
  const speed = Array.from({ length: 90 }, () => {
    const a = rand() * 2 * Math.PI, r0 = 420 + rand() * 260, r1 = r0 + 260 + rand() * 500, wdt = 2 + rand() * 7;
    const nx = -Math.sin(a) * wdt, ny = Math.cos(a) * wdt;
    return `<path d="M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))}L${f(cx + r1 * Math.cos(a) + nx)} ${f(cy + r1 * Math.sin(a) + ny)}L${f(cx + r1 * Math.cos(a) - nx)} ${f(cy + r1 * Math.sin(a) - ny)}Z"/>`;
  }).join('');
  const defs = `<radialGradient id="bg" cx="50%" cy="50%" r="65%"><stop offset="0" stop-color="${hot}"/><stop offset=".28" stop-color="${base}"/><stop offset="1" stop-color="${deep}"/></radialGradient>
<radialGradient id="core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="edgeMask" cx="50%" cy="50%" r="70%"><stop offset=".35" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
<mask id="edges"><rect width="${W}" height="${H}" fill="url(#edgeMask)"/></mask>
${halftoneDefs('dots', 18, 4.5, C.ink, .55)}`;
  return svg(W, H, `<rect width="${W}" height="${H}" fill="url(#bg)"/>
<g fill="#ffffff" fill-opacity=".12">${wedges}</g>
<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#edges)"/>
<g fill="#ffffff" fill-opacity=".5">${speed}</g>
<ellipse cx="${cx}" cy="${cy}" rx="520" ry="420" fill="url(#core)"/>`, defs);
}
save('backgrounds/vs_red.svg', vsBackground('red'));
save('backgrounds/vs_blue.svg', vsBackground('blue'));

// ---------- character select frame (240x300, 4 states) ----------
function frame(state) {
  const W = 240, H = 300, k = 26;                                       // k: cut-corner size
  const shape = (i) => `M${k + i} ${i}H${W - k - i}L${W - i} ${k + i}V${H - k - i}L${W - k - i} ${H - i}H${k + i}L${i} ${H - k - i}V${k + i}Z`;
  const look = { normal: [C.steel, '#5A5E99', 'none'], hover: [C.blue, '#BDEFFF', C.blue], selected: [C.yellow, '#FFF1A8', C.yellow], locked: ['#2A2C44', '#3A3C58', 'none'] }[state];
  const [rim, light, halo] = look;
  const defs = `${grad('interior', [[0, state === 'locked' ? '#14152A' : '#1E2050'], [1, '#0D0E20']])}${grad('rim', [[0, light], [.5, rim], [1, rim]])}${glow('halo', 7)}
<pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="14" fill="#000000" fill-opacity=".35"/></pattern>`;
  const studs = [[k + 8, 12], [W - k - 8, 12], [k + 8, H - 12], [W - k - 8, H - 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${light}" stroke="${C.ink}" stroke-width="2"/>`).join('');
  const markers = state === 'selected' ? `<g fill="${C.yellow}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"><path d="M4 4H58L4 58Z"/><path d="M${W - 4} ${H - 4}H${W - 58}L${W - 4} ${H - 58}Z"/></g>` : '';
  const lock = state === 'locked' ? `<rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="url(#hatch)"/>
<g transform="translate(${W / 2} ${H / 2})" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"><path d="M-22 -6V-22A22 22 0 0 1 22 -22V-6" fill="none" stroke="#8A8DB0" stroke-width="10"/><rect x="-34" y="-8" width="68" height="52" rx="8" fill="#8A8DB0"/><circle cy="12" r="7" fill="${C.ink}" stroke="none"/><rect x="-3" y="12" width="6" height="16" fill="${C.ink}" stroke="none"/></g>` : '';
  return svg(W, H, `${halo !== 'none' ? `<path d="${shape(6)}" fill="none" stroke="${halo}" stroke-width="10" filter="url(#halo)" opacity=".9"/>` : ''}
<path d="${shape(4)}" fill="${C.ink}"/>
<path d="${shape(8)}" fill="url(#rim)"/>
<path d="${shape(20)}" fill="${C.ink}"/>
<path d="${shape(23)}" fill="url(#interior)"/>
<path d="M${k + 23} 30H${W - k - 23}" stroke="#ffffff" stroke-opacity=".08" stroke-width="10"/>
${studs}${markers}${lock}`, defs);
}
for (const s of ['normal', 'hover', 'selected', 'locked']) save(`frames/character_frame_${s}.svg`, frame(s));

// ---------- giant VS logo (transparent) ----------
{
  // Original chunky italic V and S built from polygons, then outlined, shadowed and gradient filled.
  const V = 'M0 0H118L170 236L222 0H340L236 360H104Z';
  const S = 'M370 70Q370 0 440 0H640V92H492V132H580Q660 132 660 212V290Q660 360 590 360H370V268H538V228H450Q370 228 370 148Z';
  const letters = `<path d="${V}"/><path d="${S}"/>`;
  const defs = grad('vsFill', [[0, '#FFF6B0'], [.35, C.yellow], [.7, '#FFB13D'], [1, C.orange]]) + glow('vsGlow', 14);
  save('logos/vs_logo.svg', svg(820, 560, `<g transform="translate(80 90) skewX(-12)">
<g fill="${C.magenta}" stroke="${C.magenta}" stroke-width="44" stroke-linejoin="round" transform="translate(26 30)" opacity=".9" filter="url(#vsGlow)">${letters}</g>
<g fill="${C.ink}" stroke="${C.ink}" stroke-width="44" stroke-linejoin="round">${letters}</g>
<g fill="url(#vsFill)" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round">${letters}</g>
<g fill="#FFFFFF" opacity=".55"><path d="M14 10H104L112 48H24Z"/><path d="M380 70Q382 12 440 10H630V42H446Q404 42 396 76Z"/></g>
</g>`, defs));
}

// ---------- write ----------
for (const [path, content] of Object.entries(files)) {
  const url = new URL(path, OUT); mkdirSync(new URL('.', url), { recursive: true }); writeFileSync(url, content);
}
console.log(Object.keys(files).length + ' SVGs:\n' + Object.keys(files).map(p => '  host/assets/ui/' + p).join('\n'));
