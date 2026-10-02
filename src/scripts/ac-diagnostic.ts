import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type Symptom = "warm" | "leak" | "power" | "noise" | "thermostat" | "weak";
const issues: Record<Symptom, { zone: string; category: string; title: string; description: string }> = {
  warm: { zone: "COOLING CIRCUIT", category: "LET'S CHECK THE COOLING", title: "Running, but not feeling cooler?", description: "Airflow alone doesn't mean the system is cooling. A technician can check the cooling circuit, controls and airflow to find the cause." },
  leak: { zone: "DRAIN PAN & DRAIN LINE", category: "LET'S CHECK THE DRAINAGE", title: "Water where it shouldn't be?", description: "Moisture should leave through the drain, not into your home. Our team can inspect the drain line, pan and coil to find the source." },
  power: { zone: "POWER & CONTROLS", category: "LET'S CHECK THE CONNECTION", title: "Nothing happens when you turn it on?", description: "Power, controls and protective switches can interrupt operation. A technician can trace the issue and get you moving toward a repair." },
  noise: { zone: "BLOWER & MOVING PARTS", category: "LET'S LISTEN A LITTLE CLOSER", title: "A sound that doesn't belong?", description: "Rattling, buzzing or grinding can come from different parts of the system. We'll inspect the blower, mounting and other moving components." },
  thermostat: { zone: "THERMOSTAT & SIGNAL", category: "LET'S CHECK THE COMMUNICATION", title: "The temperature won't stay put?", description: "The thermostat, sensor and system need to work together. We can check the settings, readings and control signals to understand the mismatch." },
  weak: { zone: "FILTER & AIR PATH", category: "LET'S CHECK THE AIRFLOW", title: "Less air. Less comfort.", description: "A restricted filter, blower issue or duct problem can reduce airflow. Our team can check the air path and identify what needs attention." },
};

