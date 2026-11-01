const STEP_MS = 8000;
const HOLD_MS = 1800;
const curves = [
  (x: number) => 0.22 * x ** 3 - 0.45 * x,
  (x: number) => 0.65 * Math.sin(Math.PI * x * 0.9),
  (x: number) => 0.9 * Math.exp(-2 * x * x) - 0.35,
  (x: number) => 0.55 * x * x - 0.55,
];

export const GRAPH_CYCLE_MS = STEP_MS * curves.length;

/** One complete curve, continuously blended into the next without a reset. */
export function morphGraphAt(x: number, elapsedMs: number): number {
  const time = Math.max(0, elapsedMs) % GRAPH_CYCLE_MS;
  const index = Math.floor(time / STEP_MS);
  const progress =
    Math.max(0, (time % STEP_MS) - HOLD_MS) / (STEP_MS - HOLD_MS);
  // Zero velocity and acceleration at both ends keep the holds and wrap smooth.
  const blend = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  const from = curves[index](x);
  const to = curves[(index + 1) % curves.length](x);
  return from + (to - from) * blend;
}
