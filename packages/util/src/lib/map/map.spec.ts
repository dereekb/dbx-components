import { combineMaps, setKeysOnMap, mapToTuples, expandArrayMapTuples, expandArrayValueTuples } from './map';

describe('combineMaps', () => {
  it('should combine multiple maps', () => {
    const a = new Map([['x', 1]]);
    const b = new Map([['y', 2]]);
    const result = combineMaps(a, b);

    expect(result.get('x')).toBe(1);
    expect(result.get('y')).toBe(2);
  });

  it('should override earlier values with later ones for the same key', () => {
    const a = new Map([['x', 1]]);
    const b = new Map([['x', 2]]);
    const result = combineMaps(a, b);

    expect(result.get('x')).toBe(2);
  });

  it('should skip null/undefined maps', () => {
    const a = new Map([['x', 1]]);
    const result = combineMaps(a, null, undefined);

    expect(result.size).toBe(1);
    expect(result.get('x')).toBe(1);
  });
});

describe('setKeysOnMap', () => {
  it('should set a value for a single key', () => {
    const map = new Map<string, number>();
    setKeysOnMap(map, 'a', 1);

    expect(map.get('a')).toBe(1);
  });

  it('should set the same value for multiple keys', () => {
    const map = new Map<string, number>();
    setKeysOnMap(map, ['a', 'b', 'c'], 5);

    expect(map.get('a')).toBe(5);
    expect(map.get('b')).toBe(5);
    expect(map.get('c')).toBe(5);
  });
});

describe('mapToTuples', () => {
  it('should convert a map to tuples', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2]
    ]);
    const result = mapToTuples(map);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      ['a', 1],
      ['b', 2]
    ]);
  });
});

describe('expandArrayMapTuples', () => {
  it('should expand array values into individual tuples', () => {
    const map = new Map([['a', [1, 2, 3]]]);
    const result = expandArrayMapTuples(map);

    expect(result).toEqual([
      ['a', 1],
      ['a', 2],
      ['a', 3]
    ]);
  });
});

describe('expandArrayValueTuples', () => {
  it('should expand array values into individual tuples', () => {
    const tuples: [string, number[]][] = [
      ['a', [1, 2]],
      ['b', [3]]
    ];
    const result = expandArrayValueTuples(tuples);

    expect(result).toEqual([
      ['a', 1],
      ['a', 2],
      ['b', 3]
    ]);
  });
});
