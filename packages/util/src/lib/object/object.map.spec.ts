import { mapObjectKeysToLowercase, mapObjectMap } from './object.map';

describe('mapObjectMap()', () => {
  it('should map values using the map function.', () => {
    const object = {
      0: 0,
      a: 1,
      x: 1
    };

    const result = mapObjectMap(object, (x) => String(x));

    expect(result[0]).toBe(String(object[0]));
    expect(result.a).toBe(String(object.a));
    expect(result.x).toBe(String(object.x));
  });
});

describe('mapObjectMap()', () => {
  it('should map values using the map function.', () => {
    const object = {
      0: 0,
      a: 1,
      x: 1
    };

    const result = mapObjectMap(object, (x) => String(x));

    expect(result[0]).toBe(String(object[0]));
    expect(result.a).toBe(String(object.a));
    expect(result.x).toBe(String(object.x));
  });
});

describe('mapObjectKeysToLowercase()', () => {
  it('should map all string keys of the input object to lowercase', () => {
    const object = {
      0: 0,
      a: 0,
      B: 0,
      CCC: 0
    };

    const result = mapObjectKeysToLowercase(object);

    expect(result.a).toBe(object.a);
    expect(result.b).toBe(object.B);
    expect(result.ccc).toBe(object.CCC);
  });

  it('should map all string keys of the input object to lowercase with override order being undefined', () => {
    const object = {
      0: 0,
      a: 0,
      b: 0,
      B: 0,
      CCC: 0
    };

    const result = mapObjectKeysToLowercase(object);

    expect(result.a).toBe(object.a);
    expect(result.b).toBeDefined();
  });
});
