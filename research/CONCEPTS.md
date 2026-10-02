# Full Spectrum motion concepts

Seven service website sections, implemented with vanilla TypeScript and Tailwind utilities.

| Section | Motion and use |
| --- | --- |
| Air conditioning hero | Florida interior cools from 108°F to 72°F. A longer 280vh desktop / 240vh mobile scroll links temperature, heat shimmer and airflow. |
| System installation | A procedural split unit opens as you scroll, revealing its coil, copper tubing and blower. |
| Indoor air quality | Air travels through a physical filtration plane into a bright, clean atmosphere. |
| Crystal clear comfort | A wide capsule lens refracts its local room backdrop and moving light contours. A rounded capsule displacement map gives curved thick edges with subtle RGB dispersion. Drag the lens, use the range, or use the buttons to adjust 68–78°F. The lens glides and highlights follow the pointer. A local backdrop and a persistent opacity backdrop root prevent refraction popping when the section enters or pins. |
| Balanced airflow | 1,400 particles sample one shared flow field and leave fine teal trails on a light background. Pointer movement pushes and curls the air above a vent. |
| Comfort in every season | Architectural 3D room with a COOL 68°F / HEAT 74°F toggle. Cooling passes near the ceiling and falls through the space; heating descends and spreads across the floor. Curves morph continuously, the AC deflector rotates, and surface thermal gradients and window frost/condensation blend with the mode. Soft shadows, linen, stone and oak details keep the visualization within a home-service context. |
| AC not cooling? | Six symptoms preview on hover/focus and latch on click or keyboard activation. A procedural cutaway highlights the cooling circuit, drain, controls, blower, thermostat or filter. Animated ribbons become warm or weak, drainage releases subtle drops, power stops the blower and flow, noise adds small vibrations and rings, and thermostat readings fluctuate. Each choice explains what a technician can inspect and links to the existing service booking page. |

The former Florida forecast, refrigeration and map sections were removed from the active page.

## Effect references

- [Adam Breakell — Liquid Glass](https://codepen.io/adam_breakell/pen/ZYOLNpN): technique adapted into a working climate-control panel. The displacement map is generated locally; no embedded reference image or external runtime dependency.
- [Sona Arajyan — Flow-field smoke](https://codepen.io/SonaArajyan03/pen/NPpqWRp): shared flow-field principle adapted to light, cooling airflow. Particles store positions and ages, sampling interpolated field vectors rather than individual directions.
- [Midea PortaSplit](https://www.midea.com/global/heating-cooling/porta-split-ac): upward cooling and downward heating deflector concept. The section uses art-directed paths and illustrative temperatures, not a CFD calculation or a manufacturer model.
- [Full Spectrum](https://fullspectrumac.com/): service context, contact and booking links.
- [Lenis](https://github.com/darkroomengineering/lenis), [Three.js](https://threejs.org/docs/), [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/): smooth scroll and rendering infrastructure.

The 3D system and generated Florida interior are illustrative. Temperature values demonstrate the animation, rather than a measured system performance claim. Layout and controls use Tailwind; effects use shaders, SVG filters and Canvas 2D. Ambient motion supports pause and reduced-motion preferences. Scene backgrounds crossfade; geometry follows the document stage position.

## Validation

TypeScript / production build, desktop and 390×844 mobile browser checks, seven-section navigation, thermostat controls, temperature range, and browser errors. Revision images: 16-liquid-lens.jpg, 15-flow-air.jpg, 17-room-cooling.jpg 18-room-heating.jpg, 19-ac-diagnostic.jpg and 20-ac-diagnostic-mobile.jpg. The glass entrance was checked before and after pinning, with opacity remaining below 1 to preserve the filter's backdrop root.

The room renderer initializes near the viewport and precompiles shaders. It renders only while the section is visible and follows the shared pause/reduced-motion state. Controls remain usable while ambient motion is paused. Checks include both modes on desktop and mobile, paused switching, navigation and entrance transition.

The diagnostic module warms up near the viewport and renders only while its section is visible. It shares the global pause and reduced-motion preferences. Its six symptoms come from the client’s existing homepage; the highlighted components are illustrative inspection areas, not definitive diagnoses. Desktop and mobile selections, hover restoration, keyboard activation, paused interaction and console errors were checked.