export function createACDiagnostic(canvas: HTMLCanvasElement, invalidate: () => void) {
  const section = document.querySelector<HTMLElement>("#diagnostic")!;
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>("[data-symptom]"));
  const zone = document.querySelector<HTMLElement>("#diagnostic-zone")!;
  const thermostatUI = document.querySelector<HTMLElement>("#diagnostic-thermostat")!;
  const reading = document.querySelector("#diagnostic-reading")!;
  const readout = document.querySelector("#diagnostic-readout")!;
  let selected: Symptom = "warm", preview: Symptom = selected;
  let renderer: THREE.WebGLRenderer | undefined, scene: THREE.Scene, camera: THREE.PerspectiveCamera;
  let model: THREE.Group, fan: THREE.Group, cover: THREE.Group, filter: THREE.Group;
  let board: THREE.MeshStandardMaterial, coil: THREE.MeshStandardMaterial, blower: THREE.MeshStandardMaterial, drain: THREE.MeshStandardMaterial, meshFilter: THREE.MeshStandardMaterial;
  let indicator: THREE.MeshBasicMaterial;
  let previous = -1;
  let fanAngle = 0;
  const resources: Array<{ dispose(): void }> = [];
  const uniforms = { uTime: { value: 0 }, uWarm: { value: 0 }, uWeak: { value: 0 }, uOff: { value: 0 } };
  const targets = { warm: 1, weak: 0, off: 0, drip: 0, noise: 0 };
  const current = { warm: 0, weak: 0, off: 0, drip: 0, noise: 0 };
  const droplets: THREE.Mesh[] = [], soundRings: THREE.Mesh[] = [];
  const highlight = new THREE.Color(0xb97b44);
  const connector = new THREE.Group();
  const pointer = new THREE.Vector2(), pointerTarget = new THREE.Vector2();
  const zoneTargets: Record<Symptom, THREE.Vector3> = {
    warm: new THREE.Vector3(.2,.15,.52), leak: new THREE.Vector3(1.5,-.85,.2), power: new THREE.Vector3(1.9,.4,.2),
    noise: new THREE.Vector3(.6,-.42,.5), thermostat: new THREE.Vector3(-2.8,-1.05,.6), weak: new THREE.Vector3(0,1.32,-.05),
  };
  const display = (symptom: Symptom, announce = false) => {
    preview = symptom;
    const issue = issues[symptom];
    buttons.forEach(button => {
      button.dataset.active = String(button.dataset.symptom === symptom);
      button.setAttribute("aria-pressed", String(button.dataset.symptom === selected));
    });
    zone.textContent = issue.zone;
    document.querySelector("#diagnostic-category")!.textContent = issue.category;
    document.querySelector("#diagnostic-title")!.setAttribute("aria-live", announce ? "polite" : "off");
    document.querySelector("#diagnostic-title")!.textContent = issue.title;
    document.querySelector("#diagnostic-description")!.textContent = issue.description;
    // Hover previews remain quiet; intentional selection is announced.
    section.dataset.symptom = symptom;
    targets.warm = Number(symptom === "warm"); targets.weak = Number(symptom === "weak"); targets.off = Number(symptom === "power");
    targets.drip = Number(symptom === "leak"); targets.noise = Number(symptom === "noise");
    thermostatUI.style.borderColor = symptom === "thermostat" ? "#ba9369" : "#b4c8ba";
    thermostatUI.style.color = symptom === "thermostat" ? "#a77953" : "#608c7b";
    if (symptom !== "thermostat") { reading.textContent = symptom === "power" ? "—" : "72°"; readout.textContent = symptom === "power" ? "NO RESPONSE" : "COOL"; }
    invalidate();
  };
  const listeners = buttons.map(button => {
    const symptom = button.dataset.symptom as Symptom;
    const hover = (e: PointerEvent) => { if (e.pointerType === "mouse") display(symptom); };
    const focus = () => display(symptom);
    const click = () => { selected = symptom; display(symptom, true); };
    const leave = () => display(selected);
    button.addEventListener("pointerenter", hover);
    button.addEventListener("pointerleave", leave);
    button.addEventListener("focus", focus);
    button.addEventListener("blur", leave);
    button.addEventListener("click", click);
    return { button, hover, focus, click, leave };
  });
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect(); pointerTarget.set((e.clientX-r.left)/r.width-.5,(e.clientY-r.top)/r.height-.5);
  };
  const leaveCanvas = () => pointerTarget.set(0,0);
  canvas.addEventListener("pointermove",move,{passive:true});canvas.addEventListener("pointerleave",leaveCanvas);
  const resize = () => {
    if (!renderer) return;
    const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    camera.position.z=camera.aspect<1.2?9.7:8.4;
  };
  const init = () => {
    if (renderer) return;
    try { renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"}); }
    catch { return; }
    renderer.setClearColor(0xf6f7f1,0);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,40);camera.position.set(0,1.05,8.4);camera.lookAt(0,-.1,0);
    model=new THREE.Group();model.rotation.y=-.19;model.rotation.x=.06;scene.add(model);
    const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(env,.035);
    scene.environment=target.texture;scene.environmentIntensity=.8;resources.push(target);env.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff,0xaab9ac,1.4));
    const key=new THREE.DirectionalLight(0xfff8e8,3.0);key.position.set(-3,4,6);scene.add(key);
    const rim=new THREE.DirectionalLight(0xa3d6d1,2);rim.position.set(3,1,-2);scene.add(rim);
    const material=(color:number,metalness=.2,roughness=.4) => {const m=new THREE.MeshStandardMaterial({color,metalness,roughness});resources.push(m);return m;};
    const ivory=material(0xe2e9df,.1,.24),steel=material(0x869e97,.75,.35),copper=material(0xb98555,.78,.3),dark=material(0x213d37,.3,.5);
    coil=material(0x69837a,.68,.35);blower=material(0x56776c,.55,.4);drain=material(0x9ab8ad,.6,.33);board=material(0x426655,.35,.45);meshFilter=material(0x7c9b86,.4,.4);
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=.03,parent=model) => {
      const geo=new RoundedBoxGeometry(w,h,d,3,r);resources.push(geo);const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
    };
    box(4.35,1.65,.66,0,0,-.35,ivory,.12);
    box(4.08,1.39,.08,0,-.02,.01,dark,.06);
    // Heat exchanger fins and visible copper returns.
    const finGeo=new THREE.BoxGeometry(.019,.76,.37);resources.push(finGeo);
    const fins=new THREE.InstancedMesh(finGeo,coil,114);const matrix=new THREE.Matrix4();
    for(let i=0;i<114;i++){matrix.makeTranslation(-1.6+i*.028,.25,.28);fins.setMatrixAt(i,matrix);}model.add(fins);
    for(let i=0;i<5;i++){
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.62,.07+i*.135,.49),new THREE.Vector3(1.5,.07+i*.135,.49),new THREE.Vector3(1.66,.13+i*.135,.48),new THREE.Vector3(1.52,.20+i*.135,.38)]);
      const geo=new THREE.TubeGeometry(curve,30,.022,8,false);resources.push(geo);model.add(new THREE.Mesh(geo,copper));
    }
    fan=new THREE.Group();fan.position.set(0,-.45,.27);model.add(fan);
    const drumGeo=new THREE.CylinderGeometry(.20,.20,3.35,40,1,true);resources.push(drumGeo);
    const drum=new THREE.Mesh(drumGeo,blower);drum.rotation.z=Math.PI/2;fan.add(drum);
    const bladeGeo=new THREE.BoxGeometry(3.38,.013,.07);resources.push(bladeGeo);
    for(let i=0;i<40;i++){const a=i/40*Math.PI*2;const blade=new THREE.Mesh(bladeGeo,blower);blade.position.set(0,Math.cos(a)*.205,Math.sin(a)*.205);blade.rotation.x=a;fan.add(blade);}
    box(3.95,.08,.59,0,-.86,.29,drain,.035);
    const drainCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.8,-.86,.29),new THREE.Vector3(2.20,-.95,.29),new THREE.Vector3(2.2,-1.42,.25)]);
    const drainGeo=new THREE.TubeGeometry(drainCurve,16,.035,8,false);resources.push(drainGeo);model.add(new THREE.Mesh(drainGeo,drain));
    box(.39,1.07,.32,1.89,.13,.28,board,.02);
    for(let i=0;i<6;i++)box(.08,.09,.045,1.78+(i%2)*.16,-.2+Math.floor(i/2)*.21,.46,steel,.006);
    box(.14,.3,.055,1.89,.42,.47,dark,.008);
    cover=new THREE.Group();cover.position.set(0,.97,.97);cover.rotation.x=-.32;model.add(cover);
    box(4.37,.84,.12,0,0,0,ivory,.08,cover);
    const logoCanvas=document.createElement("canvas");logoCanvas.width=512;logoCanvas.height=64;
    const lc=logoCanvas.getContext("2d")!;lc.font="24px Helvetica, Arial";lc.fillStyle="#709085";lc.fillText("FULL SPECTRUM",20,44);
    const logoTex=new THREE.CanvasTexture(logoCanvas);resources.push(logoTex);
    const logoMat=new THREE.MeshBasicMaterial({map:logoTex,transparent:true});resources.push(logoMat);
    const logoGeo=new THREE.PlaneGeometry(1.45,.18);resources.push(logoGeo);const logo=new THREE.Mesh(logoGeo,logoMat);logo.position.set(-1.25,.09,.066);cover.add(logo);
    indicator=new THREE.MeshBasicMaterial({color:0x83b6a7});resources.push(indicator);box(.18,.018,.013,1.72,.19,.072,indicator,.003,cover);
    filter=new THREE.Group();filter.position.set(0,1.38,-.15);filter.rotation.x=-.35;model.add(filter);
    const wireGeo=new THREE.BoxGeometry(.012,.34,.014);resources.push(wireGeo);
    for(let i=0;i<90;i++){const mesh=new THREE.Mesh(wireGeo,meshFilter);mesh.position.set(-1.75+i*.039,0,0);filter.add(mesh);}
    for(let i=0;i<5;i++)box(3.57,.014,.014,0,-.17+i*.085,0,meshFilter,.003,filter);
    box(3.66,.027,.05,0,-.19,0,steel,.006,filter);box(3.66,.027,.05,0,.19,0,steel,.006,filter);
    // A faint cable connects thermostat and system rather than floating unrelated UI.
    const signalCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.75,-1.06,.4),new THREE.Vector3(-2.6,-.18,-.05),new THREE.Vector3(-2.1,.24,.2)]);
    const signalGeo=new THREE.TubeGeometry(signalCurve,30,.01,6,false);resources.push(signalGeo);
    const signalMaterial=material(0x97b3a1,.35,.45);connector.add(new THREE.Mesh(signalGeo,signalMaterial));model.add(connector);
    const ringGeo=new THREE.TorusGeometry(.27,.004,6,64);resources.push(ringGeo);
    for(let i=0;i<3;i++){
      const m=new THREE.MeshBasicMaterial({color:0xb48a5e,transparent:true,opacity:0,depthWrite:false});resources.push(m);
      const ring=new THREE.Mesh(ringGeo,m);ring.position.set(1.55,-.45,.51);soundRings.push(ring);model.add(ring);
    }
    const dropletGeo=new THREE.SphereGeometry(.032,12,12);resources.push(dropletGeo);
    const dropletMaterial=new THREE.MeshPhysicalMaterial({color:0xa8d8d1,metalness:.05,roughness:.08,transparent:true,opacity:.7,clearcoat:1});resources.push(dropletMaterial);
    for(let i=0;i<8;i++){const drop=new THREE.Mesh(dropletGeo,dropletMaterial);drop.scale.set(.65,1.4,.65);model.add(drop);droplets.push(drop);}
    // Ribbon speed, width, length and colour all respond to the symptom.
    for(let lane=0;lane<13;lane++){
      const points=new Float32Array(81*2*3),uv=new Float32Array(81*4),index:number[]=[];
      for(let i=0;i<=80;i++){
        const t=i/80,x=(lane-6)*.23;
        for(let side=0;side<2;side++){
          points.set([x+(side-.5)*(.055+t*.06),-.69-t*.76,.57+t*2.3],(i*2+side)*3);uv.set([t,side],(i*2+side)*2);
        }
        if(i<80){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(points,3));geo.setAttribute("uv",new THREE.BufferAttribute(uv,2));geo.setIndex(index);resources.push(geo);
      const m=new THREE.ShaderMaterial({uniforms:{...uniforms,uLane:{value:lane}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
        vertexShader:`uniform float uTime,uWeak,uLane;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;float weak=mix(1.,.35,uWeak);p.x*=mix(1.,.42,uWeak);p.z=.57+(p.z-.57)*weak;p.y=-.69+(p.y+.69)*weak;p.x+=sin(uv.x*9.+uTime*.65+uLane)*.02*uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader:`varying vec2 vUv;uniform float uTime,uWarm,uWeak,uOff,uLane;void main(){float pulse=pow(.5+.5*sin(vUv.x*19.-uTime*mix(3.,.65,uWeak)+uLane*.33),7.);float fade=1.-smoothstep(.12,1.,vUv.x);float alpha=(.18+pulse*.62)*pow(sin(vUv.y*3.14159),1.2)*fade*mix(1.,.3,uWeak)*(1.-uOff);vec3 c=mix(vec3(.27,.65,.71),vec3(.86,.53,.31),uWarm);gl_FragColor=vec4(c,alpha);}`
      });resources.push(m);const ribbons=new THREE.Mesh(geo,m);ribbons.frustumCulled=false;model.add(ribbons);
    }
    // Grounding shadow, softly fading into the editorial background.
    const c=document.createElement("canvas");c.width=c.height=128;const ctx=c.getContext("2d")!;
    const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,"rgba(65,92,74,.18)");gradient.addColorStop(1,"rgba(65,92,74,0)");ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const tex=new THREE.CanvasTexture(c);resources.push(tex);const shadowMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});resources.push(shadowMat);
    const shadowGeo=new THREE.PlaneGeometry(6,2.5);resources.push(shadowGeo);const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.position.set(0,-1.75,.1);shadow.rotation.x=-Math.PI/2;model.add(shadow);
    resize();
  };
  const warmup=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){init();if(renderer){renderer.compile(scene,camera);renderer.render(scene,camera);}warmup.disconnect();}
  },{rootMargin:"700px 0px"});warmup.observe(canvas);
  return {
    resize,
    render(time:number,paused:boolean){
      if(!renderer)init();if(!renderer)return;
      const dt=previous<0?1/60:Math.max(0,Math.min(time-previous,.05));previous=time;
      const factor=paused?1:1-Math.exp(-dt*4);
      (Object.keys(current) as Array<keyof typeof current>).forEach(key=>{current[key]=THREE.MathUtils.lerp(current[key],targets[key],factor);});
      uniforms.uTime.value=time;uniforms.uWarm.value=current.warm;uniforms.uWeak.value=current.weak;uniforms.uOff.value=current.off;
      pointer.lerp(pointerTarget,paused?1:.035);model.rotation.y=-.19+pointer.x*.08;model.rotation.x=.06+pointer.y*.03;
      if (!paused) fanAngle += dt * (1-current.off) * 1.7;
      fan.rotation.x=fanAngle;
      const vibrate=paused?0:Math.sin(time*34)*current.noise*.014;fan.position.y=-.45+vibrate;fan.position.z=.27+vibrate*.5;
      indicator.color.set(preview==="power"?0xa7b7ab:preview==="thermostat"?0xb88d63:0x83b6a7);
      const materials=[coil,drain,board,blower,meshFilter],keys:Symptom[]=["warm","leak","power","noise","weak"];
      materials.forEach((m,i)=>{m.emissive.copy(highlight);m.emissiveIntensity=keys[i] === preview ? .18+(paused?0:.035*Math.sin(time*2.0)) : 0;});
      const pulse=paused?0:time*.5;
      soundRings.forEach((ring,i)=>{const phase=(pulse+i/3)%1;ring.scale.setScalar(1+phase*2);(ring.material as THREE.MeshBasicMaterial).opacity=(1-phase)*current.noise*.35;});
      droplets.forEach((drop,i)=>{const phase=(time*.33+i/8)%1;drop.position.set(1.42+Math.sin(i*2.1)*.22,-.9-phase*.85,.37);drop.scale.y=.7+phase*1.1;drop.visible=current.drip>.02;(drop.material as THREE.MeshPhysicalMaterial).opacity=current.drip*.7;});
      if(preview==="thermostat"){
        const step=paused?0:Math.floor(time*1.5)%6;reading.textContent=["72°","76°","71°","75°","72°","—"][step];readout.textContent=step===5?"SIGNAL LOST":"CHECK READING";
        thermostatUI.style.transform=`translate3d(${paused?0:Math.sin(time*18)*.6}px,0,0)`;
      }else thermostatUI.style.transform="none";
      const target=zoneTargets[preview].clone();model.updateMatrixWorld();model.localToWorld(target);target.project(camera);
      const x=(target.x*.5+.5)*canvas.clientWidth,y=(-target.y*.5+.5)*canvas.clientHeight;
      const left=Math.max(12,Math.min(canvas.clientWidth-zone.offsetWidth-12,x-20));
      const top=Math.max(12,y-75);
      zone.style.left=`${left}px`;zone.style.top=`${top}px`;
      document.querySelector("#diagnostic-leader")!.setAttribute("d",`M ${left+zone.offsetWidth*.5} ${top+zone.offsetHeight} L ${x} ${y}`);
      document.querySelector("#diagnostic-spot")!.setAttribute("cx",String(x));
      document.querySelector("#diagnostic-spot")!.setAttribute("cy",String(y));
      renderer.render(scene,camera);
    },
    dispose(){warmup.disconnect();listeners.forEach(({button,hover,focus,click,leave})=>{button.removeEventListener("pointerenter",hover);button.removeEventListener("pointerleave",leave);button.removeEventListener("focus",focus);button.removeEventListener("blur",leave);button.removeEventListener("click",click);});canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerleave",leaveCanvas);resources.forEach(r=>r.dispose());renderer?.dispose();},
  };
}
