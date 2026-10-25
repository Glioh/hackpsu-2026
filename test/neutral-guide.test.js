import test from 'node:test';
import assert from 'node:assert/strict';
import { neutralGuidance } from '../controller/src/neutral-guide.js';

const neutral = { beta: 45, gamma: 10 };
test('guidance points back to the calibrated grip in all directions', () => {
  for (const [beta,gamma,angle] of [[45,0,0],[45,20,180],[55,10,90],[35,10,-90],[55,0,45]]) {
    const result=neutralGuidance({beta,gamma},neutral);
    assert.equal(result.active,true);
    assert.equal(result.angle,angle);
  }
});
test('neutral tolerance uses hysteresis and recalibration clears guidance', () => {
  const raw={beta:45,gamma:14};
  assert.equal(neutralGuidance(raw,neutral,false).active,false);
  assert.equal(neutralGuidance(raw,neutral,true).active,true);
  assert.equal(neutralGuidance({beta:45,gamma:12},neutral,true).active,false);
  assert.equal(neutralGuidance(raw,raw,true).active,false);
  assert.equal(neutralGuidance(raw,null,true).active,false);
  assert.equal(neutralGuidance(null,neutral,true).active,false);
});
test('angle wrapping does not show a full turn at the orientation seam', () => {
  assert.equal(neutralGuidance({beta:-179,gamma:0},{beta:179,gamma:0}).active,false);
});
