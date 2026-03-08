import { first } from 'rxjs';
import { SimpleLoadingContext } from './loading.context.simple';
import { callbackTest } from '@dereekb/util/test';

describe('SimpleLoadingContext', () => {
  let context: SimpleLoadingContext;

  afterEach(() => {
    context?.destroy();
  });

  it(
    'should start in a loading state by default',
    callbackTest((done) => {
      context = new SimpleLoadingContext();

      context.stream$.pipe(first()).subscribe(({ loading }) => {
        expect(loading).toBe(true);
        done();
      });
    })
  );

  it(
    'should start in a non-loading state when constructed with false',
    callbackTest((done) => {
      context = new SimpleLoadingContext(false);

      context.stream$.pipe(first()).subscribe(({ loading }) => {
        expect(loading).toBe(false);
        done();
      });
    })
  );

  describe('setSuccess()', () => {
    it(
      'should set loading to false',
      callbackTest((done) => {
        context = new SimpleLoadingContext();
        context.setSuccess();

        context.stream$.pipe(first()).subscribe(({ loading }) => {
          expect(loading).toBe(false);
          done();
        });
      })
    );
  });

  describe('setLoading()', () => {
    it(
      'should set loading to true by default',
      callbackTest((done) => {
        context = new SimpleLoadingContext(false);
        context.setLoading();

        context.stream$.pipe(first()).subscribe(({ loading }) => {
          expect(loading).toBe(true);
          done();
        });
      })
    );

    it(
      'should clear any existing error',
      callbackTest((done) => {
        context = new SimpleLoadingContext();
        context.setError({ message: 'test error' });
        context.setLoading();

        context.stream$.pipe(first()).subscribe(({ error }) => {
          expect(error).toBeUndefined();
          done();
        });
      })
    );
  });

  describe('setError()', () => {
    it(
      'should set the error and stop loading by default',
      callbackTest((done) => {
        context = new SimpleLoadingContext();
        const error = { message: 'Something went wrong' };
        context.setError(error);

        context.stream$.pipe(first()).subscribe((event) => {
          expect(event.error).toBe(error);
          expect(event.loading).toBe(false);
          done();
        });
      })
    );

    it(
      'should set the error while keeping loading true when specified',
      callbackTest((done) => {
        context = new SimpleLoadingContext();
        const error = { message: 'Retrying...' };
        context.setError(error, true);

        context.stream$.pipe(first()).subscribe((event) => {
          expect(event.error).toBe(error);
          expect(event.loading).toBe(true);
          done();
        });
      })
    );
  });

  describe('hasError()', () => {
    it('should return false when no error is set', () => {
      context = new SimpleLoadingContext();
      expect(context.hasError()).toBe(false);
    });

    it('should return true when an error is set', () => {
      context = new SimpleLoadingContext();
      context.setError({ message: 'error' });
      expect(context.hasError()).toBe(true);
    });
  });

  describe('clearError()', () => {
    it(
      'should remove the error while preserving other state',
      callbackTest((done) => {
        context = new SimpleLoadingContext();
        context.setError({ message: 'error' });
        context.clearError();

        context.stream$.pipe(first()).subscribe((event) => {
          expect(event.error).toBeUndefined();
          done();
        });
      })
    );
  });
});
