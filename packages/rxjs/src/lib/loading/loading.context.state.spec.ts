import { loadingStateContext, type MutableLoadingStateContext, SubscriptionObject } from '@dereekb/rxjs';
import { isLoadingStateLoading, successResult } from './loading.state';
import { delay, first, timeout, of } from 'rxjs';

describe('loadingStateContext()', () => {
  describe('context', () => {
    let context: MutableLoadingStateContext;

    beforeEach(() => {
      context = loadingStateContext();
    });

    afterEach(() => {
      context.destroy();
    });

    describe('no state observable.', () => {
      it('should return a loading state stream.', (done) => {
        context.stream$.pipe(first()).subscribe({
          next: ({ loading }) => {
            expect(loading).toBe(true);
          },
          complete: done
        });
      });

      it('loading$ should return true.', (done) => {
        context.loading$.pipe(first()).subscribe({
          next: (loading) => {
            expect(loading).toBe(true);
          },
          complete: done
        });
      });
    });

    describe('long loading state', () => {
      const value = 'value';
      let sub: SubscriptionObject;

      beforeEach(() => {
        context.setStateObs(of(successResult(value)).pipe(delay(300)));
        sub = new SubscriptionObject();
      });

      afterEach(() => {
        sub.destroy();
      });

      it('loading$ should return true without waiting for the delay.', (done) => {
        sub.subscription = context.loading$.pipe(timeout({ first: 100 }), first()).subscribe({
          next: (loading) => {
            expect(loading).toBe(true);
          },
          complete: done
        });
      });

      it('valueAfterLoaded$ should wait for the delay.', (done) => {
        sub.subscription = context.valueAfterLoaded$.pipe(timeout({ first: 100, with: () => of(value) }), first()).subscribe({
          next: (result) => {
            expect(result).toBe(value);
          },
          complete: done
        });
      });
    });

    describe('finished state', () => {
      const value = 'value';

      beforeEach(() => {
        context.setStateObs(of(successResult(value)));
      });

      it('loading$ should return false.', (done) => {
        context.loading$.pipe(first()).subscribe({
          next: (loading) => {
            expect(loading).toBe(false);
          },
          complete: done
        });
      });

      it('value$ should return false.', (done) => {
        context.value$.pipe(first()).subscribe({
          next: (result) => {
            expect(result).toBe(value);
          },
          complete: done
        });
      });
    });
  });

  describe('config', () => {
    describe('showLoadingOnNoModel', () => {
      describe('=true', () => {
        it(`loading should be true if the result's value is undefined but loading is false.`, (done) => {
          const value = undefined;
          const state = successResult(value);

          expect(isLoadingStateLoading(state)).toBe(false);

          const context = loadingStateContext({ obs: of(state), showLoadingOnNoValue: true });

          context.stream$.pipe(first()).subscribe({
            next: ({ loading }) => {
              expect(loading).toBe(true);
            },
            complete: done
          });
        });
      });

      describe('=false', () => {
        it(`loading should be false if the result's value is undefined but loading is false.`, (done) => {
          const value = undefined;
          const state = successResult(value);

          expect(isLoadingStateLoading(state)).toBe(false);

          const context = loadingStateContext({ obs: of(state), showLoadingOnNoValue: false });

          context.stream$.pipe(first()).subscribe({
            next: (result) => {
              const { loading } = result;
              expect(loading).toBe(false);
            },
            complete: done
          });
        });
      });
    });
  });
});
