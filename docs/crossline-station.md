# Crossline Station

Choose **Crossline Station** in the Mid tier map picker, then start a phone or keyboard match.

The enlarged 42 × 15.4m island has a +0.58m platform, +1.89m west waiting terrace, +1.4m luggage podium, and +4.86m transfer bridge. Broad stairs reach the west terrace; continue along its rear staircase to reach the bridge. Fighters can walk underneath the bridge. The sunken front and rear tracks are traversable hazard lanes; outer platforms are reachable over the track gaps. Open ends and edges allow ring-outs.

Each train line independently arrives after an initial random 4–12 second wait. Subsequent eight-second passes have random 5–18 second clear gaps. Signals turn amber three seconds before arrival and red during a pass. Rear trains travel east; front trains travel west. Timing uses the arena seed and simulation clock, so pausing freezes both visible trains and impacts, and rematches choose fresh schedules. Train hits deal 25 damage and launch fighters in the travel direction once per pass. The central platform and overhead bridge clear the trains.

`node scripts/build-station.mjs` regenerates `host/assets/maps/station.glb` and `host/src/station-hulls.js` from the station concept. The model excludes scale mannequins, preserves train/signal metadata, and supplies collision for platforms, steps, bridge, and substantial props. The foundation and distant track extensions are scenery.

`node --test test/station.test.js` checks traversal, support beneath the bridge, random schedules, train hits, safe elevations, ring-outs, and the exported model. The standalone review concept remains at `art/prototypes/station/`.
