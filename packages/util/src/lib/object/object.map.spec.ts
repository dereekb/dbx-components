import { mapObjectMap } from './object.map';

describe('mapObjectMap()', () => {

  it('should map values using the map function.', () => {
    const object = {
      0: 0,
      'a': 1,
      x: 1
    };

    const result = mapObjectMap(object, (x) => String(x));

    expect(result[0]).toBe(String(object[0]));
    expect(result.a).toBe(String(object.a));
    expect(result.x).toBe(String(object.x));
  });

});
