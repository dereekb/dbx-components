import { takeLast } from './array';

describe('takeLast', () => {

  const testArray = [1, 2, 3];
  const testLongerArray = [1, 2, 3, 4, 5];

  it('should take the last elements', () => {
    const result = takeLast(testArray, 2);
    expect(result.length).toBe(2);
    expect(result).toContain(2);
    expect(result).toContain(3);
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(3);
  });

  it('should take the last elements and keep the specified number of elements in the front', () => {
    const result = takeLast(testArray, 2, 1);  // Take 2 total, keep 1 from front
    expect(result.length).toBe(2);
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result[0]).toBe(1)
    expect(result[1]).toBe(3);
  });

  describe('longer take', () => {

    it('should take the last elements', () => {
      const result = takeLast(testArray, 5, 1);
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(3);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(3);
    });

  });

  describe('longer array', () => {

    it('should take the last elements and keep the specified number of elements in the front', () => {
      const result = takeLast(testLongerArray, 3, 1);  // Take 3 total, keep 1 from front
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(4);
      expect(result).toContain(5);
      expect(result[0]).toBe(1)
      expect(result[1]).toBe(4);
      expect(result[2]).toBe(5);
    });

    it('should take the last elements and keep the specified number of elements in the front more', () => {
      const result = takeLast(testLongerArray, 3, 2);  // Take 3 total, keep 2 from front
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(5);
      expect(result[0]).toBe(1)
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(5);
    });

  });

});
