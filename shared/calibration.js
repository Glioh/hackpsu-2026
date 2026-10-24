export const CALIBRATION = Object.freeze({
  waiting: 'Waiting for phone',
  'sensors-disabled': 'Enable motion sensors',
  'permission-denied': 'Motion permission denied',
  'calibration-required': 'Calibrate neutral on phone',
  'orientation-error': 'Return to portrait and recalibrate',
  'sensor-stale': 'Sensor stream lost; recalibrate',
  backgrounded: 'Phone backgrounded; recalibrate',
  disconnected: 'Phone disconnected',
  calibrated: 'Calibrated and ready',
});
export const validCalibration = status => Object.hasOwn(CALIBRATION, status) && !['waiting','disconnected'].includes(status);
