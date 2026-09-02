"use client";

import { useEffect, useRef } from "react";

import { reducedMotionQuery } from "@/components/ui/motion-preference";

/*
 * Animated ASCII mathematics.
 *
 * Renders a parametric surface in 3D and shades it with an ASCII density ramp
 * derived from the surface normal against a fixed light. The surface morphs
 * between a torus, a sphere and a Mobius strip, so the hero shows mathematics
 * being done rather than a decorated logo.
 *
 * Performance:
 * - Throttled to ~30fps, paused when off screen or when the tab is hidden.
 * - One z-buffered pass per frame; glyphs are bucketed by brightness so
 *   fillStyle changes a handful of times instead of once per cell.
 * - prefers-reduced-motion draws a single static frame and never loops.
 * - Without JS or canvas, the server-rendered SVG mark underneath is what shows.
 */

const RAMP = ".,-~:;=!*#$@";
const TAU = Math.PI * 2;

const MAX_DPR = 2;
const COLOR_LEVELS = 6;
const FRAME_MS = 33;
/** How long each surface holds before morphing to the next. */
const HOLD_MS = 7000;
const MORPH_MS = 2200;

type Vec3 = [number, number, number];

const SURFACES = ["torus", "sphere", "mobius"] as const;
type Surface = (typeof SURFACES)[number];

const CAPTIONS: Record<Surface, string> = {
  torus: "(R + r·cos v)·cos u",
  sphere: "R·sin v·cos u",
  mobius: "(1 + t·cos(u/2))·cos u",
};

/** Parametric surfaces over u, v in [0, 2pi). */
function surfacePoint(kind: Surface, u: number, v: number): Vec3 {
  if (kind === "torus") {
    const r = 1;
    const R = 2;
    const cv = Math.cos(v);
    return [
      (R + r * cv) * Math.cos(u),
      (R + r * cv) * Math.sin(u),
      r * Math.sin(v),
    ];
  }

  if (kind === "sphere") {
    // v is halved so one pass covers the sphere exactly once.
    const polar = v / 2;
    const R = 2.1;
    const sp = Math.sin(polar);
    return [R * sp * Math.cos(u), R * sp * Math.sin(u), R * Math.cos(polar)];
  }

  // Mobius strip: a band with a single half-twist.
  const t = ((v / TAU) * 2 - 1) * 0.9;
  const half = u / 2;
  const radial = 2 + t * Math.cos(half);
  return [radial * Math.cos(u), radial * Math.sin(u), t * Math.sin(half)];
}

