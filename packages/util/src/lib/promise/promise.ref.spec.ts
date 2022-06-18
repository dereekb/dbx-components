import { makePromiseFullRef } from './promise.ref';

describe('makePromiseFullRef', () => {
  it('should create a new PromiseFullRef', (done) => {
    const result = makePromiseFullRef((resolve, reject) => {
      // nothing is required to happen here if not required.
    });

    expect(result.promise).toBeDefined();
    expect(result.resolve).toBeDefined();
    expect(result.reject).toBeDefined();

    const expectedValue = 0;

    result.promise.then((value) => {
      expect(value).toBe(expectedValue);
      done();
    });

    result.resolve(expectedValue);
  });
});
