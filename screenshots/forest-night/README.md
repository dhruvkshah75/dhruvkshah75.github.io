# Forest look verification

> These captures document the prior uniform torch setup. The current directional torch and updated lighting values are documented in [the torch report](../forest-torch/README.md).

Night is the default. Compare `/?time=night`, `/?time=dusk`, and `/?time=day`. Missing or invalid `time` selects `CONFIG.timeOfDay` (currently `night`).

The orange flame sprite was removed entirely following the final feedback. The camera-attached point light still illuminates nearby surfaces. At night, geometric light shafts and the duplicate square moon/stars are hidden; the existing [Moonlit Golf HDRI by Greg Zaal (CC0)](https://polyhaven.com/a/moonlit_golf) supplies the photographed sky. A deep-blue gradient is the fallback. Geometry, seeded tree placement, camera movement, scroll controls, card holders, and Projects panel styles remain unchanged.

## Screenshots

1440 × 900 desktop captures, with reduced motion for repeatable camera positions. A separate normal-motion wheel check passed. Brightness below means Rec.709-weighted **display RGB luma**, averaged over the full screenshot including UI, as a percentage of 255. This is the screenshot brightness heuristic used for the 12–25% target; it is not physical linear-light luminance. Both metrics are recorded in `brightness.json`.

| Screenshot | Display brightness | What is visible |
|---|---:|---|
| [night-start](night-start.png) | 13.53% | Dark green canopy and brown trunks frame a readable warm path. The upper gap shows a subdued photographic blue night sky with faint stars. No orange sprite or blue beams. |
| [night-middle](night-middle.png) | 13.38% | The brown trail remains visible between shaded green trees. The distant trail and ground haze are cooler than the foreground; the Experience marker remains legible. |
| [night-projects](night-projects.png) | 12.08% | The original chest, crystals and Projects marker remain in place. Brown bark and green bushes retain color; the nearby trail is warmer than the blue-gray distance. |
| [night-projects-panel](night-projects-panel.png) | 8.48% | The existing translucent, blurred Projects panel and pixel typography are preserved. Its darker UI background is intentionally excluded from the forest brightness target. |
| [dusk-start](dusk-start.png) | 23.94% | Warmer canopy edges and a brighter brown trail against muted blue haze; visibly brighter than night. |
| [dusk-middle](dusk-middle.png) | 24.63% | Warm cross-light and mist reveal more mid-distance tree detail than night. |
| [dusk-projects](dusk-projects.png) | 22.15% | Chest and path remain clearly visible under the warmer dusk lighting. |
| [day-start](day-start.png) | 44.72% | The retained bright sun setup lights the green ground and canopy against pale blue-green haze. |
| [day-middle](day-middle.png) | 47.67% | The brightest comparison frame, with broad sunlit areas across the forest floor. |
| [day-projects](day-projects.png) | 41.41% | Bright path, foliage and chest under warm sun and cool fill. |
| [night-mobile](night-mobile.png) | 18.09% | The existing low-quality tier retains its broader unshadowed lighting. The narrower night view has no sprite or horizontal overflow. |

All three desktop night forest frames meet the display-brightness range. Their sampled canopy regions are green-dominant; sky regions are blue-dominant; the nearby path is brighter and has a higher red-to-blue ratio than the distant path. Region coordinates and RGB means are recorded in `brightness.json`; these checks compare the composed scene, rather than isolating individual light contributions.

## Final night CONFIG

| Control | Final value |
|---|---|
| Time of day | `night` |
| Renderer | ACES filmic tone mapping; exposure `1.12`; sRGB output |
| Hemisphere | Sky `#2a3f66`, ground `#1a2a18`, intensity `0.6` |
| Moon directional | `#9fb8ff`, intensity `1.05`, offset `[-24,32,-18]`, path-fitted PCF shadow map |
| Secondary fill | `#3a5a9a`, intensity `0.25`, opposite direction |
| Torch point light | `#ffb05a`, intensity `6`, distance `16`, decay `2`, camera attached; smooth seeded flicker bounded by ±10%; no visible sprite |
| Marker point lights | Four existing `#76afff`, intensity `6`, distance `7`, decay `1.8` |
| Fog | `#12202c`, Exp2 density `0.01786802`, 40% fog at 40 m |
| Environment | Existing Moonlit Golf night HDR, intensity `0.33` |
| Night sky | HDR background intensity `0.65`, blurriness `0.015`, x rotation `-0.32`; fallback zenith `#050c18`, horizon `#12202c` |
| Foliage | Per-instance `#3d7a2e–#5e9a3a`; pale tiers `#4b8532–#5e9a3a`; roughness `0.6` |
| Bark | Per-instance `#4a3322–#6b4a2e`, roughness `0.94`, subtle vertical sRGB bark texture |
| Ground and grass | Moss `#5c8a2f`; grass `#48752a–#689638`, roughness `0.92` |
| Path | `#9a7447` with neutral granular sRGB detail, roughness `0.96` |
| Color grading | Saturation `1.15`, contrast `1.04`, shadow blue lift `0.002`, before OutputPass |
| Vignette | Amount `0.3`, inner radius `0.45`, outer radius `0.72` |
| Grain | Intensity `0.02`, speed `24` |
| Bloom | Strength `0.3`, threshold `0.85`, radius `0.4` |
| Mist | Four original feathered ground planes, `#6f8fb8`, opacity `0.15`, depthWrite disabled, slow UV drift |
| Shafts | Disabled at night (opacity `0`); retained for dusk/day |
| Fireflies | `56`, pale green-yellow, slow drift |
| Pixelation | `CONFIG.pixelate.enabled = true`; desktop resolution ÷3, mobile ÷2; no palette reduction |
| Text | Heading `#9ab8ff`; body `#d8e4d0`; left-text-only dark gradient starts at alpha `0.5` |

SMAA, grading, vignette, grain, bloom and OutputPass remain enabled on the existing high/medium tiers. The existing low tier bypasses post-processing and shadow maps; direct rendering still uses ACES and sRGB. All color albedo textures use sRGB. HDR data remains linear and alpha-only mask textures remain data textures.

## Verification

- Playwright: all three URL presets; default and invalid-parameter night fallback; desktop and mobile canvas rendering; Projects navigation and marker; five project cards; Escape; restored focus; no horizontal overflow.
- Final Playwright pass also exercised actual wheel scrolling with normal motion. No console errors, warnings or failed requests.
- TypeScript check and ESLint on the edited scene passed. Production build passed.
- Detailed results: `browser-report.json`, `final-browser-report.json`, `brightness.json`.

To recapture, install `playwright-core` or set `PLAYWRIGHT_MODULE` to its module path, start the app, then run `node screenshots/forest-night/capture.cjs` (optional `FOREST_URL` and `CHROME_BINARY`). Run `python3 screenshots/forest-night/measure.py` with Pillow installed to repeat the brightness/color checks.

## Initial diagnosis (before edits)

ACES exposure was `1.2`, background/fog `#08171c`, Exp2 density `0.0274314` (70% fog at 40 m), HDR environment intensity `0.04`. Hemisphere sky/ground were `#a0b8c4/#647c68` at `1.8`; main directional `#b8c8ff` at `1.2`; torch `#ff9a3c` at `25`, distance `14`, decay `2`, ±8% flicker; marker lights already used the values retained above. No ambient, spot, or secondary directional light existed.

Passes were RenderPass, bloom (`0.35`, radius `0.4`, threshold `0.85`), SMAA, vignette (`0.25`, radii `0.25–0.75`), multiplicative grain (`0.03`, speed `24`), and OutputPass. No grading, quantization, posterization, or palette shader existed. Resolution was desktop ÷3/mobile ÷2 without a toggle. Low quality bypassed the composer.

Initial standard materials, all roughness `1` unless specified: bark `#343e31`, leaves `#284438`, pale leaves `#38523c`, grass `#394e31`, stone `#566963`, holder wood `#453e2c`, paper `#c8d2ae`, gold `#c3ac67` (roughness `0.6`, metalness `0.35`), crystal `#96c6ff` (emissive `#4e8fef`, intensity `1.1`). Ground `#667158` multiplied dark RGB `(57,67,43)` noise with variance `24`; path `#9c9673` multiplied RGB `(115,109,72)` noise with variance `30`. Those two dark texture multiplications substantially suppressed albedo.

Unlit mist was `#78999e`, opacity `0.19`; moon `#b9d2c4`; stars `#b7c9bd`; fireflies `#c7db86`, opacity `0.8`, count `130`. Renderer output and procedural albedo textures were already sRGB; HDR was linear. The white mist/edge textures used the default data color space. No global color multiplier existed beyond the material × texture tint, lighting, vignette and grain.

CSS duplicated the vignette across the entire canvas (corner black alpha up to `0.60`, bottom up to `0.73`) and added black scanlines at `0.045` opacity. These canvas overlays were disabled. The existing translucent dialog background and Projects styling were retained.
