import { useEffect, useRef, useState } from "react";
import { createAmbience } from "../../core/audio";
import { supportsWebGL2, watchReducedMotion } from "../../core/capabilities";
import { createUmbraFallback } from "./fallback";
import { createUmbraScene, type UmbraOptions, type UmbraScene } from "./scene";
import "../entity-001/entity-001.css";

type Mode = "webgl" | "fallback";

export default function Entity002() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>(() => supportsWebGL2() ? "webgl" : "fallback");
  const [label, setLabel] = useState(() => mode === "webgl" ? "materializando" : "modo essencial");
  const [sound, setSound] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [ambience] = useState(createAmbience);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ambience.dispose(); };
  }, [ambience]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = document.createElement("canvas");
    canvas.className = mode === "webgl" ? "entity-canvas" : "entity-fallback";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Criatura de sombra flutuante com olhos carmesim, sorriso de presas e garras longas, diante de uma lua eclipsada.");
    stage.prepend(canvas);
    let scene: UmbraScene | null = null;
    const stopReduced = watchReducedMotion(value => scene?.setReduced(value));
    const options: UmbraOptions = {
      canvas, reduced: typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      compact: typeof window.matchMedia === "function" && window.matchMedia("(max-width: 700px)").matches,
      onState: setLabel, onEnergy: ambience.setEnergy,
      onContextLost() { setLabel("modo essencial"); setMode("fallback"); },
    };
    try {
      scene = mode === "webgl" ? createUmbraScene(options) : createUmbraFallback(options);
    } catch {
      stopReduced(); canvas.remove();
      queueMicrotask(() => { if (mounted.current) { setLabel("modo essencial"); setMode("fallback"); } });
      return;
    }
    const active = scene;
    let inView = true;
    const resize = () => {
      const width = stage.clientWidth, height = stage.clientHeight;
      active.setVisible(inView && width > 0 && height > 0);
      if (width > 0 && height > 0) active.setSize(width, height);
    };
    const resizer = new ResizeObserver(resize);
    resizer.observe(stage); resize();
    const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; resize(); });
    visibility.observe(stage);
    const toNdc = (event: PointerEvent) => {
      const bounds = stage.getBoundingClientRect();
      return { x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        y: 1 - ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 };
    };
    const onMove = (event: PointerEvent) => { const p = toNdc(event); active.pointer(p.x, p.y); };
    const onDown = (event: PointerEvent) => { if (event.button === 0) { const p = toNdc(event); active.tap(p.x, p.y); ambience.pulse(); } };
    const onLeave = () => active.leave();
    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerdown", onDown, { passive: true });
    stage.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointerleave", onLeave);
      resizer.disconnect(); visibility.disconnect(); stopReduced();
      active.dispose(); canvas.remove();
    };
  }, [mode, ambience]);

  const toggleSound = async () => {
    if (soundPending) return;
    if (sound) { ambience.stop(); setSound(false); return; }
    setSoundPending(true);
    const started = await ambience.start();
    if (mounted.current) { setSound(started); setSoundPending(false); }
  };
  return (
    <section className="entity-experiment" aria-label="ENTITY 002 — UMBRA">
      <div className="entity-stage" ref={stageRef} />
      <div className="entity-caption">
        <h1 className="entity-name">ENTITY 002 <span>— UMBRA</span></h1>
        <p className="entity-readout" aria-live="polite"><span className="entity-state-dot" aria-hidden="true" />{label}</p>
      </div>
      <div className="entity-controls">
        <button type="button" aria-pressed={sound} aria-label={sound ? "Desativar som" : "Ativar som"}
          disabled={soundPending} onClick={() => void toggleSound()}>som <span aria-hidden="true">{sound ? "on" : "off"}</span></button>
      </div>
    </section>
  );
}
