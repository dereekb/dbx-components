import { type MapFunction } from './map';
import { type Maybe } from './maybe.type';
import { type MappedUseFunction, mappedUseFunction, mappedUseAsyncFunction, type MappedUseAsyncFunction, wrapUseFunction, wrapUseAsyncFunction } from './use';

describe('mappedUseFunction()', () => {
  const mapFn: MapFunction<number, string> = (number: number) => String(number);

  describe('function', () => {
    const mappedUseFn = mappedUseFunction(mapFn);

    describe('wrapUseFunction', () => {
      it('should wrap a MappedUseFunction function', () => {
        const result: MappedUseFunction<number, boolean> = wrapUseFunction(mappedUseFn, () => true);
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

        it('should receive the mapped value', () => {
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

    it('should receive the mapped value', () => {
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

describe('mappedUsePromiseFunction()', () => {
  const mapFn: MapFunction<number, string> = (number: number) => String(number);

  describe('function', () => {
    const mappedUseAsyncFn = mappedUseAsyncFunction(mapFn);

    describe('sync usage', () => {
      describe('wrapUsePromiseFunction', () => {
        it('should wrap a MappedUsePromiseFunction function', () => {
          const result: MappedUseAsyncFunction<number, boolean> = wrapUseAsyncFunction(mappedUseAsyncFn, () => true);
          expect(result).toBeDefined();
        });

        describe('function', () => {
          const wrappedMapFn = (input: string) => input.toUpperCase();
          const wrappedUseFn = wrapUseAsyncFunction(mappedUseAsyncFn, wrappedMapFn);

          it('should use the value', async () => {
            let used = false;

            await wrappedUseFn(1, () => {
              used = true;
            });

            expect(used).toBe(true);
          });

          it('should receive the mapped value', async () => {
            const value = 1;
            const expectValue = 'hello';
            const expectedMappedValue = wrappedMapFn(mapFn(value));

            const result = await mappedUseAsyncFn(value, (mappedValue) => {
              expect(mappedValue).toBe(expectedMappedValue);
              return expectValue;
            });

            expect(result).toBe(expectValue);
          });
        });
      });

      it('should use the value', async () => {
        let used = false;

        await mappedUseAsyncFn(1, () => {
          used = true;
        });

        expect(used).toBe(true);
      });

      it('should return the value', async () => {
        const expectValue = 'hello';

        const result = await mappedUseAsyncFn(1, () => expectValue);

        expect(result).toBe(expectValue);
      });

      it('should receive the mapped value', async () => {
        const value = 1;
        const expectValue = 'hello';
        const expectedMappedValue = mapFn(value);

        const result = await mappedUseAsyncFn(value, (mappedValue) => {
          expect(mappedValue).toBe(expectedMappedValue);
          return expectValue;
        });

        expect(result).toBe(expectValue);
      });

      it('should return the default value if null or undefined is passed', async () => {
        const defaultValue = 'hello';

        const result = await mappedUseAsyncFn(undefined, () => 'wrong', defaultValue);

        expect(result).toBe(defaultValue);
      });

      it(`should return the default value from it's getter if null or undefined is passed`, async () => {
        const defaultValue = 'hello';

        const result = await mappedUseAsyncFn(
          undefined,
          () => 'wrong',
          () => defaultValue
        );

        expect(result).toBe(defaultValue);
      });

      it('should return the default value if null or undefined returned from the mapped value', async () => {
        const mappedUseWithNullGetterForMap = mappedUseFunction(() => null);
        const defaultValue = 'hello';

        const result = await mappedUseWithNullGetterForMap(undefined, () => 'hello', defaultValue);

        expect(result).toBe(defaultValue);
      });
    });

    describe('async usage', () => {
      describe('wrapUsePromiseFunction', () => {
        it('should wrap a MappedUsePromiseFunction function', () => {
          const result: MappedUseAsyncFunction<number, boolean> = wrapUseAsyncFunction(mappedUseAsyncFn, () => Promise.resolve(true));
          expect(result).toBeDefined();
        });

        it('should be allowed wrap with a function that returns Maybe.', async () => {
          const result: MappedUseAsyncFunction<number, boolean> = wrapUseAsyncFunction(mappedUseAsyncFn, (input: string) => {
            let maybeBoolean: Maybe<boolean>;

            if (input) {
              maybeBoolean = true;
            }

            return maybeBoolean;
          });
          expect(result).toBeDefined();
        });

        describe('function', () => {
          const wrappedMapFn = (input: string) => Promise.resolve(input.toUpperCase());
          const wrappedUseFn = wrapUseAsyncFunction(mappedUseAsyncFn, wrappedMapFn);

          it('should use the value', async () => {
            let used = false;

            await wrappedUseFn(1, () => {
              used = true;
            });

            expect(used).toBe(true);
          });

          it('should receive the mapped value', async () => {
            const value = 1;
            const expectValue = 'hello';
            const expectedMappedValue = await wrappedMapFn(mapFn(value));

            const result = await mappedUseAsyncFn(value, (mappedValue) => {
              expect(mappedValue).toBe(expectedMappedValue);
              return expectValue;
            });

            expect(result).toBe(expectValue);
          });
        });
      });

      it('should use the value', async () => {
        let used = false;

        await mappedUseAsyncFn(1, () => {
          used = true;
        });

        expect(used).toBe(true);
      });

      it('should return the value', async () => {
        const expectValue = 'hello';

        const result = await mappedUseAsyncFn(1, () => expectValue);

        expect(result).toBe(expectValue);
      });

      it('should return the value from a promise', async () => {
        const expectValue = 'hello';

        const result = await mappedUseAsyncFn(1, () => Promise.resolve(expectValue));

        expect(result).toBe(expectValue);
      });

      it('should receive the mapped value', async () => {
        const value = 1;
        const expectValue = 'hello';
        const expectedMappedValue = mapFn(value);

        const result = await mappedUseAsyncFn(value, (mappedValue) => {
          expect(mappedValue).toBe(expectedMappedValue);
          return expectValue;
        });

        expect(result).toBe(expectValue);
      });

      it('should return the default value if null or undefined is passed', async () => {
        const defaultValue = 'hello';

        const result = await mappedUseAsyncFn(undefined, () => 'wrong', defaultValue);

        expect(result).toBe(defaultValue);
      });

      it(`should return the default value from it's getter if null or undefined is passed`, async () => {
        const defaultValue = 'hello';

        const result = await mappedUseAsyncFn(
          undefined,
          () => Promise.resolve('wrong'),
          () => Promise.resolve(defaultValue)
        );

        expect(result).toBe(defaultValue);
      });

      it('should return the default value if null or undefined returned from the mapped value', async () => {
        const mappedUseWithNullGetterForMap = mappedUseAsyncFunction(() => null);
        const defaultValue = 'hello';

        const result = await mappedUseWithNullGetterForMap(undefined, () => 'hello', defaultValue);

        expect(result).toBe(defaultValue);
      });
    });
  });
});
