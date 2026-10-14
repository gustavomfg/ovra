import { createFrameLoop } from "../../core/frameLoop";
import { Spring } from "../../core/spring";
import type { UmbraOptions, UmbraScene } from "./scene";

// Without WebGL2 the creature is reduced to what matters most: two slanted
// burning eyes and a grin in the dark that keep watching the visitor.
export function createUmbraFallback(options: UmbraOptions): UmbraScene {
  const { canvas } = options;
  const context = canvas.getContext("2d");
  const noop = () => undefined;
  options.onState("modo essencial");
  if (!context) return { setSize: noop, setVisible: noop, setReduced: noop, pointer: noop, leave: noop, tap: noop, dispose: noop };
  const ctx: CanvasRenderingContext2D = context;
  let width = 1, height = 1, reduced = options.reduced, present = false, laugh = 0;
  const cursor = { x: 0, y: 0 };
  const x = new Spring(0, 30), y = new Spring(0, 30);

  function eye(cx: number, cy: number, side: number, size: number, gx: number, gy: number) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(side * 0.38);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.6);
    glow.addColorStop(0, "rgba(255,120,140,0.9)"); glow.addColorStop(0.45, "rgba(255,30,70,0.45)"); glow.addColorStop(1, "rgba(255,0,40,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, size * 1.6, size * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff3a5c"; ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#170006"; ctx.beginPath(); ctx.ellipse(gx * size * 0.45, gy * size * 0.12, size * 0.08, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function tick(dt: number, elapsed: number) {
    const gx = x.step(present ? cursor.x : 0, dt), gy = y.step(present ? cursor.y : 0, dt);
    laugh = Math.max(0, laugh - dt * 0.8);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#07050a"; ctx.fillRect(0, 0, width, height);
    const s = Math.min(width, height) * 0.09;
    const cx = width / 2 + gx * s * 0.6, cy = height * 0.42 - gy * s * 0.4 + (reduced ? 0 : Math.sin(elapsed * 0.85) * s * 0.08);
    eye(cx - s * 1.1, cy, 1, s, gx, -gy);
    eye(cx + s * 1.1, cy, -1, s, gx, -gy);
    ctx.strokeStyle = `rgba(230,220,210,${0.55 + laugh * 0.4})`; ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const u = i / 18 * 2 - 1, px = cx + u * s * 2.4, py = cy + s * 1.3 - s * 0.9 * (1 - u * u);
      const tooth = i % 2 ? s * 0.22 : 0;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py + tooth);
    }
    ctx.stroke();
  }
  const loop = createFrameLoop(tick);
  loop.start();
  return {
    setSize(w, h) { const dpr = Math.min(window.devicePixelRatio || 1, 2); width = w * dpr; height = h * dpr; canvas.width = width; canvas.height = height; },
    setVisible: loop.setVisible,
    setReduced(value) { reduced = value; },
    pointer(px, py) { cursor.x = px; cursor.y = py; present = true; },
    leave() { present = false; },
    tap() { laugh = 1; },
    dispose() { loop.dispose(); },
  };
}
