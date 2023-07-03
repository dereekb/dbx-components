import { Maybe } from '@dereekb/util';
import { BehaviorSubject, map, of, first } from 'rxjs';
import { filterWithSearchString } from '../rxjs';
import { LoadingState, beginLoading, errorResult, loadingStateHasError, loadingStateHasFinishedLoading, loadingStateHasValue, loadingStateIsLoading, successResult } from './loading.state';
import { combineLoadingStatesStatus, mapLoadingStateValueWithOperator } from './loading.state.rxjs';

describe('mapLoadingStateValueWithOperator()', () => {
  it('should map successful values', (done) => {
    const expectedValues = ['aaa', 'aac'];
    const values = [...expectedValues, 'ddd', 'eee'];

    const search$ = new BehaviorSubject<Maybe<string>>('a');
    const values$ = new BehaviorSubject<LoadingState<string[]>>({ value: values });

    const obs = values$.pipe(
      mapLoadingStateValueWithOperator(
        filterWithSearchString({
          filter: (a) => a,
          search$
        })
      )
    );

    obs.subscribe((state) => {
      const { value } = state;

      if (value) {
        expect(value.length).toBe(2);
        expect(value).toContain(expectedValues[0]);
        expect(value).toContain(expectedValues[1]);
        done();
      }
    });
  });

  it('should not map undefined success values', (done) => {
    const expectedValue = undefined;
    const value = undefined;

    const values$ = new BehaviorSubject<LoadingState<Maybe<string>>>({ value });

    const obs = values$.pipe(mapLoadingStateValueWithOperator(map(() => 'hello world')));

    obs.subscribe((state) => {
      const { value } = state;
      expect(value).toBe(expectedValue);
      done();
    });
  });

  it('should map null success values', (done) => {
    const expectedValue = 'test';
    const value = null;

    const values$ = new BehaviorSubject<LoadingState<Maybe<string>>>({ value });

    const obs = values$.pipe(mapLoadingStateValueWithOperator(map(() => expectedValue)));

    obs.subscribe((state) => {
      const { value } = state;
      expect(value).toBe(expectedValue);
      done();
    });
  });

  it('should map loading states', (done) => {
    const search$ = new BehaviorSubject<Maybe<string>>('a');
    const values$ = new BehaviorSubject<LoadingState<string[]>>({ loading: true });

    const obs = values$.pipe(
      mapLoadingStateValueWithOperator(
        filterWithSearchString({
          filter: (a) => a,
          search$
        })
      )
    );

    obs.subscribe((state) => {
      const { loading } = state;
      expect(loading).toBe(true);
      done();
    });
  });
});

describe('combineLoadingStatesStatus()', () => {
  it('should return a loading state as success with true when all loading states are success', (done) => {
    const success = of(successResult(1));
    const success2 = of(successResult(2));

    const obs = combineLoadingStatesStatus([success, success2]);

    obs.subscribe((x) => {
      expect(x.value).toBe(true);
      expect(loadingStateHasFinishedLoading(x)).toBe(true);
      expect(loadingStateHasValue(x)).toBe(true);
      done();
    });
  });

  it('should return a loading state as loading when one or more loading states are loading', (done) => {
    const loading = of(beginLoading());
    const success = of(successResult(1));
    const success2 = of(successResult(2));

    const obs = combineLoadingStatesStatus([loading, success, success2]);

    obs.subscribe((x) => {
      expect(x.loading).toBe(true);
      expect(loadingStateIsLoading(x)).toBe(true);
      done();
    });
  });

  it('should return a loading state as success after all items have finished loading', (done) => {
    const first = new BehaviorSubject<LoadingState<number>>(beginLoading());
    const success = of(successResult(1));

    const obs = combineLoadingStatesStatus([first, success]);

    obs.subscribe((x) => {
      if (x.loading) {
        expect(loadingStateIsLoading(x)).toBe(true);
        first.next(successResult(1)); // trigger loading completion
      } else {
        expect(x.loading).toBe(false);
        expect(loadingStateIsLoading(x)).toBe(false);
        first.complete();
        done();
      }
    });
  });

  it('should return a loading state with an error when one or more loading states have an error', (done) => {
    const errorValue = new Error();
    const loading = of(beginLoading());
    const error = of(errorResult(errorValue));
    const success = of(successResult(1));

    const obs = combineLoadingStatesStatus([loading, success, error]);

    obs.subscribe((x) => {
      expect(x.error).toBeDefined();
      expect(x.error?._error).toBe(errorValue);
      expect(loadingStateHasError(x)).toBe(true);
      done();
    });
  });
});
