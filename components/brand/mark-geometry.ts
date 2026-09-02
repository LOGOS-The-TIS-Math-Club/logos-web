/*
 * LOGOS mark geometry, shared by the SVG components and the ASCII animation.
 *
 * The mark is the therefore sign and the because sign collapsed together:
 *
 *     ∴  one dot above two          ∵  two dots above one
 *
 * Laid over each other their six dots resolve into five circles, because the
 * ∴ apex and the ∵ base meet in the middle. Coordinates are in the 300-unit box
 * of logos-brandmark/logomark.svg, re-centred on zero.
 *
 * Kept free of React and canvas so it can be unit tested directly.
 */

/** Circle radius and diagonal offset, from the official file. */
export const CIRCLE_RADIUS = 96;
export const CORNER = 48;

export type Vec2 = readonly [number, number];

/** The five circle centres of the finished mark. */
export const LOGOMARK_CIRCLES: readonly Vec2[] = [
  [0, 0],
  [CORNER, CORNER],
  [-CORNER, -CORNER],
  [-CORNER, CORNER],
  [CORNER, -CORNER],
];

/**
 * Where the six dots begin: two separated logic signs.
 * Order is ∴ apex, ∴ lower left, ∴ lower right, ∵ upper left, ∵ upper right,
 * ∵ base — and SIGN_TARGETS uses the same order.
 */
export const SIGN_SOURCES: readonly Vec2[] = [
  [0, -112],
  [-97, 56],
  [97, 56],
  [-97, -56],
  [97, -56],
  [0, 112],
];

/** Where each dot lands. The apex and the base both arrive at the centre. */
export const SIGN_TARGETS: readonly Vec2[] = [
  [0, 0],
  [-CORNER, CORNER],
  [CORNER, CORNER],
  [-CORNER, -CORNER],
  [CORNER, -CORNER],
  [0, 0],
];
