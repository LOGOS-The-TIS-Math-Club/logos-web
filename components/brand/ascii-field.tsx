"use client";

import { useEffect, useRef } from "react";

import { reducedMotionQuery } from "@/components/ui/motion-preference";

/*
 * Layered ASCII banner.
 *
 * Three separate canvases stacked in z, each drawn at a different glyph size,
 * brightness and parallax factor. Depth comes from those differences rather
 * than from a shadow: the back plate is coarse, dim and barely moves; the front
 * plate is fine, bright and tracks the pointer fully.
 *
 *   back   a trigonometric wave plotting itself left to right
 *   mid    a cubic sweeping the other way, reshaping as its roots drift
 *   front  the official five-circle logomark, spinning in 3D
 *
 * One rAF loop drives all three. Throttled to ~30fps, paused off screen and in
 * hidden tabs, one synchronous frame on start so a background tab is never
 * blank, and a single static frame under prefers-reduced-motion.
 */

const TAU = Math.PI * 2;
const MAX_DPR = 2;
const FRAME_MS = 33;

/** One ramp per layer, so the planes read as different material. */
const WAVE_RAMP = "·-~=≈";
const CUBIC_RAMP = ".:*+#";
const MARK_RAMP = "·:+*#@";

interface LayerConfig {
  readonly cell: number;
  /** 0 = ignores the pointer, 1 = tracks it fully. */
  readonly parallax: number;
  readonly alpha: number;
}

const LAYERS: Record<"back" | "mid" | "front", LayerConfig> = {
  back: { cell: 17, parallax: 0.18, alpha: 0.4 },
  mid: { cell: 13, parallax: 0.45, alpha: 0.62 },
  front: { cell: 10, parallax: 1, alpha: 1 },
};

