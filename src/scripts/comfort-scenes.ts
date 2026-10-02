import * as THREE from "three";
import { createAirFlow } from "./flow-field";
import { createSeasonRoom } from "./season-room";
import { createACDiagnostic } from "./ac-diagnostic";
import { setupGlass } from "./liquid-glass";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import gsap from "gsap";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-scene]"));
const canvas = $<HTMLCanvasElement>("#atmosphere");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const lenis = new Lenis({ duration: 1.15, smoothWheel: true, respectReducedMotion: true, anchors: true });
const scrollTick = (seconds: number) => lenis.raf(seconds * 1000);
lenis.on("scroll", () => {
  ScrollTrigger.update();
  onScroll();
});
gsap.ticker.add(scrollTick);
gsap.ticker.lagSmoothing(0);
const sceneWeights = sections.map(() => 0);
const sceneOffsets = sections.map(() => 0);
let systemProgress = 0;
let baseScene = 0,
  nextScene = 0,
  sceneBlend = 0;
let paused = reduce.matches,
  active = 0,
  progress = 0,
  time = 0,
  last = 0,
  raf = 0;
const pointer = new THREE.Vector2(0.7, 0.45),
  targetPointer = pointer.clone();
const u = {
  uTime: { value: 0 },
  uScene: { value: 0 },
  uNextScene: { value: 0 },
  uBlend: { value: 0 },
  uProgress: { value: 0 },
  uHeroProgress: { value: 0 },
  uAspect: { value: 1 },
  uPointer: { value: pointer },
  uRoom: { value: new THREE.Texture() },
  uRoomAspect: { value: 16 / 9 },
  uSetpoint: { value: 72 },
};
const flow = createAirFlow($("#flow-air"), $("#flow"));
const seasons = createSeasonRoom($("#season-room"), () => { render(); if (!paused) start(); });
const diagnostic = createACDiagnostic($("#diagnostic-system"), () => { render(); if (!paused) start(); });
const glass = setupGlass(value => { u.uSetpoint.value = value; render(); });
let renderer: THREE.WebGLRenderer | undefined;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  canvas.hidden = true;
  document.body.style.backgroundImage = "url(/images/florida-interior.jpg)";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundAttachment = "fixed";
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
camera.position.z = 8;
const resources: Array<{ dispose: () => void }> = [];
const noise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=ns(p)*a;p=p*2.04+vec2(3.4,7.2);a*=.5;}return n;}`;
const bgMaterial = new THREE.ShaderMaterial({
  uniforms: u,
  depthWrite: false,
  depthTest: false,
  vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
  fragmentShader: `precision highp float;varying vec2 vUv;uniform float uTime,uScene,uNextScene,uBlend,uProgress,uHeroProgress,uAspect,uRoomAspect,uSetpoint;uniform vec2 uPointer;uniform sampler2D uRoom;${noise}
