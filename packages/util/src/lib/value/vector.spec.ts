import { type Rectangle, rectangleOverlapsRectangle, vectorMinimumSizeResizeFunction } from './vector';

describe('vectorMinimumSizeResizeFunction()', () => {
  it('should enforce minimum x dimension while preserving y', () => {
    const resize = vectorMinimumSizeResizeFunction({ x: 5 });
    const result = resize({ x: 3, y: 10 });

    expect(result).toEqual({ x: 5, y: 10 });
  });

  it('should pass through values already above the minimum', () => {
    const resize = vectorMinimumSizeResizeFunction({ x: 5, y: 5 });
    const result = resize({ x: 10, y: 10 });

    expect(result).toEqual({ x: 10, y: 10 });
  });
});

describe('rectangleOverlapsRectangle()', () => {
  it('it should return true if a rectangle is the same.', () => {
    const rect: Rectangle = {
      tr: {
        x: 10,
        y: 10
      },
      bl: {
        x: 0,
        y: 0
      }
    };

    const result = rectangleOverlapsRectangle(rect, rect);
    expect(result).toBe(true);
  });

  it('it should return true if a rectangle entirely overlaps another rectangle.', () => {
    const bigger: Rectangle = {
      tr: {
        x: 10,
        y: 10
      },
      bl: {
        x: 0,
        y: 0
      }
    };

    const smaller: Rectangle = {
      tr: {
        x: 5,
        y: 5
      },
      bl: {
        x: 0,
        y: 0
      }
    };

    const result = rectangleOverlapsRectangle(bigger, smaller);
    expect(result).toBe(true);
  });

  it('it should return true if the top-right corners overlap', () => {
    const left: Rectangle = {
      tr: {
        x: 10,
        y: 10
      },
      bl: {
        x: 4,
        y: 4
      }
    };

    const right: Rectangle = {
      tr: {
        x: 5,
        y: 5
      },
      bl: {
        x: 0,
        y: 0
      }
    };

    const result = rectangleOverlapsRectangle(left, right);
    expect(result).toBe(true);
  });

  it('it should return true if the bottom-right corners overlap', () => {
    const left: Rectangle = {
      tr: {
        x: 3,
        y: 3
      },
      bl: {
        x: 0,
        y: 0
      }
    };

    const right: Rectangle = {
      tr: {
        x: 6,
        y: 6
      },
      bl: {
        x: 2,
        y: 2
      }
    };

    const result = rectangleOverlapsRectangle(left, right);
    expect(result).toBe(true);
  });

  it('it should return false if the bottom-right corners do not overlap', () => {
    const left: Rectangle = {
      tr: {
        x: 1,
        y: 1
      },
      bl: {
        x: 0,
        y: 0
      }
    };

    const right: Rectangle = {
      tr: {
        x: 6,
        y: 6
      },
      bl: {
        x: 2,
        y: 2
      }
    };

    const result = rectangleOverlapsRectangle(left, right);
    expect(result).toBe(false);
  });
});
