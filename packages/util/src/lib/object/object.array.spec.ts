import { objectFlatMergeMatrix, objectMergeMatrix } from './object.array';

describe('objectMergeMatrix()', () => {
  it('should create a matrix of merged objects', () => {
    const a = [{ x: 1 }, { x: 2 }];
    const b = [{ y: 'a' }, { y: 'b' }];

    const result = objectMergeMatrix(a, b);
    expect(result.length).toBe(2);
    expect(result[0].length).toBe(2);
    expect(result[0][0]).toEqual({ x: 1, y: 'a' });
    expect(result[1][1]).toEqual({ x: 2, y: 'b' });
  });

  it('should return a as a single-row matrix when b is falsy', () => {
    const a = [{ x: 1 }];
    const result = objectMergeMatrix(a, undefined as any);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual([{ x: 1 }]);
  });

  it('should accept single values instead of arrays', () => {
    const result = objectMergeMatrix({ x: 1 }, { y: 2 });
    expect(result[0][0]).toEqual({ x: 1, y: 2 });
  });
});

describe('objectFlatMergeMatrix()', () => {
  it('should return a flat array of merged objects', () => {
    const a = [{ x: 1 }, { x: 2 }];
    const b = [{ y: 'a' }, { y: 'b' }];

    const result = objectFlatMergeMatrix(a, b);
    expect(result.length).toBe(4);
    expect(result).toContainEqual({ x: 1, y: 'a' });
    expect(result).toContainEqual({ x: 2, y: 'b' });
  });
});
