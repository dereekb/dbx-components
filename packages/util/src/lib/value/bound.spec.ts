import { LatLngBound } from '@dereekb/util';
import { latLngPoint } from './point';
import { boundToRectangle, isLatLngBoundWithinLatLngBound, isLatLngPointWithinLatLngBound, latLngBound, latLngBoundCenterPoint, latLngBoundFullyWrapsMap, latLngBoundFunction, latLngBoundStrictlyWrapsMap, overlapsLatLngBoundFunction, TOTAL_SPAN_OF_LONGITUDE } from './bound';

describe('latLngBoundFunction()', () => {
  const precision = 3;

  describe('function', () => {
    const fn = latLngBoundFunction({ precision });
    const sw = latLngPoint(20, 20);
    const ne = latLngPoint(30, 30);

    it('should create the latLngBound from a pair of points.', () => {
      const result = fn([sw, ne]);

      expect(result.sw.lat).toBe(sw.lat);
      expect(result.sw.lng).toBe(sw.lng);
      expect(result.ne.lat).toBe(ne.lat);
      expect(result.ne.lng).toBe(ne.lng);
    });

    it('should create the latLngBound from two points.', () => {
      const result = fn(sw, ne);

      expect(result.sw.lat).toBe(sw.lat);
      expect(result.sw.lng).toBe(sw.lng);
      expect(result.ne.lat).toBe(ne.lat);
      expect(result.ne.lng).toBe(ne.lng);
    });

    it('should create the latLngBound from four points.', () => {
      const result = fn([sw, ne, sw, ne]);

      expect(result.sw.lat).toBe(sw.lat);
      expect(result.sw.lng).toBe(sw.lng);
      expect(result.ne.lat).toBe(ne.lat);
      expect(result.ne.lng).toBe(ne.lng);
    });

    it('should create the latLngBound from a bound.', () => {
      const result = fn({ sw, ne });

      expect(result.sw.lat).toBe(sw.lat);
      expect(result.sw.lng).toBe(sw.lng);
      expect(result.ne.lat).toBe(ne.lat);
      expect(result.ne.lng).toBe(ne.lng);
    });
  });
});

describe('latLngBoundCenterPoint()', () => {
  it('should return the center of the input bounds', () => {
    const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });
    const result = latLngBoundCenterPoint(bound);

    expect(result.lat).toBe(20);
    expect(result.lng).toBe(20);
  });
});

describe('latLngBoundStrictlyWrapsMap()', () => {
  it('should return true if the bound wraps over the longitudinal edge of the map', () => {
    const bound = latLngBound({ lat: 0, lng: 160 }, { lat: 40, lng: -160 });
    expect(latLngBoundStrictlyWrapsMap(bound)).toBe(true);
  });

  it('should return false if the bound does not wrap over the longitudinal edge of the map', () => {
    const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });
    expect(latLngBoundStrictlyWrapsMap(bound)).toBe(false);
  });
});

describe('latLngBoundFullyWrapsMap()', () => {
  it('should return true if the bound fully wraps the map', () => {
    const bound = latLngBound({ lat: 0, lng: -360 }, { lat: 40, lng: 360 });
    expect(latLngBoundFullyWrapsMap(bound)).toBe(true);
  });

  it('should return false if the bound only wraps over the longitudinal edge of the map', () => {
    const bound = latLngBound({ lat: 0, lng: 160 }, { lat: 40, lng: -160 });
    expect(latLngBoundFullyWrapsMap(bound)).toBe(false);
  });
});

describe('isLatLngBoundWithinLatLngBound()', () => {
  describe('normal bound', () => {
    const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });

    it('should return true if the bound is the same.', () => {
      expect(isLatLngBoundWithinLatLngBound(bound, bound)).toBe(true);
    });

    it('should return false if the bound is not fully in the bound.', () => {
      const inputBound = latLngBound({ lat: -20, lng: -20 }, { lat: 40, lng: 40 });
      expect(isLatLngBoundWithinLatLngBound(inputBound, bound)).toBe(false);
    });

    it('should return false if the bound is not in the bound.', () => {
      const inputBound = latLngBound({ lat: -20, lng: -20 }, { lat: -10, lng: -10 });
      expect(isLatLngBoundWithinLatLngBound(inputBound, bound)).toBe(false);
    });
  });
});

