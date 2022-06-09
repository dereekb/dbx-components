import { MapFunction } from './map';
import { MappedUseFunction, mappedUseFunction, wrapUseFunction } from './use';

describe('mappedUseFunction()', () => {
  const mapFn: MapFunction<number, string> = (number: number) => String(number);

  describe('function', () => {
    const mappedUseFn = mappedUseFunction(mapFn);

    describe('wrapUseFunction', () => {
      it('should wrap a MappedUseFunction function', () => {
        const result: MappedUseFunction<number, boolean> = wrapUseFunction(mappedUseFn, (input: string) => true);
        expect(result).toBeDefined();
      });

      describe('function', () => {
        const wrappedMapFn = (input: string) => input.toUpperCase();
        const wrappedUseFn = wrapUseFunction(mappedUseFn, wrappedMapFn);

        it('should use the value', () => {
          let used = false;

          wrappedUseFn(1, () => {
            used = true;
          });

          expect(used).toBe(true);
        });

        it('should recieve the mapped value', () => {
          const value = 1;
          const expectValue = 'hello';
          const expectedMappedValue = wrappedMapFn(mapFn(value));

          const result = mappedUseFn(value, (mappedValue) => {
            expect(mappedValue).toBe(expectedMappedValue);
            return expectValue;
          });

          expect(result).toBe(expectValue);
        });
      });
    });

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
