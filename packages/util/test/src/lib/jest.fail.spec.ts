import { fakeDoneHandler, expectError, JestShouldFailError, shouldFail, JestProvidesCallback } from './jest.fail';

describe('expectError', () => {
  describe('sync', () => {
    it('should throw a JestShouldFailError if no error is caught.', () => {
      try {
        expectError(() => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestShouldFailError);
      }
    });
  });

  describe('async', () => {
    it('should throw a JestShouldFailError if no error is caught.', async () => {
      try {
        await expectError(async () => {
          //no error thrown
        });
      } catch (e) {
        expect(e).toBeInstanceOf(JestShouldFailError);
      }
    });
  });
});

describe('shouldFail', () => {
  function testFailure(describe: string, successfulFunction: JestProvidesCallback) {
    it(describe, (done) => {
      const fakeDone = fakeDoneHandler();
      const { promise } = fakeDone;

      shouldFail(successfulFunction)(fakeDone);

      promise.then(
        () => {
          done.fail('should have thrown an error.');
        },
        (e) => {
          expect(e).toBeInstanceOf(JestShouldFailError);
          done();
        }
      );
    });
  }

  describe('with sync function', () => {
    it(
      'should pass if a failure occurs.',
      shouldFail(async () => {
        return Promise.reject(new Error('success'));
      })
    );

    testFailure('should fail if a failure within a sync function does not occur.', () => {
      // synchronous return without done.
    });
  });

  describe('with promise', () => {
    it(
      'should pass if a failure occurs.',
      shouldFail(async () => {
        return Promise.reject(new Error('success'));
      })
    );

    testFailure('should fail if a failure within a test that returns a promise does not occur.', () => {
      return Promise.resolve(0);
    });
  });

  describe('with done callback', () => {
    it(
      'should pass if a failure occurs via done.',
      shouldFail((done) => {
        done.fail(new Error('success'));
      })
    );

    it(
      'should pass if a failure occurs via thrown exception.',
      shouldFail((done) => {
        throw new Error('success');
      })
    );

    testFailure('should fail if a failure within a test that uses done does not occur.', (done) => {
      // return success with done
      done();
    });
  });
});