function parseColor(value: string): [number, number, number] | null {
  const trimmed = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(trimmed);
  if (rgb) {
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return null;
}

/*
 * The official logomark: five circles in a quincunx, radius 96 in a 300 box.
 *
 * The third value is a z offset. The printed mark is flat, but a flat mark
 * rotating about Y collapses to a sliver twice per turn. Pushing the diagonal
 * pairs fore and aft turns it into a shallow lattice that stays legible at
 * every angle, and reads as the mark from the front.
 */
const MARK_CIRCLES = [
  [150, 150, 0],
  [198, 198, 44],
  [102, 102, -44],
  [102, 198, 44],
  [198, 102, -44],
] as const;

export interface AsciiFieldProps {
  readonly className?: string;
}

export function AsciiField({ className }: AsciiFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const back = backRef.current;
    const mid = midRef.current;
    const front = frontRef.current;
    if (!container || !back || !mid || !front) return;

    const backContext = back.getContext("2d", { alpha: true });
    const midContext = mid.getContext("2d", { alpha: true });
    const frontContext = front.getContext("2d", { alpha: true });
    if (!backContext || !midContext || !frontContext) return;

    const planes = [
      { canvas: back, context: backContext, config: LAYERS.back },
      { canvas: mid, context: midContext, config: LAYERS.mid },
      { canvas: front, context: frontContext, config: LAYERS.front },
    ];

    const motionQuery = reducedMotionQuery();
    const isReduced = () => motionQuery?.matches ?? false;

    const styles = getComputedStyle(container);
    let dim = parseColor(styles.getPropertyValue("--ascii-dim")) ?? [
      70, 62, 78,
    ];
    let bright = parseColor(styles.getPropertyValue("--ascii-bright")) ?? [
      196, 181, 253,
    ];
    const font = styles.getPropertyValue("--ascii-font") || "monospace";

    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;
    let startedAt = 0;
    let lastFrameAt = 0;

    let pointerX = 0.5;
    let pointerY = 0.5;
    let easedX = 0.5;
    let easedY = 0.5;

    function measure() {
      const rect = container!.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

      for (const plane of planes) {
        plane.canvas.width = Math.floor(width * dpr);
        plane.canvas.height = Math.floor(height * dpr);
        plane.context.setTransform(dpr, 0, 0, dpr, 0, 0);
        plane.context.textAlign = "center";
        plane.context.textBaseline = "middle";
        plane.context.font = `${Math.round(plane.config.cell * 1.05)}px ${font}`;
      }
    }

    function colorAt(mix: number, alpha: number) {
      const r = Math.round(dim[0] + (bright[0] - dim[0]) * mix);
      const g = Math.round(dim[1] + (bright[1] - dim[1]) * mix);
      const b = Math.round(dim[2] + (bright[2] - dim[2]) * mix);
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    }

    function offsets(parallax: number) {
      return {
        x: (easedX - 0.5) * 46 * parallax,
        y: (easedY - 0.5) * 30 * parallax,
      };
    }

    /* ------------- back plate: a trigonometric wave plotting itself -------- */
    function drawWave(t: number) {
      const { cell, parallax, alpha } = LAYERS.back;
      backContext!.clearRect(0, 0, width, height);

      const { x: offsetX, y: offsetY } = offsets(parallax);
      const columns = Math.ceil(width / cell);
      const midY = height / 2 + offsetY;
      const amplitude = Math.min(height * 0.3, 150);

      // A sweep head runs left to right; glyphs behind it are already plotted.
      const sweep = ((t / 5200) % 1.35) * columns;

      for (let i = 0; i < columns; i += 1) {
        if (i > sweep) break;
        const phase = (i / columns) * TAU * 2;

        // Two superposed waves, so it reads as interference, not a bare sine.
        const y =
          midY +
          Math.sin(phase + t / 1400) * amplitude * 0.6 +
          Math.cos(phase * 2.3 - t / 2100) * amplitude * 0.25;

        const age = Math.min(1, (sweep - i) / 8);
        const level = Math.min(
          WAVE_RAMP.length - 1,
          Math.floor(age * WAVE_RAMP.length),
        );
        backContext!.fillStyle = colorAt(0.15, alpha * (0.35 + age * 0.65));
        backContext!.fillText(
          WAVE_RAMP[level],
          i * cell + cell / 2 + offsetX,
          y,
        );
      }
    }

    /* ------------- mid plate: a cubic sweeping the other way --------------- */
    function drawCubic(t: number) {
      const { cell, parallax, alpha } = LAYERS.mid;
      midContext!.clearRect(0, 0, width, height);

      const { x: offsetX, y: offsetY } = offsets(parallax);
      const columns = Math.ceil(width / cell);
      const midY = height / 2 + offsetY;
      const amplitude = Math.min(height * 0.34, 170);

      // Roots drift, so the curve reshapes rather than merely sliding.
      const r1 = Math.sin(t / 3300) * 0.72;
      const r2 = Math.sin(t / 4700 + 1.1) * 0.72;
      const r3 = Math.sin(t / 6100 + 2.3) * 0.72;

      const sweep = (1 - ((t / 6400) % 1.3)) * columns;

      for (let i = 0; i < columns; i += 1) {
        if (i < sweep) continue;
        const u = (i / columns) * 2 - 1;
        // y = (u - r1)(u - r2)(u - r3), scaled into the banner.
        const y = midY - (u - r1) * (u - r2) * (u - r3) * amplitude * 1.9;
        if (y < -cell || y > height + cell) continue;

        const age = Math.min(1, (i - sweep) / 10);
        const level = Math.min(
          CUBIC_RAMP.length - 1,
          Math.floor(age * CUBIC_RAMP.length),
        );
        midContext!.fillStyle = colorAt(0.55, alpha * (0.3 + age * 0.7));
        midContext!.fillText(
          CUBIC_RAMP[level],
          i * cell + cell / 2 + offsetX,
          y,
        );
      }
    }

    /* ------------- front plate: the logomark spinning in 3D ---------------- */
    function drawMark(t: number) {
      const { cell, parallax, alpha } = LAYERS.front;
      frontContext!.clearRect(0, 0, width, height);

      const { x: offsetX, y: offsetY } = offsets(parallax);

      // Spin about Y, with a gentle nod about X so it never looks like a decal.
      const spin = t / 2400 + (easedX - 0.5) * 1.2;
      const nod = Math.sin(t / 3600) * 0.42 + (easedY - 0.5) * 0.5;
      const cosSpin = Math.cos(spin);
      const sinSpin = Math.sin(spin);
      const cosNod = Math.cos(nod);
      const sinNod = Math.sin(nod);

      // Mark units are a 300-wide box; this maps it to ~62% of the shorter
      // side of the banner.
      const markScale = (Math.min(width, height) * 0.62) / 300;
      const centreX = width / 2 + offsetX;
      const centreY = height / 2 + offsetY;
      const viewer = 620;
      const samples = 132;

      for (const [cx, cy, cz] of MARK_CIRCLES) {
        for (let s = 0; s < samples; s += 1) {
          const a = (s / samples) * TAU;
          const px = cx - 150 + Math.cos(a) * 96;
          const py = cy - 150 + Math.sin(a) * 96;

          // Rotate about Y, then about X.
          const x1 = px * cosSpin + cz * sinSpin;
          const z1 = -px * sinSpin + cz * cosSpin;
          const y2 = py * cosNod - z1 * sinNod;
          const z2 = py * sinNod + z1 * cosNod;

          const depth = viewer + z2;
          if (depth <= 1) continue;
          const perspective = viewer / depth;

          const sx = centreX + x1 * markScale * perspective;
          const sy = centreY + y2 * markScale * perspective;
          if (sx < -cell || sx > width + cell) continue;
          if (sy < -cell || sy > height + cell) continue;

          // Nearer samples are brighter and denser, so the spin reads as depth.
          const nearness = Math.min(1, Math.max(0, (perspective - 0.82) / 0.4));
          const level = Math.min(
            MARK_RAMP.length - 1,
            Math.floor(nearness * MARK_RAMP.length),
          );
          frontContext!.fillStyle = colorAt(
            0.55 + nearness * 0.45,
            alpha * (0.28 + nearness * 0.72),
          );
          frontContext!.fillText(MARK_RAMP[level], sx, sy);
        }
      }
    }

    function draw(t: number) {
      easedX += (pointerX - easedX) * 0.07;
      easedY += (pointerY - easedY) * 0.07;
      drawWave(t);
      drawCubic(t);
      drawMark(t);
    }

    function tick(now: number) {
      if (!startedAt) startedAt = now;
      if (now - lastFrameAt >= FRAME_MS) {
        lastFrameAt = now;
        draw(now - startedAt);
      }
      frame = window.requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      measure();
      container!.dataset.asciiStatus = "live";

      if (isReduced()) {
        easedX = 0.5;
        easedY = 0.5;
        draw(2600);
        return;
      }

      // One synchronous frame: rAF never fires while the tab is hidden.
      startedAt = 0;
      draw(0);
      running = true;
      lastFrameAt = 0;
      frame = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      running = false;
    }

    function handlePointerMove(event: PointerEvent) {
      if (isReduced()) return;
      const rect = container!.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width;
      pointerY = (event.clientY - rect.top) / rect.height;
    }

    function handlePointerLeave() {
      pointerX = 0.5;
      pointerY = 0.5;
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") stop();
      else if (!isReduced()) start();
    }

    let visibility: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      start();
    } else {
      visibility = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) start();
            else stop();
          }
        },
        { rootMargin: "120px" },
      );
      visibility.observe(container);
    }

    let resize: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resize = new ResizeObserver(() => {
        measure();
        if (!running) draw(2600);
      });
      resize.observe(container);
    }

    function handleMotionPreferenceChange() {
      stop();
      dim = parseColor(styles.getPropertyValue("--ascii-dim")) ?? dim;
      bright = parseColor(styles.getPropertyValue("--ascii-bright")) ?? bright;
      start();
    }

    motionQuery?.addEventListener("change", handleMotionPreferenceChange);
    document.addEventListener("visibilitychange", handleVisibility);
    container.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    container.addEventListener("pointerleave", handlePointerLeave, {
      passive: true,
    });

    return () => {
      stop();
      visibility?.disconnect();
      resize?.disconnect();
      motionQuery?.removeEventListener("change", handleMotionPreferenceChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`ascii-field ${className ?? ""}`}
      aria-hidden="true"
    >
      <canvas ref={backRef} className="ascii-canvas ascii-canvas-back" />
      <canvas ref={midRef} className="ascii-canvas ascii-canvas-mid" />
      <canvas ref={frontRef} className="ascii-canvas ascii-canvas-front" />
    </div>
  );
}
