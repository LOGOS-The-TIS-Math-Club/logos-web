"use client";

import { useEffect, useRef } from "react";

import { reducedMotionQuery } from "@/components/ui/motion-preference";

import {
  CIRCLE_RADIUS,
  CORNER,
  SIGN_SOURCES,
  SIGN_TARGETS,
} from "./mark-geometry";
import { triangleWave } from "./scene-timing";

/*
 * Animated ASCII banner.
 *
 * Three stacked canvases. The two back plates carry flat ambient mathematics;
 * the front plate carries a real 3D scene the visitor can grab and spin.
 *
 * The front scene is the point of it. The LOGOS mark is the therefore sign and
 * the because sign collapsed together: ∴ is one dot above two, ∵ is two dots
 * above one, and laid over each other their six dots resolve into the mark's
 * five circles — the two apex dots meet in the middle. The "collapse" scene
 * plays exactly that, then holds on the finished mark.
 *
 * Each page picks a different scene, so the banners read as distinct places
 * while sharing one structure. Colour is set from CSS custom properties, so a
 * page can retint the field without touching this file.
 *
 * Performance: ~30fps, paused off screen and in hidden tabs, one synchronous
 * frame on start so a background tab is never blank, a single static frame
 * under prefers-reduced-motion, and DPR capped at 2.
 */

const TAU = Math.PI * 2;
const MAX_DPR = 2;
const FRAME_MS = 33;

const WAVE_RAMP = "·-~=≈";
const CUBIC_RAMP = ".:*+#";
const POINT_RAMP = "·:+*#@";

export type AsciiScene = "collapse" | "mark" | "orbit" | "network";

interface SceneConfig {
  readonly back: "wave" | "grid" | "none";
  readonly mid: "cubic" | "wave2" | "none";
}

