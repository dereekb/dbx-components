import { MapFunction } from './map';
import { mappedUseFunction } from './use';

describe('mappedUseFunction()', () => {
  const mapFn: MapFunction<number, string> = (number: number) => String(number);

  describe('function', () => {
    const mappedUseFn = mappedUseFunction(mapFn);

    it('should use the value', () => {
      let used = false;

      mappedUseFn(1, () => {
        used = true;
      });

      expect(used).toBe(true);
    });

    it('should return the value', () => {
      const expectValue = 'hello';

      const result = mappedUseFn(1, () => expectValue);

      expect(result).toBe(expectValue);
    });

    it('should recieve the mapped value', () => {
      const value = 1;
      const expectValue = 'hello';
      const expectedMappedValue = mapFn(value);

      const result = mappedUseFn(value, (mappedValue) => {
        expect(mappedValue).toBe(expectedMappedValue);
        return expectValue;
      });

      expect(result).toBe(expectValue);
    });

    it('should return the default value if null or undefined is passed', () => {
      const defaultValue = 'hello';

      const result = mappedUseFn(undefined, () => 'wrong', defaultValue);

      expect(result).toBe(defaultValue);
    });

    it(`should return the default value from it's getter if null or undefined is passed`, () => {
      const defaultValue = 'hello';

      const result = mappedUseFn(
        undefined,
        () => 'wrong',
        () => defaultValue
      );

      expect(result).toBe(defaultValue);
    });

    it('should return the default value if null or undefined returned from the mapped value', () => {
      const mappedUseWithNullGetterForMap = mappedUseFunction(() => null);
      const defaultValue = 'hello';

      const result = mappedUseWithNullGetterForMap(undefined, () => 'hello', defaultValue);

      expect(result).toBe(defaultValue);
    });
  });
});
