// A successful API result means the request was accepted, not that hardware buzzed.
export function requestVibration(pattern = [50, 30, 70], device = globalThis.navigator) {
  if (typeof device?.vibrate !== 'function') return 'unsupported';
  if (device.userActivation?.hasBeenActive === false) return 'interaction-required';
  try { return device.vibrate(pattern) ? 'requested' : 'blocked'; }
  catch { return 'blocked'; }
}

export function vibrationMessage(status) {
  return {
    unsupported: 'This browser does not support vibration. Hits still flash red. iPhone Safari does not support the Vibration API.',
    'interaction-required': 'Tap Test vibration to allow feedback on this page.',
    requested: 'Vibration requested. If you felt nothing, check phone vibration settings and try a supported browser. Hits still flash red.',
    blocked: 'The browser rejected vibration. Check phone vibration settings and browser permissions. Hits still flash red.',
  }[status];
}
