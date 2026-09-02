import { describe, expect, it } from "vitest";

import { LOGOMARK_CIRCLES, SIGN_SOURCES, SIGN_TARGETS } from "./mark-geometry";

/*
 * The LOGOS mark is ∴ and ∵ collapsed together. These tests pin that reading,
 * so a future edit to the animation cannot quietly drift away from the actual
 * brandmark geometry in logos-brandmark/logomark.svg.
 */

describe("logomark geometry", () => {
  it("matches the official file: five circles in a quincunx", () => {
    expect(LOGOMARK_CIRCLES).toHaveLength(5);
    expect([...LOGOMARK_CIRCLES].sort()).toEqual(
      [
        [0, 0],
        [-48, -48],
        [-48, 48],
        [48, -48],
        [48, 48],
      ].sort(),
    );
  });
});

describe("therefore and because collapsing", () => {
  it("starts from six dots — three per sign", () => {
    expect(SIGN_SOURCES).toHaveLength(6);
    expect(SIGN_TARGETS).toHaveLength(6);
  });

  it("reads as ∴ (one dot above two) then ∵ (two above one)", () => {
    const [apex, lowerLeft, lowerRight, upperLeft, upperRight, base] =
      SIGN_SOURCES;

    // ∴ — apex sits above its pair.
    expect(apex[1]).toBeLessThan(lowerLeft[1]);
    expect(lowerLeft[1]).toBe(lowerRight[1]);
    expect(lowerLeft[0]).toBeLessThan(lowerRight[0]);

    // ∵ — the pair sits above the base.
    expect(upperLeft[1]).toBe(upperRight[1]);
    expect(upperLeft[0]).toBeLessThan(upperRight[0]);
    expect(base[1]).toBeGreaterThan(upperLeft[1]);
  });

  it("collapses the two apex dots onto the centre", () => {
    // Index 0 is the ∴ apex, index 5 the ∵ base. Both land on the middle
    // circle, which is why six dots resolve into five.
    expect(SIGN_TARGETS[0]).toEqual([0, 0]);
    expect(SIGN_TARGETS[5]).toEqual([0, 0]);
  });

  it("lands every dot on a real circle of the mark", () => {
    for (const target of SIGN_TARGETS) {
      expect(
        LOGOMARK_CIRCLES.some(([x, y]) => x === target[0] && y === target[1]),
        `${target} should be a circle centre`,
      ).toBe(true);
    }
  });

  it("covers all five circles between them", () => {
    const reached = new Set(SIGN_TARGETS.map((t) => `${t[0]},${t[1]}`));
    expect(reached.size).toBe(5);
  });
});
