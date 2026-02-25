import { describe, it, expect } from 'vitest';
import { BaseError } from 'make-error';
import { failSuccessfully, expectSuccessfulFail, ExpectedFailError, shouldFail, failDueToSuccess, UnexpectedSuccessFailureError, expectFail, ExpectedErrorOfSpecificTypeError, expectFailAssertErrorType } from './shared.fail';
import { testDoneCallbackRef, type TestProvidesCallback, type TestDoneCallback } from './shared';

class TestError extends BaseError {}

describe('testDoneCallbackRef()', () => {
  it('should create a TestDoneCallbackRef', () => {
    const ref = testDoneCallbackRef();

    expect(ref).toBeDefined();
    expect(ref._promise).toBeDefined();
    expect(ref._promise.promise).toBeDefined();
    expect(ref.done).toBeDefined();
    expect(typeof ref.done).toBe('function');
    expect(typeof ref.done.fail).toBe('function');
  });

  it('should resolve the promise when done is called without an error', async () => {
    const ref = testDoneCallbackRef();

    ref.done();

    await expect(ref._promise.promise).resolves.toBeUndefined();
  });

  it('should throw an error when done is called with an error', async () => {
    const ref = testDoneCallbackRef();
    const testError = new Error('test error');
    ref.done(testError);

    await expect(() => ref._promise.promise).rejects.toThrow(testError);
  });

  it('should throw an error when done is called with an error string', async () => {
    const ref = testDoneCallbackRef();
    const errorString = 'test error string';

    ref.done(errorString);

    await expect(() => ref._promise.promise).rejects.toThrow(errorString);
  });

  it('should throw an error when done.fail is called with an error', async () => {
    const ref = testDoneCallbackRef();
    const testError = new Error('test error');

    ref.done.fail(testError);

    await expect(() => ref._promise.promise).rejects.toThrow(testError);
  });

  it('should throw an error when done.fail is called with an error string', async () => {
    const ref = testDoneCallbackRef();
    const errorString = 'test error';

    ref.done.fail(errorString);

    await expect(() => ref._promise.promise).rejects.toThrow(errorString);
  });

  it('should only resolve the promise once if done is called multiple times', async () => {
    const ref = testDoneCallbackRef();

    ref.done();
    ref.done(); // Second call should be safe

    await expect(ref._promise.promise).resolves.toBeUndefined();
  });

  it('can be used in async test patterns', async () => {
    const ref = testDoneCallbackRef();

    // Simulate an async operation that calls done when complete
    setTimeout(() => {
      ref.done();
    }, 50);

    // Wait for the done callback to be called
    await expect(ref._promise.promise).resolves.toBeUndefined();
  });
});

