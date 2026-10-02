/** A capsule lens refracts a local backdrop, with separate RGB dispersion. */
export function setupGlass(onChange: (temperature: number) => void) {
  const lens = document.querySelector<HTMLElement>("#thermostat")!;
  const room = document.querySelector<HTMLElement>("#glass-room")!;
  const sheen = document.querySelector<HTMLElement>("#glass-sheen")!;
  const light = document.querySelector<SVGElement>("#glass-light")!;
  const range = document.querySelector<HTMLInputElement>("#comfort-range")!;
  const down = document.querySelector<HTMLButtonElement>("#temp-down")!;
  const up = document.querySelector<HTMLButtonElement>("#temp-up")!;
  const map = document.createElement("canvas");
  map.width = 520;
  map.height = 300;
  const context = map.getContext("2d")!;
  const pixels = context.createImageData(map.width, map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const px = x - 260, py = y - 150;
      // Normals of a capsule, rather than the former square-shaped map.
      const nx = px - Math.max(-110, Math.min(110, px));
      const distance = Math.hypot(nx, py);
      const radius = distance / 150;
      const rim = Math.exp(-Math.pow((radius - .91) / .13, 2));
      const strength = Math.min(1, radius * .13 + rim * .86);
      const i = (y * map.width + x) * 4;
      pixels.data[i] = 128 + nx / Math.max(1, distance) * strength * 120;
      pixels.data[i + 1] = 128 + py / Math.max(1, distance) * strength * 120;
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  document.querySelector("#glass-map")!.setAttribute("href", map.toDataURL());
  let temperature = 72, progress = 0, currentX = -7, currentY = 0;
  let pointerX = 0, pointerY = 0, shineX = 25, shineY = 10;
  room.style.transition = "filter 1.1s ease";
  const update = (value: number) => {
    temperature = Math.max(68, Math.min(78, value));
    range.value = String(temperature);
    range.setAttribute("aria-valuetext", `${Math.round(temperature)} degrees Fahrenheit`);
    const displayed = Math.round(temperature);
    document.querySelector("#setpoint")!.textContent = String(displayed);
    document.querySelector("#glass-state")!.textContent = displayed <= 70 ? "A LITTLE COOLER. A LITTLE CALMER." : displayed >= 76 ? "WARMER. JUST THE WAY YOU LIKE IT." : "YOUR KIND OF COMFORT";
    down.disabled = temperature <= 68;
    up.disabled = temperature >= 78;
    const warmth = (temperature - 68) / 10;
    room.style.filter = `brightness(.78) saturate(${1.08 - warmth * .16}) sepia(${warmth * .15}) hue-rotate(${(1 - warmth) * 10}deg)`;
    onChange(temperature);
  };
  const input = () => update(Number(range.value));
  const lower = () => update(Math.round(temperature) - 1);
  const raise = () => update(Math.round(temperature) + 1);
  range.addEventListener("input", input);
  down.addEventListener("click", lower);
  up.addEventListener("click", raise);
  let dragStart = 0, dragTemperature = 72, dragging = false;
  const drag = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragStart = e.clientX;
    dragTemperature = temperature;
    dragging = true;
    lens.setPointerCapture(e.pointerId);
  };
  const release = () => { dragging = false; };
  const move = (e: PointerEvent) => {
    if (dragging) update(dragTemperature + (e.clientX - dragStart) / 20);
    if (e.pointerType !== "mouse") return;
    const rect = lens.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    pointerX = (x - .5) * 8;
    pointerY = (y - .5) * 4;
    shineX = x * 100;
    shineY = y * 100;
  };
  const leave = () => { pointerX = pointerY = 0; shineX = 25; shineY = 10; };
  lens.addEventListener("pointerdown", drag);
  lens.addEventListener("pointerup", release);
  lens.addEventListener("pointercancel", release);
  lens.addEventListener("pointermove", move, { passive: true });
  lens.addEventListener("pointerleave", leave);
  return {
    setProgress(value: number) { progress = value; },
    render(time: number, paused: boolean) {
      const travel = innerWidth < 768 ? 4 : 7;
      const targetX = (temperature - 73) * travel + (paused ? 0 : progress * 16 + pointerX);
      currentX += (targetX - currentX) * (paused ? 1 : .075);
      currentY += ((paused ? 0 : pointerY) - currentY) * .075;
      lens.style.transform = `translate3d(${currentX}px,${currentY}px,0)`;
      sheen.style.backgroundImage = `radial-gradient(ellipse at ${shineX}% ${shineY}%,#ffffff45,transparent 62%)`;
      room.style.transform = `scale(1.045) translate3d(${paused ? 0 : Math.sin(time * .10) * .35}%,${progress * -.7}%,0)`;
      light.style.transform = `translate3d(${paused ? 0 : Math.sin(time * .18) * 18}px,0,0)`;
    },
    dispose() {
      range.removeEventListener("input", input);
      down.removeEventListener("click", lower);
      up.removeEventListener("click", raise);
      lens.removeEventListener("pointerdown", drag);
      lens.removeEventListener("pointerup", release);
      lens.removeEventListener("pointercancel", release);
      lens.removeEventListener("pointermove", move);
      lens.removeEventListener("pointerleave", leave);
    },
  };
}
