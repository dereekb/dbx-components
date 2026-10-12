import { arrayToMap, arrayToObject, generateIfDoesNotExist } from './array.map';

interface TestItem {
  id: string;
  value: number;
}

describe('arrayToMap', () => {
  it('should create a Map from array values using the key function', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 }
    ];

    const result = arrayToMap(items, (x) => x.id);

    expect(result.size).toBe(3);
    expect(result.get('a')).toBe(items[0]);
    expect(result.get('b')).toBe(items[1]);
    expect(result.get('c')).toBe(items[2]);
  });

  it('should use custom value function when provided', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ];

    const result = arrayToMap(
      items,
      (x) => x.id,
      (x) => x.value
    );

    expect(result.size).toBe(2);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
  });

  it('should handle empty array', () => {
    const result = arrayToMap([] as TestItem[], (x) => x.id);

    expect(result.size).toBe(0);
  });
});

describe('arrayToObject', () => {
  it('should create a Record from array values using the key function', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 }
    ];

    const result = arrayToObject(items, (x) => x.id);

    expect(result['a']).toBe(items[0]);
    expect(result['b']).toBe(items[1]);
    expect(result['c']).toBe(items[2]);
  });

  it('should use custom value function when provided', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ];

    const result = arrayToObject(
      items,
      (x) => x.id,
      (x) => x.value
    );

    expect(result['a']).toBe(1);
    expect(result['b']).toBe(2);
  });

  it('should omit entries with undefined keys', () => {
    const items = [
      { id: 'a' as string | undefined, value: 1 },
      { id: undefined, value: 2 },
      { id: 'c' as string | undefined, value: 3 }
    ];

    const result = arrayToObject(
      items,
      (x) => x.id as string,
      (x) => x.value
    );

    expect(result['a']).toBe(1);
    expect(result['c']).toBe(3);
    expect(Object.keys(result).length).toBe(2);
  });

  it('should handle empty array', () => {
    const result = arrayToObject([] as TestItem[], (x) => x.id);

    expect(Object.keys(result).length).toBe(0);
  });
});

describe('arrayToObject() config', () => {
  it('should index the values by readKey', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ];

    const result = arrayToObject(items, { readKey: (x) => x.id });

    expect(result['a']).toBe(items[0]);
    expect(result['b']).toBe(items[1]);
  });

  it('should map the stored value with readValue', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ];

    const result = arrayToObject(items, { readKey: (x) => x.id, readValue: (x) => x.value });

    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should skip values with a null or undefined key', () => {
    const items = [{ id: 'a' }, { id: null }, { id: undefined }];

    const result = arrayToObject(items, { readKey: (x) => x.id });

    expect(Object.keys(result)).toEqual(['a']);
  });

  it('should let the last value win when throwOnDuplicateKey is not set', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'a', value: 2 }
    ];

    const result = arrayToObject(items, { readKey: (x) => x.id });

    expect(result['a']).toBe(items[1]);
  });

  it('should not throw on a duplicate when throwOnDuplicateKey is false', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'a', value: 2 }
    ];

    expect(() => arrayToObject(items, { readKey: (x) => x.id, throwOnDuplicateKey: false })).not.toThrow();
  });

  it('should throw the default error on a duplicate when throwOnDuplicateKey is true', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'a', value: 2 }
    ];

    expect(() => arrayToObject(items, { readKey: (x) => x.id, throwOnDuplicateKey: true })).toThrow('arrayToObject(): duplicate key "a".');
  });

  it('should throw the error from the factory with the key and the later value', () => {
    const items: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'a', value: 2 }
    ];

    const factory = vi.fn((key: string, value: TestItem) => new Error(`duplicate ${key} ${value.value}`));

    expect(() => arrayToObject(items, { readKey: (x) => x.id, throwOnDuplicateKey: factory })).toThrow('duplicate a 2');
    expect(factory).toHaveBeenCalledWith('a', items[1]);
  });

  it('should not treat Object.prototype member names as duplicates', () => {
    const items: TestItem[] = [
      { id: 'toString', value: 1 },
      { id: 'constructor', value: 2 }
    ];

    const result = arrayToObject(items, { readKey: (x) => x.id, readValue: (x) => x.value, throwOnDuplicateKey: true });

    expect(result['toString']).toBe(1);
    expect(result['constructor']).toBe(2);
  });
});

describe('generateIfDoesNotExist', () => {
  it('should return existing values for keys that exist', () => {
    const existing: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ];
    const generateFn = vi.fn((key: string) => ({ id: key, value: 0 }));

    const result = generateIfDoesNotExist(['a', 'b'], existing, (x) => x.id, generateFn);

    expect(result.length).toBe(2);
    expect(result[0]).toBe(existing[0]);
    expect(result[1]).toBe(existing[1]);
    expect(generateFn).not.toHaveBeenCalled();
  });

  it("should generate values for keys that don't exist", () => {
    const existing: TestItem[] = [{ id: 'a', value: 1 }];
    const generateFn = vi.fn((key: string) => ({ id: key, value: 99 }));

    const result = generateIfDoesNotExist(['a', 'b', 'c'], existing, (x) => x.id, generateFn);

    expect(result.length).toBe(3);
    expect(result[0]).toBe(existing[0]);
    expect(result[1]).toEqual({ id: 'b', value: 99 });
    expect(result[2]).toEqual({ id: 'c', value: 99 });
    expect(generateFn).toHaveBeenCalledTimes(2);
    expect(generateFn).toHaveBeenCalledWith('b');
    expect(generateFn).toHaveBeenCalledWith('c');
  });

  it('should handle all keys existing', () => {
    const existing: TestItem[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 }
    ];
    const generateFn = vi.fn((key: string) => ({ id: key, value: 0 }));

    const result = generateIfDoesNotExist(['a', 'b', 'c'], existing, (x) => x.id, generateFn);

    expect(result.length).toBe(3);
    expect(result[0]).toBe(existing[0]);
    expect(result[1]).toBe(existing[1]);
    expect(result[2]).toBe(existing[2]);
    expect(generateFn).not.toHaveBeenCalled();
  });

  it('should handle no keys existing', () => {
    const existing: TestItem[] = [];
    const generateFn = vi.fn((key: string) => ({ id: key, value: 0 }));

    const result = generateIfDoesNotExist(['a', 'b'], existing, (x) => x.id, generateFn);

    expect(result.length).toBe(2);
    expect(result[0]).toEqual({ id: 'a', value: 0 });
    expect(result[1]).toEqual({ id: 'b', value: 0 });
    expect(generateFn).toHaveBeenCalledTimes(2);
  });
});
