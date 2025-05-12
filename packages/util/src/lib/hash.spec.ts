import { makeHashDecodeMap, decodeHashedValuesWithDecodeMap, decodeHashedValues, type HashDecodeMap } from './hash';
// Mock or ensure this is testable if it has side effects or complex logic not relevant here

// Mock hash function for testing
const mockHashFn = (value: string): string => `hashed(${value})`;

describe('makeHashDecodeMap', () => {
  it('should return an empty map if decodeValues is empty', () => {
    const decodeValues: string[] = [];
    const result = makeHashDecodeMap(decodeValues, mockHashFn);
    expect(result.size).toBe(0);
  });

  it('should create a map with hashed keys and original values', () => {
    const decodeValues = ['a', 'b', 'c'];
    const result = makeHashDecodeMap(decodeValues, mockHashFn);
    expect(result.size).toBe(3);
    expect(result.get(mockHashFn('a'))).toBe('a');
    expect(result.get(mockHashFn('b'))).toBe('b');
    expect(result.get(mockHashFn('c'))).toBe('c');
  });
});

describe('decodeHashedValuesWithDecodeMap', () => {
  const decodeValues = ['val1', 'val2', 'val3'];
  const decodeMap: HashDecodeMap = makeHashDecodeMap(decodeValues, mockHashFn);

  it('should return an empty array if hashedValues is empty', () => {
    const hashedValues: string[] = [];
    const result = decodeHashedValuesWithDecodeMap(hashedValues, decodeMap);
    expect(result).toEqual([]);
  });

  it('should decode all values if they exist in the map', () => {
    const hashedValues = [mockHashFn('val1'), mockHashFn('val3')];
    const result = decodeHashedValuesWithDecodeMap(hashedValues, decodeMap);
    expect(result).toEqual(['val1', 'val3']);
  });

  it('should filter out values not in the map', () => {
    const hashedValues = [mockHashFn('val1'), 'unknown_hash', mockHashFn('val2')];
    const result = decodeHashedValuesWithDecodeMap(hashedValues, decodeMap);
    expect(result).toEqual(['val1', 'val2']);
  });

  it('should return an empty array if decodeMap is empty', () => {
    const hashedValues = [mockHashFn('val1')];
    const emptyMap: HashDecodeMap = new Map();
    const result = decodeHashedValuesWithDecodeMap(hashedValues, emptyMap);
    expect(result).toEqual([]);
  });
});

describe('decodeHashedValues', () => {
  const decodeValues = ['apple', 'banana', 'cherry'];

  it('should return an empty array if hashedValues is empty', () => {
    const hashedValues: string[] = [];
    const result = decodeHashedValues(hashedValues, decodeValues, mockHashFn);
    expect(result).toEqual([]);
  });

  it('should return an empty array if decodeValues is empty', () => {
    const hashedValues = [mockHashFn('apple')];
    const result = decodeHashedValues(hashedValues, [], mockHashFn);
    expect(result).toEqual([]);
  });

  it('should decode values correctly', () => {
    const hashedValues = [mockHashFn('banana'), mockHashFn('apple')];
    const result = decodeHashedValues(hashedValues, decodeValues, mockHashFn);
    expect(result).toEqual(['banana', 'apple']);
  });

  it('should filter out undecodable values', () => {
    const hashedValues = [mockHashFn('apple'), 'hashed(unknown)', mockHashFn('cherry')];
    const result = decodeHashedValues(hashedValues, decodeValues, mockHashFn);
    expect(result).toEqual(['apple', 'cherry']);
  });

  it('should handle cases where no values can be decoded', () => {
    const hashedValues = ['hashed(fig)', 'hashed(grape)'];
    const result = decodeHashedValues(hashedValues, decodeValues, mockHashFn);
    expect(result).toEqual([]);
  });
});
