import { BaseError } from 'make-error';
import { failSuccessfully, expectSuccessfulFail, JestExpectedFailError, type JestProvidesCallback, failDueToSuccess, JestUnexpectedSuccessFailureError, expectFail, type JestDoneCallback, JestExpectedErrorOfSpecificTypeError, jestExpectFailAssertErrorType } from './jest.fail';
import { fakeDoneHandler, shouldFail } from '../shared/shared.fail';

class TestError extends BaseError {}

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
        expect(e).toBeInstanceOf(JestExpectedFailError);
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
        expect(e).toBeInstanceOf(JestExpectedFailError);
      }
    });

    it('should throw a JestExpectedErrorOfSpecificTypeError if the assertion returns false.', async () => {
      try {
        await expectFail(
          async () => {
            throw new Error('success');
          },
          () => false
        );
      } catch (e) {
        expect(e).toBeInstanceOf(JestExpectedErrorOfSpecificTypeError);
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

    describe('jestExpectFailAssertionFunction()', () => {
      it('should resolve successfully if the error is of the expected type', async () => {
        try {
          await expectFail(async () => {
            throw new Error('success');
          }, jestExpectFailAssertErrorType(Error));
        } catch (e) {
          expect(e).toBeInstanceOf(JestExpectedFailError);
        }
      });
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
