import { transformNumberFunction, transformNumberFunctionConfig } from './transform';

describe('transformNumberFunctionConfig()', () => {
  it('should return undefined for undefined input', () => {
    expect(transformNumberFunctionConfig(undefined)).toBeUndefined();
  });

  it('should wrap a function into a config object', () => {
    const fn = (x: number) => x * 2;
    const result = transformNumberFunctionConfig(fn);
    expect(result).toBeDefined();
    expect(result!.transform).toBe(fn);
  });

  it('should return a config object as-is', () => {
    const config = { precision: 2 };
    const result = transformNumberFunctionConfig(config);
    expect(result).toBe(config);
  });
});

describe('transformNumberFunction()', () => {
  it('should apply a custom transform', () => {
    const fn = transformNumberFunction({ transform: (x) => x * 2 });
    expect(fn(5)).toBe(10);
  });

  it('should apply step rounding', () => {
    const fn = transformNumberFunction({ roundToStep: 5 });
    expect(fn(7)).toBe(10); // rounds up to step of 5
  });

  it('should apply precision', () => {
    const fn = transformNumberFunction({ precision: 1 });
    expect(fn(1.25 as number)).toBe(1.2);
  });

  it('should apply bounds clamping', () => {
    const fn = transformNumberFunction({ bounds: { min: 0, max: 10 } });
    expect(fn(15)).toBe(10);
    expect(fn(-5)).toBe(0);
  });

  it('should chain all transforms in order', () => {
    const fn = transformNumberFunction({
      transform: (x) => x * 3,
      bounds: { min: 0, max: 100 }
    });
    expect(fn(50)).toBe(100); // 50 * 3 = 150, clamped to 100
  });
});
