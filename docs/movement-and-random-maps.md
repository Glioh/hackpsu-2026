# Movement and random map selection

Leg movement uses fixed arena axes for both teams and both devices: positive
`moveX` moves right (+world X), positive `moveZ` moves forward (-world Z, away
from the camera). The conversion in `shared/movement.js` preserves diagonal
normalization. Physics previously rotated input with fighter heading, reversing
the apparent directions as the arm player turned. Bot navigation uses the inverse
conversion. Arm aim, turn strength, damping, recoil and network ownership are unchanged.
The optional phone Reverse steering checkbox still intentionally reverses tilt.
There is one Legs player per team, rather than separate left/right limb inputs.

**Random Map** in the Early map group chooses from the existing `MAPS` list.
It selects an arena for preview and rolls again when a new round starts, including
rematches. The active map heading names the chosen arena. Pause/resume retains
the arena; random mode's result button rolls another random arena. Selection is
uniform and repeats are allowed. The host owns simulation, so phones need no
new map synchronization. There is no procedural geometry or generation seed UI.

To test, run `npm test`. Start a keyboard match, disable the blue bot, and use
A/D and Left/Right while rotating with Q/E and J/L. W/Up moves away from the
camera; S/Down moves toward it. Opposing keys cancel, and release retains the
existing damping. On calibrated phones, check left/right tilt for both teams
with Reverse steering unchecked while arm teammates turn the fighters.

Choose Random Map, start a round, then rematch and return to map selection.
Confirm the chosen map is an existing arena and a pause does not change it.
Repeated random selections may legitimately pick the same map.

Primary files: `shared/movement.js`, `host/src/simulation.js`, `host/src/bot.js`,
`host/src/maps.js`, `host/src/main.js`. Regression tests cover production keyboard
and sensor input, both teams/facing directions, released and opposing inputs,
every random selection outcome, and host start/rematch/pause lifecycle.
Existing terrain test paths were updated to the corrected forward axis.
Physical phone testing remains a manual check.
