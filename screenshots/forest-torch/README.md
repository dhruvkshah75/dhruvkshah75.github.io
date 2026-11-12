# Directional torch verification

The night torch is now an invisible, camera-attached spotlight with its target attached to the same camera. Its light follows the existing first-person view and fades across a broad, soft cone. The scene uses actual surface lighting and shadows; there is no screen overlay or visible torch sprite.

Exposure (`1.12`), materials, HDR sky, geometry, camera movement, scrolling, UI and marker-holder assets were preserved. Dusk/day lighting is unchanged. Night environment intensity is `0.18`, hemisphere `0.4`, moon `0.65`, and opposite fill `0.15` to darken areas outside the torch. The spotlight is warm white `#fff0db`, base intensity `25`, distance `16`, decay `2`, half-angle `45°`, penumbra `0.75`, with the existing smooth ±10% seeded flicker. Its warmer-white color is calibrated to preserve the previous lit path colors under the reduced fill.

## Brightness comparison

Same 1440×900 camera positions with reduced motion. Values are mean Rec.709 weighted display RGB brightness for fixed image regions; they are not physical linear-light luminance. The target is to retain the lit area while darkening its surroundings.

| View | Lit path change | Left forest floor | Right forest floor | Canopy | Distant path |
|---|---:|---:|---:|---:|---:|
| start | -0.6% | -36.3% | -30.2% | -47.6% | -27.3% |
| middle | -8.3% | -32.0% | -33.0% | -45.4% | -25.4% |
| projects | -0.5% | -33.0% | -29.6% | -43.1% | -25.3% |

The entrance and Projects lit-path regions match the previous brightness within 1%; the midpoint is approximately 8% dimmer. The unlit forest floor is about 30–36% darker, canopy 43–48% darker, and the distant path around 25–27% darker. All measured lit-path regions are slightly dimmer than before. Coordinates, RGB means and exact values are in [comparison.json](comparison.json).

## Captures

- Entrance: [before](before-start.png), [after](after-start.png). Brown trail retains its previous warm color while green undergrowth and upper canopy around it become darker.
- Midpoint: [before](before-middle.png), [after](after-middle.png). The trail remains readable and the forest outside the near pool recedes into cool darkness.
- Projects: [before](before-projects.png), [after](after-projects.png). Existing chest, crystals, marker and nearby foliage remain recognizable.
- Looking [left](look-left.png) and [right](look-right.png): the torch aim follows the existing view movement.
- [Projects panel](projects-panel.png) retains its established appearance.
- [Mobile night](mobile-night.png) uses the existing low-quality geometry/shadow policy with the same directional torch.

## Checks

Playwright inspected the actual active Three.js scene using its devtools observe events: torch and target both parent to the perspective camera; beam-to-view alignment greater than `0.999`; range `16`; shadows enabled on desktop; no attached sprites. Projects marker, five cards, Escape and restored focus passed. Mobile overflow and unchanged day point-light/environment checks passed. No browser errors or warnings. TypeScript, ESLint for the edited component, and production build passed.

To repeat screenshots, install `playwright-core` (or set `PLAYWRIGHT_MODULE` to its module path), run the development server at port 3000, then run `node screenshots/forest-torch/capture.cjs`. `CHROME_BINARY` may select a different Chrome executable.
