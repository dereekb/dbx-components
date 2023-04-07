import { DEFAULT_LAT_LNG_STRING_VALUE, defaultLatLngPoint, isDefaultLatLngPoint, isLatLngPoint, latLngPoint, latLngPointFunction, latLngString, LonLatTuple, lonLatTuple, TOTAL_LONGITUDE_RANGE, wrapLngValue, LatLngString } from './point';

describe('isLatLngPoint()', () => {
  it('should return true for points.', () => {
    expect(isLatLngPoint({ lat: 0, lng: 0 })).toBe(true);
  });

  it('should return false for bound.', () => {
    expect(isLatLngPoint({ sw: { lat: 0, lng: 0 }, ne: { lat: 0, lng: 0 } })).toBe(false);
  });
});

describe('isDefaultLatLngPoint()', () => {
  it('should return true for the default LatLngPoint', () => {
    const result = isDefaultLatLngPoint(defaultLatLngPoint());
    expect(result).toBe(true);
  });

  it('should return false for a LatLngPoint that is not the default', () => {
    const result = isDefaultLatLngPoint({ lat: 1, lng: 1 });
    expect(result).toBe(false);
  });

  it('should return true for an empty string', () => {
    const result = isDefaultLatLngPoint('');
    expect(result).toBe(true);
  });

  it('should return false for the default LatLngString', () => {
    const result = isDefaultLatLngPoint(DEFAULT_LAT_LNG_STRING_VALUE);
    expect(result).toBe(true);
  });

  it('should return false for a non-empty string that is not the default string', () => {
    const result = isDefaultLatLngPoint('invalidLatLng' as LatLngString);
    expect(result).toBe(false);
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

describe('wrapLngValue()', () => {
  it('should wrap a negative value to the other side of the map.', () => {
    const input = -190;
    expect(wrapLngValue(input)).toBe(170);
  });

  it('should wrap a positive value to the other side of the map.', () => {
    const input = 190;
    expect(wrapLngValue(input)).toBe(-170);
  });

  it('should wrap a very positive value to the other side of the map.', () => {
    const input = 190 + TOTAL_LONGITUDE_RANGE;
    expect(wrapLngValue(input)).toBe(-170);
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
