const $ = id => document.getElementById(id);
let lines = [], heldTimer, dragReady = false, flip = false, armTimer;
function log(message) {
  lines.unshift(`${new Date().toLocaleTimeString()} ${message}`);
  $('log').textContent = lines.slice(0, 30).join('\n');
}
function attempt(source) {
  log(`${source}: requesting label.click(); activation=${navigator.userActivation?.isActive ?? 'unknown'}`);
  $('proxy').click();
}
$('native').addEventListener('change', event => log(`Native change (trusted=${event.isTrusted}); did you feel a tick?`));
$('target').addEventListener('change', event => log(`Target changed (trusted=${event.isTrusted}); this does NOT confirm a tick.`));
$('immediate').onclick = () => attempt('Immediate');
$('delayed').onclick = () => {
  log('Waiting 5 seconds; leave the screen alone.');
  setTimeout(() => attempt('Delayed'), 5000);
};
$('held').addEventListener('pointerdown', () => {
  clearTimeout(heldTimer);
  log('Hold started; waiting 5 seconds.');
  heldTimer = setTimeout(() => attempt('While holding'), 5000);
});
function endHold() { clearTimeout(heldTimer); log('Hold ended.'); }
$('held').addEventListener('pointerup', endHold);
$('held').addEventListener('pointercancel', endHold);
$('held').addEventListener('pointerleave', () => clearTimeout(heldTimer));
$('held').addEventListener('contextmenu', event => event.preventDefault());
$('arm').onclick = () => {
  clearTimeout(armTimer); dragReady = false;
  $('dragSwitch').style.left = '45%';
  log('Touch the drag switch and slide gently; experiment arms in 5 seconds.');
  armTimer = setTimeout(() => { dragReady = true; log('Drag experiment armed for 5 seconds.');
    armTimer = setTimeout(() => { dragReady = false; log('Drag experiment finished.'); }, 5000);
  }, 5000);
};
$('dragSwitch').addEventListener('touchmove', event => {
  if (!dragReady || !event.isTrusted || !event.touches.length) return;
  const bounds = $('dragArea').getBoundingClientRect();
  const x = event.touches[0].clientX - bounds.left;
  flip = !flip;
  // Change local pointer coordinates without synthesizing a trusted input event.
  $('dragSwitch').style.left = `${Math.max(50, Math.min(bounds.width - 90, x + (flip ? -65 : 5)))}px`;
}, {passive:true});
$('clear').onclick = () => { lines = []; $('log').textContent = ''; };
log(`Browser: ${navigator.userAgent}`);
log(`Mode: ${matchMedia('(display-mode: standalone)').matches ? 'Home Screen' : 'browser'}; vibrate API=${typeof navigator.vibrate}`);
