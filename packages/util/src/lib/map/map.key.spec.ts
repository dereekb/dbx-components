import { type ReadKeyFunction, type ReadMultipleKeysFunction } from '../key';
import { MultiValueMapBuilder, multiValueMapBuilder, readKeysToMap, readMultipleKeysToMap } from './map.key';

describe('readKeysToMap()', () => {
  it('should create a map.', () => {
    const values = [1, 2, 3, 4];
    const readKey: ReadKeyFunction<number, string> = (x) => String(x);

    const result = readKeysToMap(values, readKey);

    expect(result.size).toBe(values.length);
    expect(result.get('1')).toBe(1);
    expect(result.get('2')).toBe(2);
    expect(result.get('3')).toBe(3);
    expect(result.get('4')).toBe(4);
  });
});

describe('readMultipleKeysToMap()', () => {
  it('should create a map.', () => {
    const values = [1, 2, 3, 4];
    const readKey: ReadMultipleKeysFunction<number, string> = (x) => [String(x)];

    const result = readMultipleKeysToMap(values, readKey);

    expect(result.size).toBe(values.length);
    expect(result.get('1')).toBe(1);
    expect(result.get('2')).toBe(2);
    expect(result.get('3')).toBe(3);
    expect(result.get('4')).toBe(4);
  });
});

describe('multiValueMapBuilder()', () => {
  describe('function', () => {
    describe('tuples', () => {
      let builder: MultiValueMapBuilder<[number, number]> = multiValueMapBuilder();

      describe('addTuples()', () => {
        it('should add the tuple to the map', () => {
          const tuple = [1, 2] as [number, number];

          builder.addTuples('test', tuple);

          const result = builder.get('test');

          expect(result.length).toBe(1);
          expect(result[0]).toBe(tuple);
        });
      });
    });
  });
});