describe('expectFail', () => {
  describe('sync', () => {
    it('should throw an UnexpectedSuccessFailureError if an error is not thrown.', () => {
      try {
        expectFail(() => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(UnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if any exception is thrown.', () => {
      try {
        expectFail(() => {
          throw new Error('success');
        });
      } catch (e) {
        expect(e).toBeInstanceOf(ExpectedFailError);
      }
    });
  });

  describe('async', () => {
    it('should throw an UnexpectedSuccessFailureError if an error is not thrown.', async () => {
      try {
        await expectFail(async () => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(UnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if any exception is thrown.', async () => {
      try {
        await expectFail(async () => {
          throw new Error('success');
        });
      } catch (e) {
        expect(e).toBeInstanceOf(ExpectedFailError);
      }
    });
  });

  describe('assertFailType', () => {
    it('should resolve successfully the assertion returns nullish.', async () => {
      try {
        await expectFail(
          async () => {
            throw new Error('success');
          },
          () => null
        );
      } catch (e) {
        expect(e).toBeInstanceOf(ExpectedFailError);
      }
    });

    it('should resolve successfully the assertion returns true.', async () => {
      try {
        await expectFail(
          async () => {
            throw new Error('success');
          },
          () => true
        );
      } catch (e) {
        expect(e).toBeInstanceOf(ExpectedFailError);
      }
    });

    it('should throw an ExpectedErrorOfSpecificTypeError if the assertion returns false.', async () => {
      try {
        await expectFail(
          async () => {
            throw new Error('success');
          },
          () => false
        );
      } catch (e) {
        expect(e).toBeInstanceOf(ExpectedErrorOfSpecificTypeError);
      }
    });

    it('should throw a custom error if the error assertion throws an error.', async () => {
      try {
        await expectFail(
          async () => {
            throw new Error('success');
          },
          (e) => {
            throw new Error('error'); // throw custom error
          }
        );
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('error');
      }
    });

    describe('expectFailAssertErrorType()', () => {
      it('should resolve successfully if the error is of the expected type', async () => {
        try {
          await expectFail(async () => {
            throw new Error('success');
          }, expectFailAssertErrorType(Error));
        } catch (e) {
          expect(e).toBeInstanceOf(ExpectedFailError);
        }
      });
    });
  });
});

describe('expectSuccessfulFail', () => {
  describe('sync', () => {
    it('should throw an UnexpectedSuccessFailureError if ExpectedFailError is not thrown.', () => {
      try {
        expectSuccessfulFail(() => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(UnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if ExpectedFailError is thrown.', () => {
      try {
        expectSuccessfulFail(() => {
          failSuccessfully(); // fail successfully.
        });
      } catch (e) {
        failDueToSuccess();
      }
    });
  });

  describe('async', () => {
    it('should throw an UnexpectedSuccessFailureError if ExpectedFailError is not thrown.', async () => {
      try {
        await expectSuccessfulFail(async () => {
          //no error thrown in async
        });
      } catch (e) {
        expect(e).toBeInstanceOf(UnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if ExpectedFailError is thrown.', async () => {
      try {
        await expectSuccessfulFail(async () => {
          failSuccessfully(); // fail successfully.
        });
      } catch (e) {
        failDueToSuccess();
      }
    });

    it('should resolve successfully if ExpectedFailError is thrown in chain.', async () => {
      try {
        await expectSuccessfulFail(async () => {
          await Promise.resolve(0).then(() => {
            failSuccessfully(); // fail successfully in chain.
          });
        });
      } catch (e) {
        failDueToSuccess();
      }
    });
  });
});

describe('shouldFail()', () => {
  function testFailureCaseWithFunction(describe: string, successfulFunction: TestProvidesCallback) {
    it(describe, async () => {
      return shouldFail(successfulFunction)().then(
        () => {
          throw new Error('should have thrown an error.');
        },
        (e) => {
          expect(e).not.toBeInstanceOf(ExpectedFailError);
        }
      );
    });
  }

  describe('with sync function', () => {
    it(
      'should pass if failSuccessfully() is called.',
      shouldFail(() => {
        failSuccessfully();
      })
    );

    testFailureCaseWithFunction('should fail if a non-expected error occurs.', () => {
      throw new Error('success');
    });

    testFailureCaseWithFunction('should fail if failSuccessfully() is not called within a sync function.', () => {
      // synchronous return without done.
    });
  });

  describe('with promise', () => {
    it(
      'should pass if failSuccessfully() is called.',
      shouldFail(async () => {
        failSuccessfully();
      })
    );

    testFailureCaseWithFunction('should fail if a non-expected error occurs.', async () => {
      return Promise.reject(new Error('success'));
    });

    testFailureCaseWithFunction('should fail if failSuccessfully() is not called within a promise-returning test.', () => {
      return Promise.resolve(0);
    });
  });

  describe('with done callback', () => {
    it(
      'should pass if failSuccessfully() is called.',
      shouldFail(() => {
        failSuccessfully();
      })
    );

    it(
      'should pass if done.failSuccessfully() is called.',
      shouldFail((done) => {
        done.failSuccessfully();
      })
    );

    testFailureCaseWithFunction('should fail if a promise is returned', ((done: TestDoneCallback) => {
      return Promise.resolve(0 as any);
    }) as any);

    testFailureCaseWithFunction('should fail done returns an error', (done) => {
      done(new Error('success'));
    });

    testFailureCaseWithFunction('should fail if failSuccessfully() is not called within a done-using test', (done) => {
      // return success with done
      done();
    });
  });
});
