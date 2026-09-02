/*
 * Pure timing helpers for the ASCII scenes.
 *
 * A scene that loops via `(t % cycle) / cycle` produces a sawtooth: the value
 * climbs from 0 to 1 and then snaps back to 0 in a single frame. Where that
 * value drives visible geometry — the mark's open/closed radius, how many
 * network edges are drawn — the snap reads as the whole animation resetting.
 *
 * `triangleWave` replaces the sawtooth with a value that climbs to 1 and eases
 * back down to 0 continuously, so a looping scene breathes instead of cutting.
 * Kept free of canvas and React so the continuity property itself is testable.
 */

/**
 * Continuous 0 → 1 → 0 wave. `climbMs` is how long the climb from 0 to 1
 * takes — the full round trip (climb, then ease back down) is `climbMs * 2`.
 *
 * Unlike a plain modulo sawtooth, this never jumps: the value approaching a
 * loop boundary from below and the value just after are within a rounding
 * error of each other.
 */
export function triangleWave(t: number, climbMs: number): number {
  const period = climbMs * 2;
  const position = (t % period) / period;
  return position < 0.5 ? position * 2 : (1 - position) * 2;
}
