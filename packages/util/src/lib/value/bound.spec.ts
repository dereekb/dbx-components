import { latLngPoint } from './point';
import { latLngBound, latLngBoundFunction } from './bound';

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
