/** Particles sample one shared flow field. No particle stores a direction. */
export function createAirFlow(canvas: HTMLCanvasElement, section: HTMLElement) {
  const ctx = canvas.getContext("2d")!;
  const count = 1400, columns = 38, rows = 28;
  const x = new Float32Array(count), y = new Float32Array(count), age = new Float32Array(count);
  const fieldX = new Float32Array(columns * rows), fieldY = new Float32Array(columns * rows);
  let width = 1, height = 1, mobile = false, previous = -1, initialized = false;
  let pointerX = -10000, pointerY = -10000;
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 48;
  const sc = sprite.getContext("2d")!;
  const gradient = sc.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, "rgba(48,151,149,.40)");
  gradient.addColorStop(.3, "rgba(54,173,168,.22)");
  gradient.addColorStop(1, "rgba(88,190,175,0)");
  sc.fillStyle = gradient;
  sc.fillRect(0, 0, 48, 48);
  const spawn = (i: number) => {
    x[i] = width * (mobile ? .5 : .76) + (Math.random() - .5) * width * .13;
    y[i] = height * .80 + Math.random() * 16;
    age[i] = 240 + Math.random() * 160;
  };
  const fillField = (time: number) => {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const px = i / (columns - 1) * width, py = j / (rows - 1) * height;
        const nx = px / width, ny = py / height;
        const index = j * columns + i;
        const curl = Math.sin(nx * 13 + ny * 9 + time * .45) + Math.cos(nx * 7 - ny * 11 - time * .28);
        let vx = curl * .65 + Math.sin(ny * 7 + time * .4) * .4;
        let vy = -1.15 + Math.cos(nx * 12 + ny * 4 + time * .35) * .38;
        const dx = px - pointerX, dy = py - pointerY;
        const distance = Math.sqrt(dx * dx + dy * dy) + 1;
        const push = Math.exp(-distance / 140) * 3;
        vx += (dx - dy * .5) / distance * push;
        vy += (dy + dx * .5) / distance * push;
        // Keep the plume on the spacious side of the composition.
        const boundary = mobile ? .14 : .50;
        vx += Math.max(0, boundary - nx) * 10 - Math.max(0, nx - .92) * 10;
        fieldX[index] = vx;
        fieldY[index] = vy;
      }
    }
  };
  const step = (dt: number, draw: boolean) => {
    if (draw) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,.085)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    }
    for (let i = 0; i < count; i++) {
      let fx = x[i] / width * (columns - 1), fy = y[i] / height * (rows - 1);
      fx = Math.max(0, Math.min(columns - 1.001, fx));
      fy = Math.max(0, Math.min(rows - 1.001, fy));
      const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
      const a = iy * columns + ix, b = a + 1, c = a + columns, d = c + 1;
      const vx = (fieldX[a] * (1 - ax) + fieldX[b] * ax) * (1 - ay) + (fieldX[c] * (1 - ax) + fieldX[d] * ax) * ay;
      const vy = (fieldY[a] * (1 - ax) + fieldY[b] * ax) * (1 - ay) + (fieldY[c] * (1 - ax) + fieldY[d] * ax) * ay;
      x[i] += vx * dt * height * .0023;
      y[i] += vy * dt * height * .0023;
      age[i] -= dt;
      if (age[i] <= 0 || y[i] < height * (mobile ? .48 : .12)) spawn(i);
      if (draw) {
        const size = 2.4 + (i % 9) * .35;
        ctx.globalAlpha = Math.min(1, age[i] / 65) * (mobile ? .58 : .8);
        ctx.drawImage(sprite, x[i] - size / 2, y[i] - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  };
  const resize = () => {
    width = canvas.clientWidth || innerWidth;
    height = canvas.clientHeight || innerHeight;
    mobile = width < 768 || width < height;
    const dpr = Math.min(devicePixelRatio, 1.4);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < count; i++) { spawn(i); age[i] = Math.random() * 350; }
    fillField(0);
    for (let i = 0; i < 260; i++) step(1, i > 230);
    previous = -1;
    initialized = true;
  };
  const move = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
  };
  const leave = () => { pointerX = pointerY = -10000; };
  section.addEventListener("pointermove", move, { passive: true });
  section.addEventListener("pointerleave", leave);
  resize();
  return {
    resize,
    render(time: number, paused: boolean) {
      if (!initialized) resize();
      if (paused || previous === time) return;
      const dt = previous < 0 ? 1 : Math.min((time - previous) * 60, 3);
      previous = time;
      fillField(time);
      step(Math.max(.01, dt), true);
    },
    dispose() {
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
    },
  };
}
