import { failSuccessfully, fakeDoneHandler, expectSuccessfulFail, JestExpectedFailError, shouldFail, JestProvidesCallback, failDueToSuccess, JestUnexpectedSuccessFailureError, expectFail, JestDoneCallback } from './jest.fail';

describe('expectFail', () => {
  describe('sync', () => {
    it('should throw a JestSuccessFailureError if an error is not thrown.', () => {
      try {
        expectFail(() => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestUnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if any exception is thrown.', () => {
      try {
        expectFail(() => {
          throw new Error('success');
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestExpectedFailError);
      }
    });
  });

  describe('async', () => {
    it('should throw a JestSuccessFailureError if an error is not thrown.', async () => {
      try {
        await expectFail(async () => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestUnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if any exception is thrown.', async () => {
      try {
        await expectFail(async () => {
          throw new Error('success');
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestExpectedFailError);
      }
    });
  });
});

describe('expectSuccessfulFail', () => {
  describe('sync', () => {
    it('should throw a JestSuccessFailureError if JestExpectedFailError is not thrown.', () => {
      try {
        expectSuccessfulFail(() => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestUnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if JestExpectedFailError is thrown.', () => {
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
    it('should throw a JestSuccessFailureError if JestExpectedFailError is not thrown.', async () => {
      try {
        await expectSuccessfulFail(async () => {
          //no error thrown in async
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestUnexpectedSuccessFailureError);
      }
    });

    it('should resolve successfully if JestExpectedFailError is thrown.', async () => {
      try {
        await expectSuccessfulFail(async () => {
          failSuccessfully(); // fail successfully.
        });
      } catch (e) {
        failDueToSuccess();
      }
    });

    it('should resolve successfully if JestExpectedFailError is thrown in chain.', async () => {
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

describe('shouldFail', () => {
  function testFailureCaseWithFunction(describe: string, successfulFunction: JestProvidesCallback) {
    it(describe, (done) => {
      const fakeDone = fakeDoneHandler();
      const { promise } = fakeDone;

      shouldFail(successfulFunction)(fakeDone);

      promise.then(
        () => {
          done.fail('should have thrown an error.');
        },
        (e) => {
          expect(e).not.toBeInstanceOf(JestExpectedFailError);
          done();
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

    testFailureCaseWithFunction('should fail if another error occurs.', () => {
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

    testFailureCaseWithFunction('should fail if another error occurs.', async () => {
      return Promise.reject(new Error('success'));
    });

    testFailureCaseWithFunction('should fail if failSuccessfully() is not called within a promise-returning test.', () => {
      return Promise.resolve(0);
    });
  });

  describe('with done callback', () => {
    it(
      'should pass if failSuccessfully() is called.',
      shouldFail((done) => {
        failSuccessfully();
      })
    );

    it(
      'should pass if done.failSuccessfully() is called.',
      shouldFail((done) => {
        done.failSuccessfully();
      })
    );

    testFailureCaseWithFunction('should fail if a promise is returned', ((done: JestDoneCallback) => {
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