describe('isLatLngPointWithinLatLngBound()', () => {
  describe('normal bound', () => {
    const bound = latLngBound({ lat: 0, lng: 0 }, { lat: 40, lng: 40 });

    it('should return true if the point is in the bound.', () => {
      const point = latLngPoint(10, 10);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(true);
    });

    it('should return false if the point is not in the bound.', () => {
      const point = latLngPoint(-10, 10);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(false);
    });
  });

  describe('bound wraps map strictly', () => {
    const bound = latLngBound({ lat: 0, lng: 170 }, { lat: 40, lng: -170 });

    it('should return true if the point is in the bound on the sw side.', () => {
      const point = latLngPoint(10, 175);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(true);
    });

    it('should return true if the point is in the bound on the ne side.', () => {
      const point = latLngPoint(10, -175);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(true);
    });

    it('should return false if the point is not in the bound.', () => {
      const point = latLngPoint(-10, 10);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(false);
    });
  });

  describe('bound wraps map fully', () => {
    const bound = latLngBound({ lat: 0, lng: -360 }, { lat: 40, lng: 360 });

    it('should return true if the point is in the bound in the east.', () => {
      const point = latLngPoint(10, 175);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(true);
    });

    it('should return true if the point is in the bound in the west.', () => {
      const point = latLngPoint(10, -175);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(true);
    });

    it('should return false if the point is not in the bound.', () => {
      const point = latLngPoint(-10, 10);
      expect(isLatLngPointWithinLatLngBound(point, bound)).toBe(false);
    });
  });
});

describe('overlapsLatLngBoundFunction()', () => {
  describe('function', () => {
    const sw = latLngPoint(0, 0);
    const ne = latLngPoint(30, 30);

    const bound: LatLngBound = latLngBound(sw, ne);

    const overlaps = overlapsLatLngBoundFunction(bound);

    it('should return true if the bound are the same', () => {
      expect(overlaps(bound)).toBe(true);
    });

    it('should return true if the input bound are inside the other', () => {
      const sw = latLngPoint(10, 10);
      const ne = latLngPoint(20, 20);

      const otherBound: LatLngBound = latLngBound(sw, ne);
      expect(overlaps(otherBound)).toBe(true);
    });

    it('should return true if the corner bound overlap', () => {
      const sw = latLngPoint(10, 10);
      const ne = latLngPoint(40, 40);

      const otherBound: LatLngBound = latLngBound(sw, ne);
      expect(overlaps(otherBound)).toBe(true);
    });

    it('should return false if the corner bound do not overlap', () => {
      const sw = latLngPoint(50, 50);
      const ne = latLngPoint(60, 60);

      const otherBound: LatLngBound = latLngBound(sw, ne);
      expect(overlaps(otherBound)).toBe(false);
    });

    describe('world wrapping', () => {
      const sw2 = latLngPoint(-30, 150);
      const ne2 = latLngPoint(30, -150);

      const bound2: LatLngBound = latLngBound(sw2, ne2);
      const wrappedOverlaps = overlapsLatLngBoundFunction(bound2);

      it('should return true if the bound are the same', () => {
        expect(wrappedOverlaps(bound2)).toBe(true);
      });

      it('should return true if the corner bound overlap', () => {
        const sw = latLngPoint(10, -170);
        const ne = latLngPoint(40, -150);

        const otherBound: LatLngBound = latLngBound(sw, ne);
        expect(wrappedOverlaps(otherBound)).toBe(true);
      });
    });
  });
});

describe('boundToRectangle()', () => {
  const sw = latLngPoint(0, 0);
  const ne = latLngPoint(30, 30);

  const bound: LatLngBound = latLngBound(sw, ne);

  const distanceFromEdge = 30;
  const farLeft: LatLngBound = latLngBound(latLngPoint(0, -180), latLngPoint(0, -180 + distanceFromEdge));

  it('should converts the bound to a rectangle', () => {
    const rect = boundToRectangle(bound);

    expect(rect.bl.x === sw.lat + 360).toBe(true);
    expect(rect.tr.x === ne.lat + 360).toBe(true);
  });

  it('should converts the bound to a rectangle at the far left of the map', () => {
    const rect = boundToRectangle(farLeft);

    expect(rect.bl.x).toBe(TOTAL_SPAN_OF_LONGITUDE / 2);
    expect(rect.tr.x).toBe(TOTAL_SPAN_OF_LONGITUDE / 2 + distanceFromEdge);
  });

  describe('world wrapping', () => {
    const sw2 = latLngPoint(-30, 150);
    const ne2 = latLngPoint(30, -150);

    const bound2: LatLngBound = latLngBound(sw2, ne2);

    it('should converts the bound to a rectangle with the wrap', () => {
      const rect = boundToRectangle(bound2);

      expect(rect.bl.x).toBeLessThan(rect.tr.x);
      expect(rect.bl.x).toBeLessThan(TOTAL_SPAN_OF_LONGITUDE / 2);
      expect(rect.bl.x).toBe(TOTAL_SPAN_OF_LONGITUDE / 2 - (180 - sw2.lng));
      expect(rect.tr.x).toBeGreaterThan(TOTAL_SPAN_OF_LONGITUDE / 2);
      expect(rect.tr.x).toBe(ne.lng + TOTAL_SPAN_OF_LONGITUDE / 2);
    });
  });
});
