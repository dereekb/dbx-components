import { describe, expect, it } from 'vitest';
import { type MapboxCanvasContainerLike, mapboxClientPointToMapPoint, mapboxMapPointToClientPoint } from './mapbox.util';

function testContainer(rect: { left: number; top: number; width: number }, offsetWidth: number): MapboxCanvasContainerLike {
  return {
    offsetWidth,
    getBoundingClientRect: () => ({ ...rect, height: 100, right: rect.left + rect.width, bottom: rect.top + 100, x: rect.left, y: rect.top, toJSON: () => undefined }) as DOMRect
  };
}

describe('mapboxClientPointToMapPoint()', () => {
  it('should subtract the container offset', () => {
    const container = testContainer({ left: 100, top: 50, width: 400 }, 400);
    expect(mapboxClientPointToMapPoint({ container, point: { x: 150, y: 80 } })).toEqual({ x: 50, y: 30 });
  });

  it('should apply the scaling of a CSS transformed container', () => {
    // rendered at half size: 400px of layout width shown as 200 client pixels
    const container = testContainer({ left: 0, top: 0, width: 200 }, 400);
    expect(mapboxClientPointToMapPoint({ container, point: { x: 50, y: 20 } })).toEqual({ x: 100, y: 40 });
  });
});

describe('mapboxMapPointToClientPoint()', () => {
  it('should be the inverse of mapboxClientPointToMapPoint()', () => {
    const container = testContainer({ left: 30, top: 60, width: 200 }, 400);
    const client = { x: 75, y: 90 };
    const mapPoint = mapboxClientPointToMapPoint({ container, point: client });
    expect(mapboxMapPointToClientPoint({ container, point: mapPoint })).toEqual(client);
  });
});
