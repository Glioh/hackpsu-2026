import test from 'node:test';
import assert from 'node:assert/strict';
import { requestVibration, vibrationMessage } from '../controller/src/vibration.js';

test('vibration distinguishes unsupported, inactive, blocked, and accepted requests', () => {
  assert.equal(requestVibration(undefined, {}), 'unsupported');
  assert.equal(requestVibration(undefined, {userActivation:{hasBeenActive:false},vibrate(){assert.fail('No activation');}}), 'interaction-required');
  assert.equal(requestVibration(undefined, {vibrate:()=>false}), 'blocked');
  assert.equal(requestVibration(undefined, {vibrate(){throw Error('Denied');}}), 'blocked');
  const device = {vibrate(pattern){assert.equal(this, device);assert.deepEqual(pattern,[50,30,70]);return true;}};
  assert.equal(requestVibration(undefined, device), 'requested');
  assert.match(vibrationMessage('requested'), /If you felt nothing/);
  assert.match(vibrationMessage('unsupported'), /Hits still flash red/);
});
