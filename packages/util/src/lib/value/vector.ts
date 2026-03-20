import { type Maybe } from './maybe.type';

/**
 * A 2D point or size with x and y components.
 */
export interface Vector {
  x: number;
  y: number;
}

/**
 * A {@link Vector} represented as a `[x, y]` tuple.
 */
export type VectorTuple = [number, number];

/**
 * Safely compares two optional vectors for equality.
 *
 * If both values are non-nullish, delegates to {@link vectorsAreEqual}.
 * If both are nullish, uses strict equality (`===`).
 *
 * @param a - first vector
 * @param b - second vector
 * @returns `true` if both vectors are equal or both are nullish
 */
export function isSameVector(a: Maybe<Partial<Vector>>, b: Maybe<Partial<Vector>>): boolean {
  return a && b ? vectorsAreEqual(a, b) : a === b;
}

/**
 * Returns `true` if both vectors have the same `x` and `y` values using strict equality.
 *
 * @param a - first vector
 * @param b - second vector
 * @returns `true` if both vectors have identical `x` and `y` values
 */
export function vectorsAreEqual(a: Partial<Vector>, b: Partial<Vector>): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Function that transforms a {@link Vector} into a new vector, typically used for resizing or clamping dimensions.
 */
export type VectorResizeFunction = (input: Vector) => Vector;

/**
 * Creates a {@link VectorResizeFunction} that enforces minimum x/y dimensions.
 *
 * For each axis, if a minimum is specified, the result uses whichever value is larger (input or minimum).
 * If a minimum is not specified for an axis, the input value is passed through unchanged.
 *
 * @param minSize - the minimum dimensions to enforce
 * @returns a resize function that clamps each axis to the specified minimum
 *
 * @example
 * ```ts
 * const resize = vectorMinimumSizeResizeFunction({ x: 5 });
 * resize({ x: 3, y: 10 });
 * // { x: 5, y: 10 }
 * ```
 */
export function vectorMinimumSizeResizeFunction(minSize: Partial<Vector>): VectorResizeFunction {
  return (input: Vector) => {
    return {
      x: minSize.x != null ? Math.max(input.x, minSize.x) : input.x,
      y: minSize.y != null ? Math.max(input.y, minSize.y) : input.y
    };
  };
}

/**
 * The origin point of a {@link Rectangle}, typically the bottom-left corner.
 */
export type RectangleOrigin = Vector;

/**
 * The top-right (north-east) corner of a {@link Rectangle}.
 */
export type TopRightCorner = Vector;

/**
 * The bottom-left (south-west) corner of a {@link Rectangle}.
 */
export type BottomLeftCorner = Vector;

/**
 * An axis-aligned rectangle defined by its top-right and bottom-left corners.
 */
export interface Rectangle {
  /**
   * Upper-right / north-east corner.
   */
  tr: TopRightCorner;
  /**
   * Bottom-left / south-west corner.
   */
  bl: BottomLeftCorner;
}

/**
 * Returns `true` if the two rectangles overlap (share any interior area).
 *
 * Degenerate rectangles (where corners coincide on an axis) are considered non-overlapping.
 *
 * @param a - first rectangle
 * @param b - second rectangle
 * @returns `true` if the rectangles share any interior area
 *
 * @example
 * ```ts
 * const a: Rectangle = { tr: { x: 10, y: 10 }, bl: { x: 0, y: 0 } };
 * const b: Rectangle = { tr: { x: 5, y: 5 }, bl: { x: 0, y: 0 } };
 *
 * rectangleOverlapsRectangle(a, b);
 * // true
 * ```
 */
export function rectangleOverlapsRectangle(a: Rectangle, b: Rectangle): boolean {
  const { tr: r1, bl: l1 } = a;
  const { tr: r2, bl: l2 } = b;

  let doesNotOverlap = true;

  // corners only touch
  if (l1.x == r1.x || l1.y == r1.y || r2.x == l2.x || l2.y == r2.y) {
    doesNotOverlap = false;
  } else if (l1.x > r2.x || l2.x > r1.x) {
    doesNotOverlap = false;
  } else if (r1.y < l2.y || r2.y < l1.y) {
    doesNotOverlap = false;
  }

  return doesNotOverlap;
}

/**
 * Computes the intersection rectangle of two axis-aligned rectangles.
 *
 * Returns the overlapping {@link Rectangle} if the two inputs intersect,
 * or `undefined` if they do not overlap.
 *
 * @param a - first rectangle
 * @param b - second rectangle
 * @returns the overlapping {@link Rectangle}, or `undefined` if the rectangles do not intersect
 */
export function getOverlappingRectangle(a: Rectangle, b: Rectangle): Maybe<Rectangle> {
  const xl = Math.max(a.bl.x, b.bl.x);
  const yl = Math.max(a.bl.y, b.bl.y);
  const xr = Math.min(a.tr.x, b.tr.x);
  const yr = Math.min(a.tr.y, b.tr.y);

  // does not intersect
  if (xl > xr || yl > yr) {
    return undefined;
  }

  const topRight: TopRightCorner = {
    x: xr,
    y: yr
  };

  const bottomLeft: BottomLeftCorner = {
    x: xl,
    y: yl
  };

  return { tr: topRight, bl: bottomLeft };
}
