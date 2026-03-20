import { promiseReference } from './promise.ref';
import { callbackTest } from '@dereekb/util/test';

describe('makePromiseFullRef', () => {
  it(
    'should create a new PromiseFullRef',
    callbackTest((done) => {
      const result = promiseReference((resolve, reject) => {
        // nothing is required to happen here if not required.
      });

      expect(result.promise).toBeDefined();
      expect(result.resolve).toBeDefined();
      expect(result.reject).toBeDefined();

      const expectedValue = 0;

      void result.promise.then((value) => {
        expect(value).toBe(expectedValue);
        done();
      });

      result.resolve(expectedValue);
    })
  );
});