const SCENES: Record<AsciiScene, SceneConfig> = {
  collapse: { back: "wave", mid: "cubic" },
  mark: { back: "grid", mid: "none" },
  orbit: { back: "wave", mid: "wave2" },
  network: { back: "grid", mid: "none" },
};

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 0–1; drives glyph density and colour mix. */
  readonly bright: number;
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

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Samples a circle outline into 3D points on a constant-z plane. */
function pushCircle(
  out: Point3[],
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  bright: number,
  samples: number,
) {
  if (radius < 0.75) {
    out.push({ x: cx, y: cy, z: cz, bright });
    return;
  }
  for (let i = 0; i < samples; i += 1) {
    const a = (i / samples) * TAU;
    out.push({
      x: cx + Math.cos(a) * radius,
      y: cy + Math.sin(a) * radius,
      z: cz,
      bright,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Scenes                                                                     */
/* -------------------------------------------------------------------------- */

/** ∴ and ∵ drifting together, then opening into the five-circle mark. */
function sceneCollapse(t: number): Point3[] {
  const CYCLE = 12000;

  // A plain (t % CYCLE) / CYCLE sawtooth snaps from 1 back to 0 every cycle —
  // the fully-formed mark would vanish and reappear as two separated dots in
  // a single frame, which reads as the whole animation resetting. A triangle
  // wave climbs to 1 and eases back down instead, so the signs converge, hold
  // as the mark, then un-collapse back apart continuously before repeating.
  const phase = triangleWave(t, CYCLE);

  /*
   * Weighted so the resolved mark is what you mostly see. The earlier split
   * left a third of the cycle showing six specks and no recognisable form:
   * the transition is the punctuation, not the subject.
   *
   * 0.00–0.08 the two signs hold apart, on separate planes.
   * 0.08–0.44 they converge; the dots open into circles.
   * 0.44–1.00 the finished mark holds and turns.
   */
  const travel = smoothstep(0.08, 0.4, phase);
  const open = smoothstep(0.14, 0.44, phase);

  const points: Point3[] = [];

  for (let i = 0; i < SIGN_SOURCES.length; i += 1) {
    const [sx, sy] = SIGN_SOURCES[i];
    const [tx, ty] = SIGN_TARGETS[i];

    // The two signs sit on opposite planes and slide together as they collapse.
    const plane = i < 3 ? 1 : -1;
    const z = plane * 74 * (1 - travel);
    const x = sx + (tx - sx) * travel;
    const y = sy + (ty - sy) * travel;

    // The ∵ base dot merges into the apex, so it fades as it arrives.
    const merging = i === 5;
    const bright = merging ? 1 - open : 1;
    if (bright <= 0.03) continue;

    if (open < 0.06) {
      // Still reading as a logic sign. The dots are drawn large enough to be
      // seen as ∴ and ∵ rather than as specks — that reading is the point.
      pushCircle(points, x, y, z, 17, bright, 40);
    } else {
      pushCircle(points, x, y, z, CIRCLE_RADIUS * open, bright, 190);
    }
  }

  return points;
}

/** The finished mark, held — the club's identity at rest. */
function sceneMark(): Point3[] {
  const points: Point3[] = [];
  const layout: readonly (readonly [number, number, number])[] = [
    [0, 0, 0],
    [CORNER, CORNER, 44],
    [-CORNER, -CORNER, -44],
    [-CORNER, CORNER, 44],
    [CORNER, -CORNER, -44],
  ];
  for (const [x, y, z] of layout) {
    pushCircle(points, x, y, z, CIRCLE_RADIUS, 1, 210);
  }
  return points;
}

/** A ring with markers stepping round it: the weekly cadence. */
function sceneOrbit(t: number): Point3[] {
  const points: Point3[] = [];
  const RADIUS = 112;

  for (let i = 0; i < 160; i += 1) {
    const a = (i / 160) * TAU;
    points.push({
      x: Math.cos(a) * RADIUS,
      y: Math.sin(a) * RADIUS * 0.4,
      z: Math.sin(a) * RADIUS * 0.72,
      bright: 0.26,
    });
  }

  // Five markers walking the ring, the leading one brightest.
  const step = (t / 1500) % 5;
  for (let i = 0; i < 5; i += 1) {
    const a = ((i + step) / 5) * TAU;
    pushCircle(
      points,
      Math.cos(a) * RADIUS,
      Math.sin(a) * RADIUS * 0.4,
      Math.sin(a) * RADIUS * 0.72,
      13 + i * 2.5,
      0.4 + i * 0.15,
      28,
    );
  }

  return points;
}

/** Nodes finding each other and connecting: joining. */
function sceneNetwork(t: number): Point3[] {
  const points: Point3[] = [];
  const NODES = 9;
  const node: [number, number, number][] = [];

  for (let i = 0; i < NODES; i += 1) {
    const a = (i / NODES) * TAU;
    const wobble = Math.sin(t / 2300 + i * 1.7) * 13;
    node.push([
      Math.cos(a) * (98 + wobble),
      Math.sin(a) * (98 + wobble),
      Math.cos(a * 2.3 + t / 3200) * 46,
    ]);
  }

  // Edges draw in progressively, then retract and redraw — a triangle wave
  // rather than a sawtooth, so the full set never disappears in one frame.
  const progress = triangleWave(t, 9500);
  const wanted = Math.floor(progress * NODES * 2);
  let drawn = 0;

  for (let i = 0; i < NODES && drawn < wanted; i += 1) {
    for (const j of [(i + 1) % NODES, (i + 3) % NODES]) {
      if (drawn >= wanted) break;
      drawn += 1;
      const [ax, ay, az] = node[i];
      const [bx, by, bz] = node[j];
      for (let s = 1; s < 15; s += 1) {
        const k = s / 15;
        points.push({
          x: ax + (bx - ax) * k,
          y: ay + (by - ay) * k,
          z: az + (bz - az) * k,
          bright: 0.3,
        });
      }
    }
  }

  for (const [x, y, z] of node) {
    pushCircle(points, x, y, z, 9, 1, 18);
  }

  return points;
}

export interface AsciiFieldProps {
  readonly className?: string;
  readonly scene?: AsciiScene;
}

export function AsciiField({ className, scene = "collapse" }: AsciiFieldProps) {
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

    const config = SCENES[scene];
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

    const CELL_BACK = 17;
    const CELL_MID = 13;
    const CELL_FRONT = 8;

    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;
    let startedAt = 0;
    let lastFrameAt = 0;

    /* --- rotation: idles on its own, follows the pointer, keeps momentum --- */
    const AUTO_YAW = 0.0026;
    let yaw = 0.6;
    let pitch = -0.18;
    let yawVelocity = AUTO_YAW;
    let pitchVelocity = 0;
    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let activePointer: number | null = null;

    let depthBuffer = new Float32Array(0);
    let glyphBuffer = new Uint8Array(0);
    let columnsFront = 0;
    let rowsFront = 0;

    function measure() {
      const rect = container!.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

      const plates: readonly [
        HTMLCanvasElement,
        CanvasRenderingContext2D,
        number,
      ][] = [
        [back!, backContext!, CELL_BACK],
        [mid!, midContext!, CELL_MID],
        [front!, frontContext!, CELL_FRONT],
      ];

      for (const [canvas, context, cell] of plates) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `${Math.round(cell * 1.05)}px ${font}`;
      }

      columnsFront = Math.max(1, Math.ceil(width / CELL_FRONT));
      rowsFront = Math.max(1, Math.ceil(height / CELL_FRONT));
      const cells = columnsFront * rowsFront;
      depthBuffer = new Float32Array(cells);
      glyphBuffer = new Uint8Array(cells);
    }

    function colorAt(mix: number, alpha: number) {
      const r = Math.round(dim[0] + (bright[0] - dim[0]) * mix);
      const g = Math.round(dim[1] + (bright[1] - dim[1]) * mix);
      const b = Math.round(dim[2] + (bright[2] - dim[2]) * mix);
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    }

    /* ---------------------------- ambient plates -------------------------- */

    function drawWave(
      context: CanvasRenderingContext2D,
      t: number,
      cell: number,
      shift: number,
      alpha: number,
    ) {
      context.clearRect(0, 0, width, height);
      const columns = Math.ceil(width / cell);
      const centreY = height / 2;
      const amplitude = Math.min(height * 0.3, 150);
      const sweep = ((t / 5200 + shift) % 1.35) * columns;

      for (let i = 0; i < columns; i += 1) {
        if (i > sweep) break;
        const p = (i / columns) * TAU * 2;
        const y =
          centreY +
          Math.sin(p + t / 1400 + shift * 6) * amplitude * 0.6 +
          Math.cos(p * 2.3 - t / 2100) * amplitude * 0.25;
        const age = Math.min(1, (sweep - i) / 8);
        const level = Math.min(
          WAVE_RAMP.length - 1,
          Math.floor(age * WAVE_RAMP.length),
        );
        context.fillStyle = colorAt(0.15, alpha * (0.2 + age * 0.4));
        context.fillText(WAVE_RAMP[level], i * cell + cell / 2, y);
      }
    }

    function drawCubic(t: number) {
      midContext!.clearRect(0, 0, width, height);
      const columns = Math.ceil(width / CELL_MID);
      const centreY = height / 2;
      const amplitude = Math.min(height * 0.34, 170);

      const r1 = Math.sin(t / 3300) * 0.72;
      const r2 = Math.sin(t / 4700 + 1.1) * 0.72;
      const r3 = Math.sin(t / 6100 + 2.3) * 0.72;
      const sweep = (1 - ((t / 6400) % 1.3)) * columns;

      for (let i = 0; i < columns; i += 1) {
        if (i < sweep) continue;
        const u = (i / columns) * 2 - 1;
        const y = centreY - (u - r1) * (u - r2) * (u - r3) * amplitude * 1.9;
        if (y < -CELL_MID || y > height + CELL_MID) continue;
        const age = Math.min(1, (i - sweep) / 10);
        const level = Math.min(
          CUBIC_RAMP.length - 1,
          Math.floor(age * CUBIC_RAMP.length),
        );
        midContext!.fillStyle = colorAt(0.55, 0.36 * (0.3 + age * 0.7));
        midContext!.fillText(CUBIC_RAMP[level], i * CELL_MID + CELL_MID / 2, y);
      }
    }

    function drawGrid(t: number) {
      backContext!.clearRect(0, 0, width, height);
      const columns = Math.ceil(width / CELL_BACK);
      const rows = Math.ceil(height / CELL_BACK);
      backContext!.fillStyle = colorAt(0.08, 0.2);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < columns; c += 1) {
          // A slow diagonal breath, so it is not a static dot field.
          if (Math.sin((c + r) * 0.55 + t / 2600) < 0.72) continue;
          backContext!.fillText(
            "·",
            c * CELL_BACK + CELL_BACK / 2,
            r * CELL_BACK + CELL_BACK / 2,
          );
        }
      }
    }

    /* ------------------------------ front plate --------------------------- */

    function drawFront(t: number) {
      frontContext!.clearRect(0, 0, width, height);
      depthBuffer.fill(0);
      glyphBuffer.fill(0);

      const points =
        scene === "collapse"
          ? sceneCollapse(t)
          : scene === "mark"
            ? sceneMark()
            : scene === "orbit"
              ? sceneOrbit(t)
              : sceneNetwork(t);

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      // The shapes were too small to read. 0.86 fills the field without
      // clipping at the pitch extremes.
      const markScale = (Math.min(width, height) * 0.86) / 300;
      const centreX = width / 2;
      const centreY = height / 2;
      const viewer = 620;

      for (const point of points) {
        // Yaw about Y, then pitch about X. Both use the same handedness
        // convention (increasing angle turns the near/front-facing side of
        // the object toward positive x, or toward positive y for pitch) so a
        // drag in a given direction always turns the surface the same way it
        // moves — dragging right and dragging down both feel like pushing
        // the front of the object in that direction, rather than one axis
        // reacting backwards from the other.
        const x1 = point.x * cosYaw - point.z * sinYaw;
        const z1 = point.x * sinYaw + point.z * cosYaw;
        const y2 = point.y * cosPitch - z1 * sinPitch;
        const z2 = point.y * sinPitch + z1 * cosPitch;

        const depth = viewer + z2;
        if (depth <= 1) continue;
        const perspective = viewer / depth;

        const sx = centreX + x1 * markScale * perspective;
        const sy = centreY + y2 * markScale * perspective;
        const column = Math.floor(sx / CELL_FRONT);
        const row = Math.floor(sy / CELL_FRONT);
        if (column < 0 || column >= columnsFront) continue;
        if (row < 0 || row >= rowsFront) continue;

        const index = row * columnsFront + column;
        if (perspective <= depthBuffer[index]) continue;

        const nearness =
          Math.min(1, Math.max(0, (perspective - 0.82) / 0.4)) * point.bright;
        depthBuffer[index] = perspective;
        glyphBuffer[index] =
          Math.min(
            POINT_RAMP.length - 1,
            Math.max(0, Math.round(nearness * (POINT_RAMP.length - 1))),
          ) + 1;
      }

      // Group by brightness so fillStyle changes a handful of times, not once
      // per cell.
      for (let level = 0; level < POINT_RAMP.length; level += 1) {
        let started = false;
        const mix = level / (POINT_RAMP.length - 1);
        for (let index = 0; index < glyphBuffer.length; index += 1) {
          if (glyphBuffer[index] !== level + 1) continue;
          if (!started) {
            frontContext!.fillStyle = colorAt(
              0.45 + mix * 0.55,
              0.3 + mix * 0.7,
            );
            started = true;
          }
          const column = index % columnsFront;
          const row = (index - column) / columnsFront;
          frontContext!.fillText(
            POINT_RAMP[level],
            column * CELL_FRONT + CELL_FRONT / 2,
            row * CELL_FRONT + CELL_FRONT / 2,
          );
        }
      }
    }

    function advanceRotation() {
      if (dragging) return;
      // Momentum bleeds back into the resting spin rather than stopping dead.
      yawVelocity += (AUTO_YAW - yawVelocity) * 0.035;
      pitchVelocity *= 0.9;
      yaw += yawVelocity;
      pitch = Math.max(-1.1, Math.min(1.1, (pitch + pitchVelocity) * 0.995));
    }

    function draw(t: number) {
      if (config.back === "wave") drawWave(backContext!, t, CELL_BACK, 0, 0.4);
      else if (config.back === "grid") drawGrid(t);
      else backContext!.clearRect(0, 0, width, height);

      if (config.mid === "cubic") drawCubic(t);
      else if (config.mid === "wave2")
        drawWave(midContext!, t, CELL_MID, 0.45, 0.5);
      else midContext!.clearRect(0, 0, width, height);

      drawFront(t);
    }

    function tick(now: number) {
      if (!startedAt) startedAt = now;
      if (now - lastFrameAt >= FRAME_MS) {
        lastFrameAt = now;
        advanceRotation();
        draw(now - startedAt);
      }
      frame = window.requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      measure();
      container!.dataset.asciiStatus = "live";

      if (isReduced()) {
        // A single frame from the held part of the cycle.
        draw(9000);
        return;
      }
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

    /* ------------------------------ drag to spin -------------------------- */

    function handlePointerDown(event: PointerEvent) {
      // Touch is left alone so the page still scrolls under the banner.
      if (event.pointerType === "touch" || isReduced()) return;
      dragging = true;
      activePointer = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      container!.setPointerCapture(event.pointerId);
      container!.dataset.grabbing = "true";
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragging || event.pointerId !== activePointer) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      yaw += dx * 0.008;
      pitch = Math.max(-1.1, Math.min(1.1, pitch + dy * 0.006));

      // Remember the last movement so releasing carries momentum.
      yawVelocity = dx * 0.008;
      pitchVelocity = dy * 0.006;
    }

    function endDrag(event: PointerEvent) {
      if (event.pointerId !== activePointer) return;
      dragging = false;
      activePointer = null;
      if (container!.hasPointerCapture(event.pointerId)) {
        container!.releasePointerCapture(event.pointerId);
      }
      delete container!.dataset.grabbing;
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
        if (!running) draw(9000);
      });
      resize.observe(container);
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") stop();
      else if (!isReduced()) start();
    }

    function handleMotionPreferenceChange() {
      stop();
      dim = parseColor(styles.getPropertyValue("--ascii-dim")) ?? dim;
      bright = parseColor(styles.getPropertyValue("--ascii-bright")) ?? bright;
      start();
    }

    motionQuery?.addEventListener("change", handleMotionPreferenceChange);
    document.addEventListener("visibilitychange", handleVisibility);
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);

    return () => {
      stop();
      visibility?.disconnect();
      resize?.disconnect();
      motionQuery?.removeEventListener("change", handleMotionPreferenceChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
    };
  }, [scene]);

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
