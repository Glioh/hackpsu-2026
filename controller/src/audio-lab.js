const $ = id => document.getElementById(id);
const controls = ['playLow', 'delayLow', 'playHigh', 'delayHigh', 'compare'];
let context, timers = [], nodes = new Set();
const status = message => { $('status').textContent = message; };
function stop() {
  timers.forEach(clearTimeout); timers = [];
  for (const {oscillator, gain} of nodes) {
    try { oscillator.stop(); } catch { /* Already ended. */ }
    oscillator.disconnect(); gain.disconnect();
  }
  nodes.clear();
}
function later(delay, message) { timers.push(setTimeout(() => status(message), delay * 1000)); }
function pulse(frequency, delay, amplitude) {
  if (frequency >= context.sampleRate / 2) throw Error('This frequency exceeds the audio output sample rate.');
  const oscillator = context.createOscillator(), gain = context.createGain();
  const start = context.currentTime + delay + .02, duration = .1;
  oscillator.type = 'sine'; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(amplitude, start + .01);
  gain.gain.setValueAtTime(amplitude, start + duration - .02);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  oscillator.connect(gain); gain.connect(context.destination);
  const entry = {oscillator, gain}; nodes.add(entry);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); nodes.delete(entry); };
  oscillator.start(start); oscillator.stop(start + duration + .01);
}
async function run(kind, delay = 0) {
  stop();
  try {
    if (!context) throw Error('Enable audio first.');
    await context.resume();
    if (context.state !== 'running') throw Error('Audio is suspended. Tap Enable audio again.');
    const amplitude = Number($('level').value) / 100;
    const low = Number($('low').value), high = Number($('high').value);
    if (kind === 'compare') {
      pulse(low, 5, amplitude); pulse(high, 10, Math.min(.1, amplitude));
      status(`Hands off: A (${low} Hz) in 5 seconds, B (${high} Hz) in 10 seconds.`);
      later(5, `A: ${low} Hz pulse scheduled now. Did you feel it?`);
      later(10, `B: ${high} Hz tone scheduled now. Did you feel it?`);
      later(10.3, 'Comparison complete. Record what you physically felt below.');
    } else {
      const frequency = kind === 'low' ? low : high;
      pulse(frequency, delay, kind === 'high' ? Math.min(.1, amplitude) : amplitude);
      status(delay ? `${frequency} Hz in ${delay} seconds. Lift your finger now.` : `${frequency} Hz pulse scheduled now.`);
      later(delay + .3, `${frequency} Hz test complete. Did you feel it, hear it, or neither?`);
    }
  } catch (error) { stop(); status(error.message); }
}
$('enable').onclick = async () => {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error('Web Audio is unavailable in this browser.');
    context ??= new Audio();
    await context.resume();
    if (context.state !== 'running') throw Error('Audio could not start. Try tapping again.');
    controls.forEach(id => { $(id).disabled = false; });
    status(`Audio ready (${context.sampleRate} Hz). Choose a test. Check media volume if you hear nothing.`);
  } catch (error) { status(error.message); }
};
$('level').oninput = () => { $('levelLabel').textContent = `${$('level').value}%`; };
$('playLow').onclick = () => run('low');
$('playHigh').onclick = () => run('high');
$('delayLow').onclick = () => run('low', 5);
$('delayHigh').onclick = () => run('high', 5);
$('compare').onclick = () => run('compare');
$('stop').onclick = () => { stop(); status('Stopped. All queued tones cancelled.'); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stop(); status('Test cancelled because this page was hidden.'); }
});
window.addEventListener('pagehide', stop);
