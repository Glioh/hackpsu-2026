# Cloudpeak Dojo

Choose **Cloudpeak Dojo** under **Mid** in the arena picker. This is a separate playable mountain kung fu environment, alongside the rooftop and other maps.

The 26 by 20 metre cliff courtyard includes a taiji stone medallion, a six-step ascent to the upper training terrace, a side meditation terrace with an incline, collidable wooden training dummies, faceted garden boulders, a bronze gong, vermilion gate with jade eaves, banners, bamboo, and stone lanterns. Distant karst peaks and valley mist provide context. All four edges remain open for ring-outs, and the upper rear terrace ends at the cliff edge.

`shared/mountain-layout.js` supplies structural dimensions to both `mountain-map.js` and `mountain-view.js`. The procedural scene does not depend on external models or textures. Shared solid-terrain physics supports slopes, stairs, collision, landings, and falls. The bot routes with its actual body radius using the collision resolver; it can detour around dummies and use the ascent to reach the upper terrace. Foreground obstacles fade when they hide a fighter.

Check with `node --test test/mountain.test.js`. Browser QA: with the host on 4175 and Chrome CDP on 9337, run `node scripts/smoke-terrain.mjs http://localhost:4175 http://localhost:9337 --mountain --bot`. The screenshot is saved to `art/prototypes/mountain/gameplay.png`.