function lerpPoint(a: Vec3, b: Vec3, k: number): Vec3 {
  if (k === 0) return a;
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

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

export interface AsciiFieldProps {
  readonly className?: string;
  /** Cell size in CSS pixels. Larger reads coarser and costs less. */
  readonly cellSize?: number;
}

export function AsciiField({ className, cellSize = 11 }: AsciiFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const caption = captionRef.current;
    if (!container || !canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const motionQuery = reducedMotionQuery();
    const isReduced = () => motionQuery?.matches ?? false;

    const styles = getComputedStyle(container);
    let dim = parseColor(styles.getPropertyValue("--ascii-dim")) ?? [
      70, 62, 78,
    ];
    let bright = parseColor(styles.getPropertyValue("--ascii-bright")) ?? [
      196, 181, 253,
    ];

    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let frame = 0;
    let running = false;
    let startedAt = 0;
    let lastFrameAt = 0;
    let lastCaption = "";

    // Pointer tilt eases toward the pointer rather than snapping to it.
    let targetTiltX = 0;
    let targetTiltY = 0;
    let tiltX = 0;
    let tiltY = 0;

    let depthBuffer = new Float32Array(0);
    let glyphBuffer = new Uint8Array(0);
    const buckets: number[][] = Array.from(
      { length: COLOR_LEVELS },
      () => [] as number[],
    );

    function measure() {
      const rect = container!.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);

      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      context!.textAlign = "center";
      context!.textBaseline = "middle";
      context!.font = `${Math.round(cellSize * 0.95)}px ${
        styles.getPropertyValue("--ascii-font") || "monospace"
      }`;

      columns = Math.max(1, Math.ceil(width / cellSize));
      rows = Math.max(1, Math.ceil(height / cellSize));

      const cells = columns * rows;
      depthBuffer = new Float32Array(cells);
      glyphBuffer = new Uint8Array(cells);
    }

    /** Which surfaces are showing, and how far between them, at time t. */
    function morphState(elapsed: number) {
      const cycle = HOLD_MS + MORPH_MS;
      const index = Math.floor(elapsed / cycle) % SURFACES.length;
      const phase = elapsed % cycle;
      const next = (index + 1) % SURFACES.length;

      if (phase < HOLD_MS) {
        return { from: SURFACES[index], to: SURFACES[index], k: 0 };
      }
      const raw = (phase - HOLD_MS) / MORPH_MS;
      // Smoothstep so the morph eases in and out.
      return {
        from: SURFACES[index],
        to: SURFACES[next],
        k: raw * raw * (3 - 2 * raw),
      };
    }

    function draw(elapsed: number) {
      context!.clearRect(0, 0, width, height);
      depthBuffer.fill(0);
      glyphBuffer.fill(0);
      for (const bucket of buckets) bucket.length = 0;

      const { from, to, k } = morphState(elapsed);

      if (caption) {
        const text = k > 0.5 ? CAPTIONS[to] : CAPTIONS[from];
        if (text !== lastCaption) {
          caption.textContent = text;
          lastCaption = text;
        }
      }

      tiltX += (targetTiltX - tiltX) * 0.06;
      tiltY += (targetTiltY - tiltY) * 0.06;
      const a = elapsed / 2600 + tiltY;
      const b = elapsed / 3700 + tiltX;

      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      const sinB = Math.sin(b);
      const cosB = Math.cos(b);

      const rotate = (vec: Vec3): Vec3 => {
        const [x0, y0, z0] = vec;
        const y1 = y0 * cosA - z0 * sinA;
        const z1 = y0 * sinA + z0 * cosA;
        return [x0 * cosB - y1 * sinB, x0 * sinB + y1 * cosB, z1];
      };

      // Sample density follows the grid so the surface stays continuous.
      const uSteps = Math.min(260, Math.max(96, columns * 3));
      const vSteps = Math.min(150, Math.max(64, rows * 3));
      const du = TAU / uSteps;
      const dv = TAU / vSteps;

      const scale = Math.min(width, height) * 0.42;
      const centreX = width / 2;
      const centreY = height / 2;
      const viewer = 7;

      for (let i = 0; i < uSteps; i += 1) {
        const u = i * du;
        for (let j = 0; j < vSteps; j += 1) {
          const v = j * dv;

          // Position plus two neighbours, for a numeric surface normal.
          const p = lerpPoint(
            surfacePoint(from, u, v),
            surfacePoint(to, u, v),
            k,
          );
          const pu = lerpPoint(
            surfacePoint(from, u + du, v),
            surfacePoint(to, u + du, v),
            k,
          );
          const pv = lerpPoint(
            surfacePoint(from, u, v + dv),
            surfacePoint(to, u, v + dv),
            k,
          );

          const e1x = pu[0] - p[0];
          const e1y = pu[1] - p[1];
          const e1z = pu[2] - p[2];
          const e2x = pv[0] - p[0];
          const e2y = pv[1] - p[1];
          const e2z = pv[2] - p[2];

          let nx = e1y * e2z - e1z * e2y;
          let ny = e1z * e2x - e1x * e2z;
          let nz = e1x * e2y - e1y * e2x;
          const nlen = Math.hypot(nx, ny, nz) || 1;
          nx /= nlen;
          ny /= nlen;
          nz /= nlen;

          const [rx, ry, rz] = rotate(p);
          const [, rny, rnz] = rotate([nx, ny, nz]);

          const depth = viewer + rz;
          if (depth <= 0.15) continue;
          const invDepth = 1 / depth;

          // Glyphs sit on a square cell grid, so no aspect correction is
          // needed here. (A terminal would need roughly 2x on x.)
          const sx = Math.round(centreX + scale * invDepth * rx);
          const sy = Math.round(centreY - scale * invDepth * ry);

          const column = Math.floor(sx / cellSize);
          const row = Math.floor(sy / cellSize);
          if (column < 0 || column >= columns || row < 0 || row >= rows)
            continue;

          const index = row * columns + column;
          if (invDepth <= depthBuffer[index]) continue;

          // Lambert against a fixed light; back faces fall away.
          const luminance = rny * 0.62 - rnz * 0.78;
          if (luminance <= 0) continue;

          depthBuffer[index] = invDepth;
          glyphBuffer[index] =
            Math.min(
              RAMP.length - 1,
              Math.max(0, Math.round(luminance * (RAMP.length - 1))),
            ) + 1;
        }
      }

      for (let index = 0; index < glyphBuffer.length; index += 1) {
        const stored = glyphBuffer[index];
        if (stored === 0) continue;
        const bucket = Math.min(
          COLOR_LEVELS - 1,
          Math.floor(((stored - 1) / (RAMP.length - 1)) * COLOR_LEVELS),
        );
        buckets[bucket].push(index);
      }

      for (let bucket = 0; bucket < COLOR_LEVELS; bucket += 1) {
        const cells = buckets[bucket];
        if (cells.length === 0) continue;

        const mix = bucket / (COLOR_LEVELS - 1);
        const r = Math.round(dim[0] + (bright[0] - dim[0]) * mix);
        const g = Math.round(dim[1] + (bright[1] - dim[1]) * mix);
        const bl = Math.round(dim[2] + (bright[2] - dim[2]) * mix);
        context!.fillStyle = `rgba(${r},${g},${bl},${(0.4 + mix * 0.6).toFixed(2)})`;

        for (const index of cells) {
          const column = index % columns;
          const row = (index - column) / columns;
          context!.fillText(
            RAMP[glyphBuffer[index] - 1],
            column * cellSize + cellSize / 2,
            row * cellSize + cellSize / 2,
          );
        }
      }
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
        draw(0);
        return;
      }
      // Draw one frame synchronously. requestAnimationFrame never fires while
      // the tab is hidden, so without this a page opened in a background tab
      // would show an empty canvas until it was focused.
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
      targetTiltY = ((event.clientX - rect.left) / rect.width - 0.5) * 1.6;
      targetTiltX = ((event.clientY - rect.top) / rect.height - 0.5) * 1.2;
    }

    function handlePointerLeave() {
      targetTiltX = 0;
      targetTiltY = 0;
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
        if (!running) draw(0);
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
  }, [cellSize]);

  return (
    <div
      ref={containerRef}
      className={`ascii-field ${className ?? ""}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="ascii-canvas" />
      <p ref={captionRef} className="ascii-caption" />
    </div>
  );
}
