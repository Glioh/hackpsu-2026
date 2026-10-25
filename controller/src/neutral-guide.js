// Screen-space direction back to the calibrated grip, independent of gameplay
// dead zones, reverse steering, and the brief input hold after a jolt.
export function neutralGuidance(raw, neutral, wasActive = false) {
  if (!raw || !neutral) return { active: false, angle: 0 };
  const delta = (a, b) => ((a - b + 540) % 360) - 180;
  const x = -delta(raw.gamma, neutral.gamma);
  const y = delta(raw.beta, neutral.beta);
  const distance = Math.hypot(x, y);
  return {
    active: distance > (wasActive ? 3 : 5),
    angle: Math.atan2(y, x) * 180 / Math.PI,
  };
}

export function createNeutralGuide(element) {
  let active = false;
  let rotation = null;
  const arcs = element.querySelector('.neutral-arcs');
  return (raw, neutral, valid) => {
    const state = neutralGuidance(valid ? raw : null, neutral, active);
    active = state.active;
    if (active) {
      // Follow the shortest rotation when crossing the -180/180 seam.
      rotation = rotation === null ? state.angle
        : rotation + ((state.angle - rotation + 540) % 360 + 360) % 360 - 180;
      arcs.setAttribute('transform', `rotate(${rotation} 160 160)`);
    } else {
      rotation = null;
    }
    element.classList.toggle('guiding', active);
    element.setAttribute('aria-label', !valid ? 'Calibrate motion to set neutral'
      : active ? 'Tilt back toward the highlighted arc to return to neutral' : 'Phone is at neutral');
  };
}
