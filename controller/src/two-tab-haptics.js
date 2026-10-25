const $ = id => document.getElementById(id);
let id = new URLSearchParams(location.hash.slice(1)).get('session');
const isControl = new URLSearchParams(location.search).get('mode') === 'control';
let statusTimer;
function message(text) { $('status').textContent = text; }
async function api(path = '', body) {
  const response = await fetch(`/api/haptics-lab${path}`, {
    method:body === undefined ? 'GET' : 'POST', cache:'no-store',
    ...(body === undefined ? {} : {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || `Request failed (${response.status}).`);
  return result;
}
function controlURL() {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('mode', 'control'); url.hash = new URLSearchParams({session:id}).toString();
  return url.href;
}
async function send(delayMs) {
  try { await api(`/${id}/pulse`, {delayMs}); message(delayMs ? 'Pulse queued for five seconds from now. Hands off the phone.' : 'Pulse queued. Did the phone physically tick?'); }
  catch (error) { message(error.message); }
}
$('create').onclick = async () => {
  try { ({id} = await api('', {})); $('start').disabled = false; message('Ready. Starting opens a control tab and runs this helper for up to 20 seconds.'); }
  catch (error) { message(error.message); }
};
$('start').onclick = () => {
  if (!id) return;
  const other = window.open(controlURL(), '_blank');
  if (!other) { message('Safari blocked the control tab. Allow pop-ups for this site, then try again.'); return; }
  // Schedule on the server, without awaiting and losing the original event stack.
  fetch(`/api/haptics-lab/${id}/pulse`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({delayMs:5000})}).catch(() => {});
  $('start').disabled = true;
  message('Helper running for 20 seconds. The control tab sends pulses.');
  const deadline = Date.now() + 20000;
  let attempted = 0, polls = 0, error = '', stopped = false;
  // Deliberately bounded synchronous experiment. Never use this on the game UI.
  while (Date.now() < deadline) {
    try {
      const request = new XMLHttpRequest();
      request.open('GET', `/api/haptics-lab/${id}/poll?attempted=${attempted}`, false);
      request.send();
      if (request.status !== 200) throw Error(`Helper HTTP ${request.status}`);
      const data = JSON.parse(request.responseText); polls++;
      if (data.stopped || Date.now() >= deadline) { stopped = data.stopped; break; }
      if (data.pulse) {
        $('trigger').click();
        attempted = data.pulse.id;
      }
    } catch (failure) { error = failure.message; break; }
  }
  // Final acknowledgement must not be mistaken for proof of a physical tick.
  api(`/${id}/poll?attempted=${attempted}`).catch(() => {});
  message(`Helper ${stopped ? 'stopped remotely' : 'finished'}. ${polls} polls; last attempted pulse ${attempted}. ${error}`);
  $('create').disabled = false;
};
$('pulse').onclick = () => send(0);
$('delay').onclick = () => send(5000);
$('stop').onclick = async () => {
  try { await api(`/${id}/stop`, {}); message('Stop requested. Helper should exit on its next poll.'); }
  catch (error) { message(error.message); }
};
$('remote').onclick = () => $('remote').select();
if (isControl && /^[a-f0-9]{48}$/.test(id || '')) {
  $('setup').hidden = true; $('control').hidden = false; $('remote').value = controlURL();
  message('Control ready. Wait for the automatic five-second request, or send one from your laptop.');
  let updating = false;
  statusTimer = setInterval(async () => {
    if (updating || document.hidden) return;
    updating = true;
    try {
      const s = await api(`/${id}/status`);
      const age = s.lastPoll ? `${Math.round((Date.now()-s.lastPoll)/1000)}s ago` : 'not yet';
      $('diagnostics').textContent = `Helper polls: ${s.polls}\nLast poll: ${age}\nLast attempted pulse: ${s.attempted}\nQueued: ${s.queued}\nStopped: ${s.stopped}\nAttempts do not confirm haptics.`;
    } catch (error) { message(error.message); clearInterval(statusTimer); }
    finally { updating = false; }
  }, 1000);
}
window.addEventListener('pagehide', () => clearInterval(statusTimer));
