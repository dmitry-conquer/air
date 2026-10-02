import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** An architectural cutaway and art-directed airflow, not a CFD simulation. */
export function createSeasonRoom(canvas: HTMLCanvasElement, invalidate: () => void) {
  const section = document.querySelector<HTMLElement>("#seasons")!;
  const coolButton = document.querySelector<HTMLButtonElement>("#season-cool")!;
  const heatButton = document.querySelector<HTMLButtonElement>("#season-heat")!;
  const temperature = document.querySelector("#season-temp")!;
  const description = document.querySelector("#season-description")!;
  const detail = document.querySelector("#season-detail")!;
  let targetHeat = 0, heat = 0, previous = -1;
  let renderer: THREE.WebGLRenderer | undefined;
  let camera: THREE.OrthographicCamera;
  let scene: THREE.Scene;
  let room: THREE.Group;
  let vane: THREE.Group;
  let indicator: THREE.MeshBasicMaterial;
  let bounce: THREE.PointLight;
  const resources: Array<{ dispose(): void }> = [];
  const uniforms = { uTime: { value: 0 }, uHeat: { value: 0 } };
  const pointer = new THREE.Vector2(), targetPointer = new THREE.Vector2();
  const coolColor = new THREE.Color("#83cad0"), heatColor = new THREE.Color("#e6a468");

  const setMode = (value: number) => {
    targetHeat = value;
    section.dataset.mode = value ? "heat" : "cool";
    coolButton.setAttribute("aria-pressed", String(!value));
    heatButton.setAttribute("aria-pressed", String(!!value));
    description.innerHTML = value ? "Warmth flows down to the floor.<br />Then wraps the room in a quiet glow." : "A cool current sweeps the ceiling.<br />Then settles gently through your space.";
    detail.textContent = value ? "WARM FROM THE GROUND UP." : "COOL AIR. A SOFTER LANDING.";
    invalidate();
  };
  const cool = () => setMode(0), warm = () => setMode(1);
  coolButton.addEventListener("click", cool);
  heatButton.addEventListener("click", warm);
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const rect = canvas.getBoundingClientRect();
    targetPointer.set((e.clientX - rect.left) / rect.width - .5, (e.clientY - rect.top) / rect.height - .5);
  };
  const leave = () => targetPointer.set(0, 0);
  canvas.addEventListener("pointermove", move, { passive: true });
  canvas.addEventListener("pointerleave", leave);

  const resize = () => {
    if (!renderer) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    const mobile = innerWidth < 768 || innerWidth < innerHeight;
    const aspect = width / height;
    const worldHeight = mobile ? 9.4 / aspect : 8.7;
    camera.left = -worldHeight * aspect / 2;
    camera.right = worldHeight * aspect / 2;
    camera.top = worldHeight / 2;
    camera.bottom = -worldHeight / 2;
    camera.clearViewOffset();
    if (!mobile) camera.setViewOffset(width, height, -width * .185, -height * .015, width, height);
    camera.updateProjectionMatrix();
  };

  const init = () => {
    if (renderer) return;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      canvas.style.backgroundImage = "url(/images/florida-interior.jpg)";
      canvas.style.backgroundSize = "cover";
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0xf1f2eb, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 50);
    camera.position.set(9, 6.4, 11);
    camera.lookAt(0, 1.55, 0);
    room = new THREE.Group();
    room.rotation.y = -.10;
    scene.add(room);
    const env = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(env, .05);
    scene.environment = target.texture;
    scene.environmentIntensity = .65;
    resources.push(target);
    env.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc6c6b0, .9));
    const sun = new THREE.DirectionalLight(0xfff5df, 3.1);
    sun.position.set(-4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -7;
    sun.shadow.camera.right = sun.shadow.camera.top = 7;
    sun.shadow.normalBias = .035;
    sun.shadow.bias = -.0003;
    sun.shadow.radius = 4;
    scene.add(sun);
    bounce = new THREE.PointLight(0xaddae0, 2.5, 9, 2);
    bounce.position.set(0, 2.6, 0);
    room.add(bounce);

    const texture = (type: "plaster" | "wood" | "linen") => {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const context = c.getContext("2d")!;
      const data = context.createImageData(256, 256);
      let seed = 41;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const grain = type === "wood" ? Math.sin(x * .3 + Math.sin(y * .02) * 2) * 13 : type === "linen" ? (x % 3 === 0 || y % 3 === 0 ? 14 : -3) : 0;
        const n = 208 + random() * 26 + grain;
        const i = (y * 256 + x) * 4;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = n; data.data[i + 3] = 255;
      }
      context.putImageData(data, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(type === "linen" ? 5 : 2, type === "linen" ? 5 : 2);
      resources.push(t); return t;
    };
    const mat = (color: number, roughness = .6, metalness = 0, map?: THREE.Texture) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...(map ? { map, bumpMap: map, bumpScale: .014 } : {}) });
      resources.push(m); return m;
    };
    const plaster = mat(0xe7e6dc, .85, 0, texture("plaster"));
    const stone = mat(0xd6d4c6, .65, 0, texture("plaster"));
    const wood = mat(0x877053, .5, 0, texture("wood"));
    const cream = mat(0xd5d0bb, .95, 0, texture("linen"));
    const ivory = mat(0xf0f3ed, .22, .1);
    const graphite = mat(0x213838, .4, .3);
    const bronze = mat(0x937153, .35, .6);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, radius = .03, parent = room) => {
      const geo = new RoundedBoxGeometry(w, h, d, 3, radius);
      resources.push(geo);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh); return mesh;
    };
    box(6.2, .20, 4.9, 0, -.1, 0, stone, .055);
    box(6.2, 3.8, .12, 0, 1.9, -2.44, plaster);
    // Window openings expose the interior instead of closing the cutaway.
    box(.12, .58, 4.9, -3.04, .29, 0, plaster);
    box(.12, .25, 4.9, -3.04, 3.68, 0, plaster);
    box(.16, 3.8, .16, -3.04, 1.9, -2.38, plaster);
    box(.16, 3.8, .16, -3.04, 1.9, 2.38, plaster);
    const windowMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vPosition;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec2 p=vec2(vPosition.z*.24+.5,vPosition.y*.34+.5);float leaves=ns(p*7.)*.6+ns(p*16.)*.4;float garden=(1.-smoothstep(.22,.88,p.y))*smoothstep(.25,.72,leaves);vec3 sky=mix(vec3(.72,.78,.70),vec3(.91,.94,.86),p.y);vec3 col=mix(sky,vec3(.42,.53,.36),garden*.65);col+=vec3(.10,.09,.055)*exp(-length(p-vec2(.6,.7))*5.);gl_FragColor=vec4(col,1.);}`,
    });resources.push(windowMat);
    box(.04, 2.9, 4.42, -3.055, 2.0, 0, windowMat, .01);
    for (const z of [-2.23, -.72, .72, 2.23]) box(.12, 2.94, .045, -2.98, 2.0, z, bronze, .008);
    box(.12, .045, 4.5, -2.98, 1.3, 0, bronze, .008);
    // Quiet architectural relief, artwork and tiled stone floor.
    for (let i = 0; i < 12; i++) box(.055, 3.7, .10, 2.15 + i * .075, 1.92, -2.34, wood, .008);
    box(.075, .075, 4.5, -2.90, .11, 0, wood, .005);
    box(5.75, .075, .075, 0, .11, -2.31, wood, .005);
    const seam = mat(0xb8b7a9, .9);
    for (let i = 0; i < 4; i++) box(6, .002, .012, 0, .008, -1.8 + i * 1.2, seam, .001);
    for (let i = 0; i < 4; i++) box(.012, .002, 4.7, -2.25 + i * 1.5, .008, 0, seam, .001);
    box(.86, 1.22, .06, -1.79, 2.2, -2.33, wood, .008);
    box(.77, 1.12, .065, -1.79, 2.2, -2.285, mat(0xc5bca4, .9), .005);
    const artGeo = new THREE.CircleGeometry(.23, 48); resources.push(artGeo);
    const art = new THREE.Mesh(artGeo, mat(0x958c6e)); art.position.set(-1.82, 2.26, -2.243); room.add(art);
    box(3.05, .012, 2.55, 1.17, .022, .83, mat(0xc7c8b5, .97, 0, texture("linen")), .005);
    // Low modular linen sofa, separated cushions, seams and oak feet.
    box(2.3, .30, 1.08, 1.54, .32, .45, wood, .075);
    box(2.44, .65, .26, 1.54, .81, -.02, cream, .09);
    for (const x of [.65, 2.43]) box(.26, .47, 1.05, x, .66, .48, cream, .08);
    for (const x of [1.14, 1.94]) {
      box(.77, .23, .87, x, .59, .53, cream, .07);
      const pillow = box(.72, .57, .18, x, .90, .14, cream, .08); pillow.rotation.x = -.13;
    }
    const accent = box(.44, .46, .18, 2.05, .90, .37, mat(0xa7ab90, .96, 0, texture("linen")), .08);
    accent.rotation.z = -.18;
    for (const x of [.70, 2.4]) for (const z of [.08, .91]) box(.08, .20, .08, x, .13, z, wood, .015);
    // Rounded travertine coffee table and small ceramic bowl.
    const table = box(1.30, .12, .95, 1.15, .49, 1.79, stone, .16); table.rotation.y = -.15;
    box(.74, .42, .57, 1.15, .24, 1.79, stone, .09);
    const bowlGeo = new THREE.SphereGeometry(.18, 32, 16, 0, Math.PI * 2, 0, Math.PI * .5); resources.push(bowlGeo);
    const bowl = new THREE.Mesh(bowlGeo, mat(0x424c42, .3)); bowl.scale.y = .4; bowl.rotation.x = Math.PI; bowl.position.set(1.37, .61, 1.7); room.add(bowl);
    // A sculptural indoor palm anchors the corner.
    const potGeo = new THREE.CylinderGeometry(.28, .21, .42, 40); resources.push(potGeo);
    const pot = new THREE.Mesh(potGeo, mat(0xbcb9a6, .75)); pot.position.set(-2.25, .21, -1.55); pot.castShadow = true; room.add(pot);
    const foliage = mat(0x42613c, .8);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4;
      const end = new THREE.Vector3(-2.25 + Math.cos(a) * .57, 1.12 + (i % 3) * .29, -1.55 + Math.sin(a) * .58);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.25, .35, -1.55), new THREE.Vector3(-2.25, 1.22 + (i % 3) * .22, -1.55), end]);
      const stemGeo = new THREE.TubeGeometry(curve, 12, .009, 4, false); resources.push(stemGeo); room.add(new THREE.Mesh(stemGeo, foliage));
      const leafGeo = new THREE.PlaneGeometry(.31, .73, 6, 12);
      const vertices = leafGeo.getAttribute("position");
      for (let j = 0; j < vertices.count; j++) {
        const x = vertices.getX(j), y = vertices.getY(j);
        const taper = Math.pow(Math.max(0,1-Math.pow(y/.365,2)),.65);
        vertices.setXYZ(j,x*taper,y,Math.abs(x)*.22+Math.pow(y/.365,2)*.08);
      }
      leafGeo.computeVertexNormals();resources.push(leafGeo);
      foliage.side=THREE.DoubleSide;
      const leaf=new THREE.Mesh(leafGeo,foliage);leaf.position.copy(end);leaf.rotation.set(-.7,a,-.32);leaf.castShadow=true;room.add(leaf);
    }
    // Split unit, glowing mode strip and a deflector that physically changes angle.
    box(2.20, .58, .39, .28, 3.02, -2.13, ivory, .09);
    box(1.94, .10, .02, .28, 2.79, -1.92, graphite, .025);
    vane = new THREE.Group(); vane.position.set(.28, 2.77, -1.91); room.add(vane);
    box(1.97, .042, .20, 0, 0, .08, ivory, .018, vane);
    indicator = new THREE.MeshBasicMaterial({ color: 0x77c7d2 }); resources.push(indicator);
    box(.18, .016, .012, 1.05, 3.09, -1.925, indicator, .002);
    // Broad thermal veils fill actual room surfaces, separately from the streamlines.
    const thermalMaterial = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uHeat,uTime;void main(){vec3 c=mix(vec3(.38,.78,.83),vec3(.92,.61,.34),uHeat);float cool=pow(vUv.y,2.)*.21;float warm=pow(1.-vUv.y,2.)*.28;float a=mix(cool,warm,uHeat)*(.88+.12*sin(vUv.x*4.+uTime*.2));gl_FragColor=vec4(c,a);}`,
    }); resources.push(thermalMaterial);
    const wallGeo = new THREE.PlaneGeometry(5.98, 3.65); resources.push(wallGeo);
    const veil = new THREE.Mesh(wallGeo, thermalMaterial); veil.position.set(0, 1.88, -2.365); room.add(veil);
    const floorMaterial = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uHeat,uTime;void main(){vec3 c=mix(vec3(.55,.81,.84),vec3(.96,.61,.31),uHeat);float bloom=exp(-length((vUv-vec2(.40,.50))*vec2(1.,1.4))*2.);gl_FragColor=vec4(c,bloom*mix(.08,.30,uHeat));}`,
    }); resources.push(floorMaterial);
    const floorGeo = new THREE.PlaneGeometry(5.98, 4.7); resources.push(floorGeo);
    const floorVeil = new THREE.Mesh(floorGeo, floorMaterial); floorVeil.rotation.x = -Math.PI / 2; floorVeil.position.y = .014; room.add(floorVeil);
    // Frost gives way to tiny lens-like droplets on the window when warmth returns.
    const windowFx = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uHeat,uTime;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 p=vUv;float edge=pow(abs(p.x-.5)*2.,5.)+pow(abs(p.y-.5)*2.,4.);float frost=pow(.5+.5*sin(p.x*150.+sin(p.y*110.)*3.),9.)*edge*.40;vec2 grid=p*vec2(24.,32.);vec2 id=floor(grid),f=fract(grid)-.5;float h=hash(id);f.y+=sin(uTime*.12+h*9.)*.06;float d=length(f*vec2(1.,.75));float drop=(smoothstep(.13,.09,d)-smoothstep(.085,.055,d))*.3*step(.60,h);float shine=exp(-length(f-vec2(-.035,.055))*70.)*.55;float a=mix(frost,(drop+shine)*.9,uHeat);gl_FragColor=vec4(.87,.98,1.,a);}`,
    }); resources.push(windowFx);
    const windowGeo = new THREE.PlaneGeometry(4.4, 2.88); resources.push(windowGeo);
    const glass = new THREE.Mesh(windowGeo, windowFx); glass.rotation.y = Math.PI / 2; glass.position.set(-2.958, 2.0, 0); room.add(glass);

    const coolPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.28,2.76,-1.78),new THREE.Vector3(.25,3.40,-.9),new THREE.Vector3(.0,3.42,.50),
      new THREE.Vector3(-.75,3.0,1.55),new THREE.Vector3(-1.35,2.0,1.80),new THREE.Vector3(-1.40,.65,1.20),new THREE.Vector3(-.65,.42,.1),new THREE.Vector3(.15,1.15,-.9),
    ]);
    const warmPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.28,2.76,-1.78),new THREE.Vector3(.30,1.7,-1.25),new THREE.Vector3(.18,.30,-.25),
      new THREE.Vector3(-.70,.18,.80),new THREE.Vector3(-1.65,.17,1.65),new THREE.Vector3(-2.0,.28,.70),new THREE.Vector3(-1.3,.42,-.55),new THREE.Vector3(-.25,1.35,-1.20),
    ]);
    const segments = 150;
    for (let lane = 0; lane < 11; lane++) {
      const positions = new Float32Array((segments + 1) * 2 * 3), heating = positions.slice(), uv = new Float32Array((segments + 1) * 4);
      const indices: number[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = coolPath.getPoint(t), b = warmPath.getPoint(t);
        const fan = Math.sin(t * Math.PI * .9) * .47;
        const laneOffset = (lane - 5) / 5;
        a.x += laneOffset * (.07 + fan); b.x += laneOffset * (.07 + fan * 1.7);
        a.z += Math.sin(lane * 1.7) * fan * .25; b.z += Math.sin(lane * 1.7) * fan * .45;
        a.y += Math.cos(lane * 1.3) * fan * .13;
        const width = .025 + Math.sin(t * Math.PI) * .13;
        const view = new THREE.Vector3(9,5,11).normalize();
        const coolSide = coolPath.getTangent(t).cross(view).normalize().multiplyScalar(width);
        const heatSide = warmPath.getTangent(t).cross(view).normalize().multiplyScalar(width);
        for (let side = 0; side < 2; side++) {
          const j = (i * 2 + side) * 3;
          const sign=side-.5;
          positions.set([a.x+coolSide.x*sign,a.y+coolSide.y*sign,a.z+coolSide.z*sign],j);
          heating.set([b.x+heatSide.x*sign,b.y+heatSide.y*sign+.005,b.z+heatSide.z*sign],j);
          uv.set([t, side], (i * 2 + side) * 2);
        }
        if (i < segments) { const k = i * 2; indices.push(k,k+1,k+2,k+1,k+3,k+2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
      geo.setAttribute("heating",new THREE.BufferAttribute(heating,3));
      geo.setAttribute("uv",new THREE.BufferAttribute(uv,2)); geo.setIndex(indices); resources.push(geo);
      const material = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uLane: {value: lane} }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: `attribute vec3 heating;uniform float uHeat,uTime,uLane;varying vec2 vUv;void main(){vUv=uv;vec3 p=mix(position,heating,uHeat);p.x+=sin(uv.x*18.+uTime*.7+uLane)*.013*sin(uv.x*3.14159);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `varying vec2 vUv;uniform float uTime,uHeat,uLane;void main(){float pulse=pow(.5+.5*sin(vUv.x*22.-uTime*2.8+uLane*.27),8.);float edge=pow(sin(vUv.y*3.14159),1.5);float fade=smoothstep(0.,.035,vUv.x)*(1.-smoothstep(.65,1.,vUv.x));vec3 col=mix(vec3(.16,.66,.74),vec3(.91,.46,.18),uHeat);gl_FragColor=vec4(col,(.13+pulse*.39)*edge*fade);}`,
      }); resources.push(material);
      const ribbon = new THREE.Mesh(geo,material); ribbon.frustumCulled=false; ribbon.renderOrder=3; room.add(ribbon);
    }
    // Soft contact shadow beneath the floating architectural model.
    const shadowCanvas = document.createElement("canvas");shadowCanvas.width=shadowCanvas.height=128;
    const shadowContext = shadowCanvas.getContext("2d")!;
    const grad=shadowContext.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,"rgba(44,58,47,.28)");grad.addColorStop(1,"rgba(44,58,47,0)");shadowContext.fillStyle=grad;shadowContext.fillRect(0,0,128,128);
    const shadowTexture=new THREE.CanvasTexture(shadowCanvas);resources.push(shadowTexture);
    const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});resources.push(shadowMaterial);
    const shadowGeo=new THREE.PlaneGeometry(10,8);resources.push(shadowGeo);
    const shadowMesh=new THREE.Mesh(shadowGeo,shadowMaterial);shadowMesh.rotation.x=-Math.PI/2;shadowMesh.position.y=-.24;room.add(shadowMesh);
    for (const [x,z,w,d] of [[1.54,.46,2.7,1.35],[1.15,1.79,1.5,1.1],[-2.25,-1.55,.85,.85]]) {
      const g=new THREE.PlaneGeometry(w,d);resources.push(g);
      const contact=new THREE.Mesh(g,shadowMaterial);contact.rotation.x=-Math.PI/2;contact.position.set(x,.037,z);room.add(contact);
    }
    resize();
  };
  // Warm the GPU before the section enters, so first view does not compile shaders.
  const warmup = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      init();
      if (renderer) { renderer.compile(scene,camera); renderer.render(scene,camera); }
      warmup.disconnect();
    }
  }, { rootMargin: "900px 0px" });
  warmup.observe(canvas);
  return {
    resize,
    render(time: number, paused: boolean) {
      if (!renderer) init();
      if (!renderer) return;
      const dt = previous < 0 ? 1/60 : Math.max(0,Math.min(time-previous,.05)); previous=time;
      heat = paused ? targetHeat : THREE.MathUtils.lerp(heat,targetHeat,1-Math.exp(-dt*2.25));
      if (Math.abs(heat-targetHeat)<.001) heat=targetHeat;
      uniforms.uHeat.value=heat;uniforms.uTime.value=time;
      temperature.textContent=String(Math.round(68+heat*6));
      pointer.lerp(targetPointer,paused?1:.035);
      room.rotation.y=-.10+pointer.x*.06;
      room.rotation.x=pointer.y*.012;
      vane.rotation.x=THREE.MathUtils.lerp(-.32,.68,heat);
      indicator.color.copy(coolColor).lerp(heatColor,heat);
      bounce.color.copy(coolColor).lerp(heatColor,heat);
      bounce.position.y=THREE.MathUtils.lerp(2.8,.35,heat);
      renderer.render(scene,camera);
    },
    dispose() {
      warmup.disconnect();
      coolButton.removeEventListener("click",cool);heatButton.removeEventListener("click",warm);
      canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerleave",leave);
      resources.forEach(r=>r.dispose());renderer?.dispose();
    },
  };
}
