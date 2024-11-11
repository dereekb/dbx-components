import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { BaseError } from 'make-error';
import { TryWithPromiseFactoriesFunction, tryWithPromiseFactoriesFunction } from './promise.factory';
import { range } from '../array/array.number';
import { isEvenNumber, randomNumberFactory } from '../number';
import { performAsyncTasks, performTasksFromFactoryInParallelFunction, performTasksInParallel } from './promise';
import { waitForMs } from './wait';
import { Maybe } from '../value/maybe.type';

class TestError extends BaseError {}

describe('tryWithPromiseFactoriesFunction()', () => {
  describe('instance', () => {
    const TRIGGER_ERROR_VALUE = '4';

    let lastValueTried1: Maybe<string> = undefined;
    let lastValueTried2: Maybe<string> = undefined;
    let lastValueTried3: Maybe<string> = undefined;

    beforeEach(() => {
      lastValueTried1 = undefined;
      lastValueTried2 = undefined;
      lastValueTried3 = undefined;
    });

    const instance = tryWithPromiseFactoriesFunction<Maybe<string>, Maybe<number>>({
      promiseFactories: [
        async (x) => {
          lastValueTried1 = x;
          return x === '1' ? 1 : undefined;
        },
        async (x) => {
          lastValueTried2 = x;

          if (x === '4') {
            throw new TestError();
          }

          return x === '2' ? 2 : undefined;
        },
        async (x) => {
          lastValueTried3 = x;
          return x === '3' ? 3 : undefined;
        }
      ]
    });

    it('should return the successful value from the first promise factory', async () => {
      const result = await instance('1');

      expect(result).toBe(1);
      expect(lastValueTried1).toBe('1');
      expect(lastValueTried2).toBeUndefined();
      expect(lastValueTried3).toBeUndefined();
    });

    it('should return the successful value from the third promise factory', async () => {
      const result = await instance('3');

      expect(result).toBe(3);
      expect(lastValueTried1).toBe('3');
      expect(lastValueTried2).toBe('3');
      expect(lastValueTried3).toBe('3');
    });

    describe('successOnMaybe=true', () => {
      it('should return the first encountered nullish value', async () => {
        const result = await instance('2', { successOnMaybe: true });
        expect(result).toBeUndefined();

        expect(lastValueTried1).toBe('1');
        expect(lastValueTried2).toBeUndefined();
        expect(lastValueTried3).toBeUndefined();
      });
    });

    describe('throwErrors=true', () => {
      itShouldFail('when encountering an error', async () => {
        await expectFail(() => instance(TRIGGER_ERROR_VALUE, { throwErrors: true }), jestExpectFailAssertErrorType(TestError));
      });
    });
  });
});
