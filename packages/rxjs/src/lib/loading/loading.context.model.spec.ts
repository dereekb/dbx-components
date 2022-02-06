import { LoadingStateContextInstance } from './loading.context.state.model';
import { loadingStateIsLoading, successResult } from '.';
import { of } from 'rxjs';
import { first } from 'rxjs/operators';

describe('LoadingStateContext', () => {

  describe('no state observable.', () => {

    let context: LoadingStateContextInstance;

    beforeEach(() => {
      context = new LoadingStateContextInstance();
    });

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

  describe('config', () => {

    describe('showLoadingOnNoModel', () => {

      describe('=true', () => {

        it(`loading should be true if the result's model is undefined but loading is false.`, (done) => {
          const model = undefined;
          const state = successResult(model);

          expect(loadingStateIsLoading(state)).toBe(false);

          const context = new LoadingStateContextInstance({ obs: of(state), showLoadingOnNoModel: true });

          context.stream$.pipe(first()).subscribe({
            next: ({ loading }) => {
              expect(loading).toBe(true);
            },
            complete: done
          });

        });

      });

      describe('=false', () => {

        it(`loading should be false if the result's model is undefined but loading is false.`, (done) => {
          const model = undefined;
          const state = successResult(model);

          expect(loadingStateIsLoading(state)).toBe(false);

          const context = new LoadingStateContextInstance({ obs: of(state), showLoadingOnNoModel: false });

          context.stream$.pipe(first()).subscribe({
            next: ({ loading }) => {
              expect(loading).toBe(false);
            },
            complete: done
          });

        });

      });

    });

  });

});
