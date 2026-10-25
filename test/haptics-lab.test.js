import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.js';

test('two-tab relay isolates sessions, delivers pulses once, validates delays, and stops', async t => {
  const {http, io} = createApp();
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => io.close(resolve)));
  const base = `http://127.0.0.1:${http.address().port}/api/haptics-lab`;
  async function call(path = '', body) {
    return fetch(base + path, body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  const a = await (await call('', {})).json(), b = await (await call('', {})).json();
  assert.match(a.id, /^[a-f0-9]{48}$/); assert.notEqual(a.id,b.id);
  assert.equal((await call('/missing/status')).status,404);
  assert.equal((await call(`/${a.id}/pulse`,{delayMs:-1})).status,400);
  assert.equal((await call(`/${a.id}/pulse`,{delayMs:16000})).status,400);
  assert.equal((await call(`/${a.id}/pulse`,{})).status,200);
  assert.equal((await (await call(`/${b.id}/poll`)).json()).pulse,null);
  const delivered = await (await call(`/${a.id}/poll`)).json();
  assert.equal(delivered.pulse.id,1);
  assert.equal((await (await call(`/${a.id}/poll?attempted=1`)).json()).pulse,null);
  const status = await (await call(`/${a.id}/status`)).json();
  assert.equal(status.attempted,1); assert.equal(status.polls,2);
  await call(`/${a.id}/pulse`,{delayMs:15000});
  assert.equal((await (await call(`/${a.id}/poll`)).json()).pulse,null);
  await call(`/${a.id}/stop`,{});
  const stopped = await (await call(`/${a.id}/poll`)).json();
  assert.equal(stopped.stopped,true); assert.equal(stopped.pulse,null);
  assert.equal((await call(`/${a.id}/pulse`,{})).status,409);
});
