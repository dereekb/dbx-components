import { isLatLngPoint, latLngPoint, latLngPointFunction, latLngString, LonLatTuple, lonLatTuple } from './point';

describe('isLatLngPoint()', () => {
  it('should return true for points.', () => {
    expect(isLatLngPoint({ lat: 0, lng: 0 })).toBe(true);
  });

  it('should return false for bound.', () => {
    expect(isLatLngPoint({ sw: { lat: 0, lng: 0 }, ne: { lat: 0, lng: 0 } })).toBe(false);
  });
});

describe('lonLngTuple()', () => {
  it('should parse the lonLatTuple to a LonLatTuple.', () => {
    const input: LonLatTuple = [-120, 80];
    const result: LonLatTuple = lonLatTuple(input);

    expect(result[0]).toBe(input[0]);
    expect(result[1]).toBe(input[1]);
  });
});

describe('latLngPointFunction()', () => {
  const precision = 3;

  describe('function', () => {
    const fn = latLngPointFunction({ precision });

    const latLng = latLngPoint(30.59929, -96.38315);
    const latLngStr = latLngString(30.59929, -96.38315);

    it('should round the latLngPoint to the given precision.', () => {
      const result = fn(latLng);

      expect(result.lat).toBe(30.599);
      expect(result.lng).toBe(-96.383);
    });

    it('should round the latLngString to the given precision.', () => {
      const result = fn(latLngStr);

      expect(result.lat).toBe(30.599);
      expect(result.lng).toBe(-96.383);
    });

    it('should round the lonLat object to the given precision.', () => {
      const result = fn({ lon: latLng.lng, lat: latLng.lat });

      expect(result.lat).toBe(30.599);
      expect(result.lng).toBe(-96.383);
    });
  });
});
