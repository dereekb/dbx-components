import { type ReadKeyFunction, type ReadMultipleKeysFunction } from '../key';
import { type MultiValueMapBuilder, multiValueMapBuilder, readKeysToMap, readMultipleKeysToMap, keyValueMapFactory, multiKeyValueMapFactory } from './map.key';

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

describe('keyValueMapFactory()', () => {
  const readKey: ReadKeyFunction<number, string> = (x) => String(x);

  it('should return a function.', () => {
    const factory = keyValueMapFactory(readKey);
    expect(typeof factory).toBe('function');
  });

  it('should create a map.', () => {
    const values = [1, 2, 3, 4];
    const factory = keyValueMapFactory(readKey);
    const result = factory(values);

    expect(result.size).toBe(values.length);
    expect(result.get('1')).toBe(1);
    expect(result.get('2')).toBe(2);
    expect(result.get('3')).toBe(3);
    expect(result.get('4')).toBe(4);
  });

  it('should ignore values with null or undefined keys.', () => {
    const values = [1, undefined, 3, null, 5];
    const readKeyWithNulls: ReadKeyFunction<number | null | undefined, string> = (x) => (x != null ? String(x) : x);
    const factory = keyValueMapFactory(readKeyWithNulls);
    const result = factory(values.filter((x) => x != null) as number[]); // factory expects T[], ensure correct type

    // Create a map from values that will have keys
    const expectedMap = new Map<string, number>();
    values.forEach((x) => {
      if (x != null) {
        const key = readKeyWithNulls(x);
        if (key != null) {
          expectedMap.set(key, x);
        }
      }
    });

    // test values manually to ensure it is ignoring the values with null/undefined keys
    const testFactory = keyValueMapFactory<number | null | undefined, string>(readKeyWithNulls);
    const testResult = testFactory(values as (number | null | undefined)[]);

    expect(testResult.size).toBe(3);
    expect(testResult.get('1')).toBe(1);
    expect(testResult.has(undefined as unknown as string)).toBe(false);
    expect(testResult.get('3')).toBe(3);
    expect(testResult.has(null as unknown as string)).toBe(false);
    expect(testResult.get('5')).toBe(5);
  });
});

describe('multiKeyValueMapFactory()', () => {
  type Item = { id: number; categories: string[] };
  const readKeys: ReadMultipleKeysFunction<Item, string> = (x) => x.categories;

  it('should return a function.', () => {
    const factory = multiKeyValueMapFactory(readKeys);
    expect(typeof factory).toBe('function');
  });

  it('should create a map where items are mapped to multiple keys.', () => {
    const items: Item[] = [
      { id: 1, categories: ['a', 'b'] },
      { id: 2, categories: ['b', 'c'] },
      { id: 3, categories: ['a'] }
    ];
    const factory = multiKeyValueMapFactory(readKeys);
    const result = factory(items);

    expect(result.size).toBe(3); // 'a', 'b', 'c'
    expect(result.get('a')).toBe(items[2]); // Last item with 'a' wins for key 'a'
    expect(result.get('b')).toBe(items[1]); // Last item with 'b' wins for key 'b'
    expect(result.get('c')).toBe(items[1]);
  });

  it('should handle items with empty or no keys.', () => {
    const items: Item[] = [
      { id: 1, categories: ['a'] },
      { id: 2, categories: [] }, // Empty keys
      { id: 3, categories: ['b'] },
      { id: 4, categories: undefined as unknown as string[] } // Undefined keys
    ];
    const factory = multiKeyValueMapFactory(readKeys);
    const result = factory(items);

    expect(result.size).toBe(2); // Only 'a' and 'b' should be actual keys
    expect(result.get('a')).toBe(items[0]);
    expect(result.get('b')).toBe(items[2]);
    expect(result.has('')).toBe(false);
    expect(result.has(undefined as unknown as string)).toBe(false);
  });

  it('last item set for a key should be the one in the map.', () => {
    const items: Item[] = [
      { id: 1, categories: ['z'] },
      { id: 2, categories: ['z'] }
    ];
    const factory = multiKeyValueMapFactory(readKeys);
    const result = factory(items);
    expect(result.get('z')).toBe(items[1]);
  });
});

describe('multiValueMapBuilder()', () => {
  describe('function', () => {
    describe('tuples', () => {
      const builder: MultiValueMapBuilder<[number, number]> = multiValueMapBuilder();

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
