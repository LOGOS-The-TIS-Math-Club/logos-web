import { describe, expect, it } from "vitest";

import { triangleWave } from "./scene-timing";

describe("triangleWave", () => {
  it("climbs from 0 to 1 over the climb duration", () => {
    expect(triangleWave(0, 1000)).toBeCloseTo(0, 5);
    expect(triangleWave(500, 1000)).toBeCloseTo(0.5, 5);
    expect(triangleWave(1000, 1000)).toBeCloseTo(1, 5);
  });

  it("eases back down to 0 over the second half of the round trip", () => {
    expect(triangleWave(1500, 1000)).toBeCloseTo(0.5, 5);
    expect(triangleWave(2000, 1000)).toBeCloseTo(0, 5);
  });

  it("never jumps across a loop boundary", () => {
    // The property the sawtooth violated: samples either side of a boundary
    // must be close together, not one near 1 and the next near 0.
    for (const boundary of [2000, 4000, 10000]) {
      const before = triangleWave(boundary - 0.01, 1000);
      const after = triangleWave(boundary + 0.01, 1000);
      expect(Math.abs(after - before)).toBeLessThan(0.001);
    }
  });

  it("stays within [0, 1] for a wide spread of inputs", () => {
    for (let t = 0; t < 20000; t += 137) {
      const value = triangleWave(t, 1000);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
