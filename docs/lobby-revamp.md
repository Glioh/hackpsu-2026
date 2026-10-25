# Lobby concept: shared custody

Preview: `/host/prototypes/lobby/` with `npm start`. This is a standalone interactive mockup; player names and connection counts are sample data. Its QR opens the existing controller without a real room. Use the normal host to play.

## Repository findings

The live host (`host/index.html`, `host/src/main.js`) has a three-stage join → fighter → map flow, but presents the roster as text rows and the fighters as text buttons. Each fighter belongs to two phone roles, legs and arm; four portraits represent available bodies, not four independent player characters.

`host/assets/ui/` already contains transparent portraits and head images for Crank, Sir Squish, Bonk-3000, and Nik; normal/hover/selected/locked character card frames; red/blue burst backgrounds; and a VS logo. `art/ui/build_ui_assets.mjs` defines their original arcade palette. These assets are not referenced by the live lobby. The mockup reuses portraits, the VS logo, and normal/selected card frames. The burst backgrounds are intentionally omitted from the joining view to keep QR and player status readable.

The current shared palette mixes lime calls to action with dark navy panels and small red/blue role labels. The proposed host-only palette makes team colors the composition: coral `#ff806c`, cyan `#75ddeb`, warm yellow `#f5edab`, and a deep plum → violet → petrol background. Opaque dark surfaces carry small text; saturated gradient areas sit behind large character art. A second dusk gradient is available for comparison.

## Proposed experience

- Keep the QR visible alongside both teams. Group each pair of phone slots beneath their shared body so the unusual control model is clear immediately.
- Show empty slots as invitations and connected slots with textual ready states. Team names and role names accompany colors and symbols.
- Let the host inspect character cards while waiting. The mockup permits navigation through all three preview stages without real phones; production readiness gates remain in the live application.
- Keep the four existing head portraits inside the repository's selected/normal frames in the picker. Changing a card updates the corresponding team portrait and preserves the other team's choice.
- Use responsive stacking for narrow screens, visible keyboard focus, native buttons, reduced-motion support, and live announcements for sample connection changes.

## Review controls and boundaries

“Fill remaining slots” changes 2/4 sample phones to 4/4. “Reset” restores default teams. “Try dusk gradient” compares the alternate background. Team art opens fighter selection; each team remembers its own selection for the current page session. The arena section is a direction sketch, not a functional map picker. Nothing is persisted or emitted to game sockets.

To integrate after design review, reuse the real `room:roster` statuses, existing `pickFighter` behavior and readiness checks. Keep this visual theme scoped to the host so controller contrast and gameplay presentation are reviewed separately.
