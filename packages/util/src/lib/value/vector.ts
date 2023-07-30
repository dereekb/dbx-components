import { Maybe } from './maybe.type';

export interface Vector {
  x: number;
  y: number;
}

export type VectorTuple = [number, number];

export function isSameVector(a: Maybe<Partial<Vector>>, b: Maybe<Partial<Vector>>): boolean {
  return a && b ? vectorsAreEqual(a, b) : a === b;
}

export function vectorsAreEqual(a: Partial<Vector>, b: Partial<Vector>): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Function that resizes a vector.
 */
export type VectorResizeFunction = (input: Vector) => Vector;

/**
 * Creates a VectorResizeFunction that returns the larger x/y values from the input and the minimum vector.
 *
 * @param min
 * @returns
 */
export function vectorMinimumSizeResizeFunction(minSize: Partial<Vector>): VectorResizeFunction {
  return (input: Vector) => {
    return {
      x: minSize.x != null ? Math.max(input.x, minSize.x) : input.x,
      y: minSize.y != null ? Math.max(input.y, minSize.y) : input.y
    };
  };
}

export type RectangleOrigin = Vector;
export type TopRightCorner = Vector;
export type BottomLeftCorner = Vector;

export interface Rectangle {
  /**
   * Upper-Right/North-East corner.
   */
  tr: TopRightCorner;
  /**
   * Bottom-Left/South-West corner.
   */
  bl: BottomLeftCorner;
}

/**
 * Returns true if the input vector overlaps another.
 *
 * @param a
 * @param b
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