vec2 cover(vec2 p,float imageAspect){float ratio=uAspect/imageAspect;return (p-.5)*vec2(min(ratio,1.),min(1./ratio,1.))+.5;}
vec3 atmosphere(float kind,vec2 p){vec2 q=(p-.5)*vec2(uAspect,1.);float t=uTime;float pr=kind<.5?uHeroProgress:uProgress;vec3 col=vec3(.025,.055,.066);
if(kind<.5){
 float cool=smoothstep(.10,.92,pr);vec2 uv=cover(p,uRoomAspect);float haze=(1.-cool);
 uv.x+=sin(p.y*48.+t*.85+ns(p*12.+t*.2)*4.)*.003*haze;uv.y+=sin(p.x*27.+t*.45)*.002*haze;
 uv+=(uPointer-.5)*.005;
 col=texture2D(uRoom,uv).rgb;col*=mix(vec3(1.1,.72,.44),vec3(.63,.87,.95),cool);
 col*=.78;float line=0.;
 for(int i=0;i<18;i++){float f=float(i);float y=.18+f*.038+sin(p.x*5.+f*.2+t*.14)*(.015+.018*haze);y+=sin(p.x*12.+f+t*.22)*haze*.015;
 line+=exp(-abs(p.y-y)*650.)*.08;}
 col+=mix(vec3(.4,.17,.055),vec3(.18,.37,.34),cool)*line;
 col*=.6+.4*smoothstep(0.,.65,p.x);
 }else if(kind<1.5){
 float halo=exp(-length((p-vec2(.73,.47))*vec2(uAspect*.6,1.))*4.);
 col=mix(vec3(.86,.915,.88),vec3(.72,.84,.81),halo);
 float shadow=exp(-pow((p.x-.74)*uAspect*2.,2.)-pow((p.y-.30)*22.,2.));
 col-=vec3(.13,.16,.15)*shadow*.3;
 float lines=pow(.5+.5*sin(p.y*100.+fbm(p*3.)*3.),36.);
 col+=vec3(.016,.023,.022)*lines*pr;
}else if(kind<2.5){
 float clean=smoothstep(.2,.8,p.x);
 col=mix(vec3(.972,.976,.951),vec3(.86,.95,.92),clean*.55);
 float beam=exp(-pow((p.y-.21-sin(p.x*3.+t*.1)*.012)*35.,2.));
 col+=vec3(.015,.032,.028)*beam*clean;
}else if(kind<3.5){
 col=vec3(.965,.976,.956);
}else{
 float glow=exp(-length((p-vec2(.72,.30))*vec2(uAspect*.6,1.))*3.);
 col=mix(vec3(.972,.982,.966),vec3(.85,.95,.925),glow*.5);
}

col+=vec3(hash(gl_FragCoord.xy)-.5)*.012;
if(kind<.5)col*=.72+.28*(1.-length(p-.5));return col;}
void main(){vec3 col=mix(atmosphere(uScene,vUv),atmosphere(uNextScene,vUv),uBlend);gl_FragColor=vec4(col,1.);}`,
});
const plane = new THREE.PlaneGeometry(2, 2);
const bg = new THREE.Mesh(plane, bgMaterial);
bg.frustumCulled = false;
bg.renderOrder = -10;
scene.add(bg);
resources.push(plane, bgMaterial);
const textureLoader = new THREE.TextureLoader();
textureLoader.load("/images/florida-interior.jpg", texture => {
  texture.colorSpace = THREE.NoColorSpace;
  u.uRoom.value = texture;
  u.uRoomAspect.value = texture.image.width / texture.image.height;
  resources.push(texture);
  render();
});
const system = new THREE.Group();
scene.add(system);
system.visible = false;
const material = (color: number, metalness = 0.2, roughness = 0.3) => {
  const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  resources.push(m);
  return m;
};
const white = material(0xcbdad8, 0.15, 0.25),
  metal = material(0x829ea2, 0.85, 0.24),
  dark = material(0x10282c, 0.65, 0.35),
  copper = material(0xa97852, 0.82, 0.25);
function rounded(w: number, h: number, d: number, r: number, m: THREE.Material, parent: THREE.Group, x = 0, y = 0, z = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 4, r);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  resources.push(g);
  return mesh;
}
rounded(3.8, 1.45, 0.84, 0.12, white, system, 0, 0, -0.22);
rounded(3.55, 1.19, 0.13, 0.05, dark, system, 0, -0.01, 0.23);
const interior = new THREE.Group();
system.add(interior);
// Fine metal fins, copper return bends and cross-flow blower are a conceptual HVAC cutaway.
const finGeo = new THREE.BoxGeometry(0.012, 0.72, 0.34);
resources.push(finGeo);
for (let i = 0; i < 135; i++) {
  const fin = new THREE.Mesh(finGeo, metal);
  fin.position.set(-1.5 + i * 0.022, 0.14, 0.38);
  interior.add(fin);
}
const tubeGeo = new THREE.CylinderGeometry(0.025, 0.025, 3.15, 8);
resources.push(tubeGeo);
for (let i = 0; i < 5; i++) {
  const tube = new THREE.Mesh(tubeGeo, copper);
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0, -0.08 + i * 0.12, 0.59);
  interior.add(tube);
}
const rotor = new THREE.Group();
rotor.position.set(0, -0.43, 0.3);
interior.add(rotor);
const rotorGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.13, 48, 1, true);
resources.push(rotorGeo);
const rotorBody = new THREE.Mesh(rotorGeo, dark);
rotorBody.rotation.z = Math.PI / 2;
rotor.add(rotorBody);
const bladeGeo = new THREE.BoxGeometry(3.15, 0.018, 0.065);
resources.push(bladeGeo);
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2;
  const blade = new THREE.Mesh(bladeGeo, metal);
  blade.position.set(0, Math.cos(a) * 0.19, Math.sin(a) * 0.19);
  blade.rotation.x = a;
  rotor.add(blade);
}
const face = new THREE.Group();
system.add(face);
rounded(3.8, 1.02, 0.18, 0.1, white, face, 0, 0.2, 0.72);
const vent = new THREE.Group();
system.add(vent);
const slatGeo = new THREE.BoxGeometry(3.42, 0.025, 0.12);
resources.push(slatGeo);
for (let i = 0; i < 5; i++) {
  const slat = new THREE.Mesh(slatGeo, metal);
  slat.position.set(0, -0.34 - i * 0.065, 0.33);
  slat.rotation.x = -0.25;
  vent.add(slat);
}
const labelCanvas = document.createElement("canvas");
labelCanvas.width = 1024;
labelCanvas.height = 256;
const lc = labelCanvas.getContext("2d")!;
lc.fillStyle = "#b9d1cc";
lc.fillRect(0, 0, 1024, 256);
lc.fillStyle = "#475f61";
lc.font = "34px Helvetica";
lc.fillText("FULL SPECTRUM", 55, 125);
lc.fillStyle = "#dff8ed";
lc.font = "70px Helvetica";
lc.fillText("72°", 810, 145);
const labelTexture = new THREE.CanvasTexture(labelCanvas);
labelTexture.colorSpace = THREE.SRGBColorSpace;
const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.4, metalness: 0.1 });
const labelGeo = new THREE.PlaneGeometry(3.45, 0.68);
const labelMesh = new THREE.Mesh(labelGeo, labelMat);
labelMesh.position.set(0, 0.2, 0.815);
face.add(labelMesh);
resources.push(labelTexture, labelMat, labelGeo);
// Air-quality scene: a porous membrane with a physical rim and visible air on both sides.
const filter = new THREE.Group();
scene.add(filter);
filter.visible = false;
const rimGeo = new THREE.TorusGeometry(0.79, 0.048, 16, 96);
const filterMetal = material(0x3c766e, 0.62, 0.28);
const filterWire = material(0x36534f, 0.35, 0.4);
const rim = new THREE.Mesh(rimGeo, filterMetal);
filter.add(rim);
resources.push(rimGeo);
const wireGeo = new THREE.CylinderGeometry(0.005, 0.005, 1.55, 4);
resources.push(wireGeo);
for (let i = -12; i <= 12; i++) {
  const x = i * 0.062;
  const h = Math.sqrt(Math.max(0, 0.74 * 0.74 - x * x)) * 2;
  if (h < 0.01) continue;
  for (const horizontal of [false, true]) {
    const wire = new THREE.Mesh(wireGeo, filterWire);
    wire.scale.y = h / 1.55;
    wire.position.set(horizontal ? 0 : x, horizontal ? x : 0, 0);
    if (horizontal) wire.rotation.z = Math.PI / 2;
    filter.add(wire);
  }
}
const airCount = 6000;
const positions = new Float32Array(airCount * 3),
  seeds = new Float32Array(airCount);
for (let i = 0; i < airCount; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 10;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
  seeds[i] = Math.random();
}
const airGeo = new THREE.BufferGeometry();
airGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
airGeo.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
const airUniforms = { ...u, uScene: { value: 0 }, uOpacity: { value: 1 } };
const airMaterial = new THREE.ShaderMaterial({
  uniforms: airUniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `uniform float uTime,uScene,uProgress,uOpacity;attribute float seed;varying vec3 vColor;varying float vAlpha;void main(){vec3 p=position;float isPure=step(2.5,uScene)*step(uScene,3.5);float isSys=step(1.5,uScene)*step(uScene,2.5);p.x=mod(p.x+uTime*(.18+seed*.4)+5.,10.)-5.;if(isPure>.5){float before=1.-smoothstep(-.35,.35,p.x);p.y=-1.55+p.y*.5*before+sin(p.x*2.+seed*30.+uTime*.4)*.06;p.z*=.2;vColor=mix(vec3(.08,.48,.40),vec3(.56,.38,.24),before);vAlpha=mix(.45,.55,before);if(p.x>0.&&seed>.65)vAlpha=.0;}else if(isSys>.5){p.x=1.5+p.x*.34;p.y=-.8-abs(p.y)*(.2+uProgress*.5);p.z*=.4;vColor=vec3(.3,.7,.68);vAlpha=uProgress*.20;}else{p.y*=1.8;p.z*=.5;vColor=vec3(.8,.87,.75);vAlpha=.10;}vAlpha*=uOpacity;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.+seed*2.)*1.3;}`,
  fragmentShader: `varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vColor,(1.-smoothstep(.1,.5,d))*vAlpha);}`,
});
const airPoints = new THREE.Points(airGeo, airMaterial);
airPoints.frustumCulled = false;
scene.add(airPoints);
const cleanMaterial = airMaterial.clone();
cleanMaterial.uniforms = { ...u, uScene: { value: 3 }, uOpacity: { value: 1 } };
cleanMaterial.blending = THREE.NormalBlending;
const cleanPoints = new THREE.Points(airGeo, cleanMaterial);
cleanPoints.frustumCulled = false;
scene.add(cleanPoints);
resources.push(airGeo, airMaterial, cleanMaterial);
const systemMaterials = new Set<THREE.Material>();
system.traverse(object => {
  if (object instanceof THREE.Mesh) systemMaterials.add(object.material);
});
systemMaterials.forEach(m => {
  m.transparent = true;
});
[filterMetal, filterWire].forEach(m => {
  m.transparent = true;
});
const ambient = new THREE.AmbientLight(0x9eb8bc, 0.7);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xc9eeee, 4);
key.position.set(-2, 4, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x78bfb7, 2);
fill.position.set(3, 0, 2);
scene.add(fill);
const rimLight = new THREE.DirectionalLight(0xc0ceda, 3);
rimLight.position.set(1, 4, -3);
scene.add(rimLight);
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const env = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.035);
  scene.environment = target.texture;
  resources.push(target);
  env.dispose();
  pmrem.dispose();
}
function resize() {
  if (!renderer) return;
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  u.uAspect.value = w / h;
  flow.resize();
  seasons.resize();
  diagnostic.resize();
  onScroll();
}
function updateModel() {
  const mobile = innerWidth < 768 || innerWidth < innerHeight;
  system.position.set(mobile ? 0 : 2.1, (mobile ? -1.2 : -0.2) + sceneOffsets[1], 0);
  system.scale.setScalar(mobile ? Math.min(0.72, camera.aspect * 0.85) : 0.76);
  system.rotation.set(0.1 + systemProgress * 0.16, -0.24 + systemProgress * 0.38, -0.06);
  face.position.set(0, systemProgress * 0.9, systemProgress * 1.3);
  face.rotation.x = -systemProgress * 0.42;
  vent.rotation.x = systemProgress * 0.65;
  filter.position.set(0, (mobile ? -1.5 : -1.65) + sceneOffsets[2], 0);
  filter.rotation.y = Math.PI / 2 - 0.3 + (pointer.x - 0.5) * 0.13;
  filter.rotation.z = 0.08;
  filter.scale.setScalar(mobile ? 0.6 : 0.82);
}
function render() {
  if (!renderer) return;
  u.uTime.value = time;
  u.uProgress.value = progress;
  u.uScene.value = baseScene;
  u.uNextScene.value = nextScene;
  u.uBlend.value = sceneBlend;
  system.visible = sceneWeights[1] > 0.001;
  filter.visible = sceneWeights[2] > 0.001;
  systemMaterials.forEach(m => {
    m.opacity = sceneWeights[1];
    m.depthWrite = sceneWeights[1] > 0.99;
  });
  [filterMetal, filterWire].forEach(m => {
    m.opacity = sceneWeights[2];
    m.depthWrite = sceneWeights[2] > 0.99;
  });
  const particleScene = sceneWeights[0] > 0 ? 0 : 1;
  airUniforms.uScene.value = particleScene === 0 ? 0 : 2;
  airUniforms.uOpacity.value = sceneWeights[particleScene];
  airPoints.visible = sceneWeights[particleScene] > 0.001;
  airPoints.position.y = sceneOffsets[particleScene];
  cleanMaterial.uniforms.uOpacity.value = sceneWeights[2];
  cleanPoints.visible = sceneWeights[2] > 0.001;
  cleanPoints.position.y = sceneOffsets[2];
  if (sceneWeights[4] > 0) flow.render(time, paused);
  if (sceneWeights[3] > 0) glass.render(time, paused);
  if (sceneWeights[5] > 0) seasons.render(time, paused);
  if (sceneWeights[6] > 0) diagnostic.render(time, paused);
  updateModel();
  rotor.rotation.x = time * 0.7;
  renderer.render(scene, camera);
}
function onScroll() {
  const viewport = innerHeight;
  const rects = sections.map(section => section.getBoundingClientRect());
  let found = -1;
  rects.forEach((r, i) => {
    if (r.top <= viewport * 0.5 && r.bottom > viewport * 0.5) found = i;
  });
  if (found < 0) {
    canvas.style.opacity = "0";
    document.body.dataset.palette = "light";
    document.body.dataset.glass = "false";
    return;
  }
  canvas.style.opacity = "1";
  baseScene = Math.max(
    0,
    rects.reduce((last, r, i) => (r.top <= 0 ? i : last), 0)
  );
  nextScene = Math.min(baseScene + 1, sections.length - 1);
  const incoming = nextScene === baseScene ? 0 : THREE.MathUtils.clamp(1 - rects[nextScene].top / viewport, 0, 1);
  sceneBlend = THREE.MathUtils.smoothstep(incoming, 0, 1);
  sceneWeights.fill(0);
  sceneWeights[baseScene] = 1 - sceneBlend;
  sceneWeights[nextScene] += sceneBlend;
  sections.forEach((section, i) => {
    const stage = section.firstElementChild as HTMLElement;
    // Keep a stable backdrop root for the lens, including at full visibility.
    stage.style.opacity = String(i === 3 ? Math.min(.9999, sceneWeights[i]) : sceneWeights[i]);
    const worldHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    sceneOffsets[i] = (-stage.getBoundingClientRect().top / viewport) * worldHeight;
  });
  u.uHeroProgress.value = THREE.MathUtils.clamp(-rects[0].top / (rects[0].height - viewport), 0, 1);
  systemProgress = THREE.MathUtils.clamp(-rects[1].top / (rects[1].height - viewport), 0, 1);
  document.body.dataset.palette = sceneWeights[0] > 0.55 ? "dark" : "light";
  glass.setProgress(THREE.MathUtils.clamp(-rects[3].top / (rects[3].height - viewport), 0, 1));
  active = found;
  const r = rects[found];
  progress = THREE.MathUtils.clamp(-r.top / (r.height - viewport), 0, 1);
  canvas.dataset.scene = String(active);
  canvas.dataset.progress = progress.toFixed(3);
  canvas.dataset.blend = sceneBlend.toFixed(3);
  if (active === 0) {
    const cooling = THREE.MathUtils.smoothstep(progress, 0.10, 0.92);
    $("#room-temp").textContent = String(Math.round(108 - 36 * cooling));
    $("#room-state").textContent = cooling < 0.2 ? "FLORIDA HEAT" : cooling < 0.8 ? "FINDING YOUR BALANCE" : "YOUR KIND OF COMFORT";
    $("#climate-hint").textContent = cooling > 0.9 ? "THE HEAT STAYS OUTSIDE." : "SCROLL. FEEL THE DIFFERENCE. ↓";
  }
  if (active === 1) $("#system-hint").textContent = progress > 0.75 ? "THOUGHTFUL, ALL THE WAY THROUGH." : "SCROLL TO LOOK INSIDE ↓";
  render();
  if (!paused) start();
}
function frame(now: number) {
  raf = 0;
  if (paused || document.hidden || canvas.style.opacity === "0") return;
  time += Math.min((now - last) / 1000, 0.05);
  last = now;
  pointer.lerp(targetPointer, 0.035);
  render();
  raf = requestAnimationFrame(frame);
}
function start() {
  if (!raf && !paused && !document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", resize, { passive: true });
window.addEventListener(
  "pointermove",
  e => {
    targetPointer.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
    if (paused) {
      pointer.copy(targetPointer);
      render();
    }
  },
  { passive: true }
);
const toggle = $("#motion-toggle");
function pauseLabel() {
  toggle.textContent = paused ? "▷" : "Ⅱ";
  toggle.setAttribute("aria-pressed", String(paused));
  toggle.setAttribute("aria-label", paused ? "Resume ambient motion" : "Pause ambient motion");
}
toggle.addEventListener("click", () => {
  paused = !paused;
  pauseLabel();
  if (!paused) start();
});
reduce.addEventListener("change", () => {
  paused = reduce.matches;
  pauseLabel();
  if (!paused) start();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else start();
});
const explore = $("#explore-toggle"),
  menu = $("#explore-menu");
explore.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  explore.setAttribute("aria-expanded", String(!menu.hidden));
});
menu.querySelectorAll("a").forEach(a =>
  a.addEventListener("click", event => {
    event.preventDefault();
    const hash = a.getAttribute("href")!;
    lenis.scrollTo($(hash), { immediate: true });
    history.replaceState(null, "", hash);
    menu.hidden = true;
    explore.setAttribute("aria-expanded", "false");
    onScroll();
  })
);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    menu.hidden = true;
    explore.setAttribute("aria-expanded", "false");
    explore.focus();
  }
});
// Section entrance animations enhance normal document scrolling; content is visible without JS.
if (!reduce.matches)
  sections.filter(section => section.id !== "glass" && section.id !== "seasons" && section.id !== "diagnostic").forEach(section => {
    gsap.fromTo(
      section.querySelector("[data-copy]"),
      { y: 35, opacity: 0.55 },
      { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: section, start: "top 80%", end: "top 15%", scrub: true } }
    );
  });
resize();
onScroll();
pauseLabel();
start();
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(raf);
  gsap.ticker.remove(scrollTick);
  lenis.destroy();
  ScrollTrigger.getAll().forEach(t => t.kill());
  flow.dispose();
  glass.dispose();
  seasons.dispose();
  diagnostic.dispose();
  resources.forEach(r => r.dispose());
  renderer?.dispose();
});
