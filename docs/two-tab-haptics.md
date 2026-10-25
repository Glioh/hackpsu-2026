# Two-tab Safari haptics experiment

Open `/controller/two-tab-haptics.html` on the phone. This is an isolated experiment, not an enabled game feature.

1. Toggle the visible native switch. Confirm you feel a real tick.
2. Create an experiment, then tap Start helper and open control tab.
3. Leave both tabs open and take your finger off the screen. The server queues a pulse for five seconds after Start.
4. Optionally copy the control tab's remote link to a laptop. Send a pulse there while nobody touches the phone.
5. Inspect helper poll and attempt counts. Record physical ticks separately; no browser API confirms them.

The original tab acts as helper, while the newly opened tab is the control panel. The helper intentionally retains a synchronous click stack and polls our server using synchronous XHR. Server responses wait 180 ms to avoid a CPU busy-wait. The loop checks a 20-second deadline between requests. A stalled network request can exceed that deadline. Stop from the control tab, or close the helper tab if it remains stuck.

No user data or commands go to a third-party service. Each session uses a random bearer link, expires after five minutes, and holds at most ten pending pulses. Anyone with the link can issue experimental pulses. This relay does not change rooms, player state, sensor calibration, or normal hit feedback.

Interpretation:

- Poll count stops when switching tabs: Safari suspended the helper; two-tab operation fails on that device.
- Attempt count advances but no tick: the polling works, but Safari rejected the haptic mechanism.
- Tick occurs only during Start: this does not establish hands-free operation.
- A remote pulse physically ticks after several seconds with no contact: promising evidence. Repeat on each intended iOS/device before considering game integration.

Inspired by the background-popup and click-grant methods in [ios-vibrator-pro-max](https://github.com/samdenty/ios-vibrator-pro-max). This prototype is an independent, bounded adaptation of the technique, not a claim of equivalent compatibility. It does not use native vibration APIs, synthetic trusted events, audio, an App Clip, or a mobile app. No phone hardware validation has been performed by the automated tests.
