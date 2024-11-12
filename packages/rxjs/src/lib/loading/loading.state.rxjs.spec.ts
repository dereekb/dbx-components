import { type Maybe, objectKeysEqualityComparatorFunction } from '@dereekb/util';
import { BehaviorSubject, map, of, first, switchMap, delay } from 'rxjs';
import { filterWithSearchString } from '../rxjs';
import { type LoadingState, beginLoading, errorResult, isLoadingStateWithError, isLoadingStateFinishedLoading, isLoadingStateWithDefinedValue, isLoadingStateLoading, successResult } from './loading.state';
import { combineLoadingStates, combineLoadingStatesStatus, distinctLoadingState, mapLoadingStateValueWithOperator } from './loading.state.rxjs';

jest.setTimeout(1000);

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

  describe('mapOnUndefined = true', () => {
    it('should not pass through the value when loading is undefined and value is undefined', (done) => {
      const expectedValue = 1;
      let mapAttempted = false;
      const values$ = new BehaviorSubject<LoadingState<string[] | undefined>>({ value: undefined }); // loading is not defined

      const obs = values$.pipe(
        mapLoadingStateValueWithOperator(
          map(() => {
            mapAttempted = true;
            return expectedValue;
          }),
          true
        )
      );

      obs.pipe(first()).subscribe((state) => {
        expect(mapAttempted).toBe(false);
        expect(isLoadingStateLoading(state)).toBe(true); // waiting for loading=false
        expect(state.value).toBeUndefined();
        done();
      });
    });

    it('should pass through the value when loading is false and value is undefined', (done) => {
      const expectedValue = 1;
      let mapAttempted = false;
      const values$ = new BehaviorSubject<LoadingState<string[] | undefined>>({ loading: false, value: undefined });

      const obs = values$.pipe(
        mapLoadingStateValueWithOperator(
          map(() => {
            mapAttempted = true;
            return expectedValue;
          }),
          true
        )
      );

      obs.pipe(first()).subscribe((state) => {
        expect(mapAttempted).toBe(true);
        expect(isLoadingStateLoading(state)).toBe(false); // finished
        expect(state.value).toBe(expectedValue);
        done();
      });
    });
  });

  it('should not pass through the value when loading is false and value is undefined', (done) => {
    let mapAttempted = false;
    const values$ = new BehaviorSubject<LoadingState<string[] | undefined>>({ value: undefined });

    const obs = values$.pipe(
      mapLoadingStateValueWithOperator(
        map(() => {
          mapAttempted = true;
          return undefined;
        })
      )
    );

    obs.pipe(first()).subscribe((state) => {
      expect(mapAttempted).toBe(false);
      expect(isLoadingStateLoading(state)).toBe(true);
      expect(state.value).toBe(undefined);
      done();
    });
  });

  it('should pass through an error when loading is false and value is undefined', (done) => {
    let mapAttempted = false;
    const error = new Error('test');
    const values$ = new BehaviorSubject<LoadingState<string[] | undefined>>({ error, value: undefined });

    const obs = values$.pipe(
      mapLoadingStateValueWithOperator(
        map(() => {
          mapAttempted = true;
          return undefined;
        })
      )
    );

    obs.pipe(first()).subscribe((state) => {
      expect(isLoadingStateLoading(state)).toBe(false);
      expect(state.value).toBe(undefined);
      expect(state.error).toBe(error);
      done();
    });
  });

  it('should return a loading state when the original loading state finishes with a value and when using an async operator that does not immediately return', (done) => {
    const expectedValues = ['aaa', 'aac'];
    const values = [...expectedValues, 'ddd', 'eee'];
    const values$ = new BehaviorSubject<LoadingState<string[]>>({ value: values });

    const obs = values$.pipe(mapLoadingStateValueWithOperator(switchMap(() => of('async value').pipe(delay(1000)))));

    obs.pipe(first()).subscribe((state) => {
      const { value } = state;

      expect(value).toBeUndefined();
      expect(isLoadingStateLoading(state)).toBe(true);

      done();
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

describe('combineLoadingStates()', () => {
  describe('two loading states', () => {
    it('should return a loading state that is loading.', (done) => {
      const a = of(beginLoading<object>());
      const b = of(beginLoading<object>());
      const obs = combineLoadingStates(a, b);

      obs.pipe(first()).subscribe((state) => {
        expect(isLoadingStateLoading(state)).toBe(true);
        done();
      });
    });
  });

  describe('more loading states', () => {
    it('should return a loading state that is loading.', (done) => {
      const a = of(beginLoading<object>());
      const b = of(beginLoading<object>());
      const c = of(beginLoading<object>());
      const d = of(beginLoading<object>());
      const e = of(beginLoading<object>());
      const obs = combineLoadingStates(a, b, c, d, e, () => 1);

      obs.pipe(first()).subscribe((state) => {
        expect(isLoadingStateLoading(state)).toBe(true);
        done();
      });
    });

    describe('encounters an error', () => {
      it('should return the first error if the error is not marked as loading..', (done) => {
        const expectedError = new Error();

        const a = of(beginLoading<object>());
        const b = of(errorResult<object>(expectedError));
        const c = of(beginLoading<object>());
        const d = of(beginLoading<object>());
        const e = of(beginLoading<object>());
        const obs = combineLoadingStates(a, b, c, d, e, () => 1);

        obs.pipe(first()).subscribe((state) => {
          expect(isLoadingStateLoading(state)).toBe(false);
          expect(isLoadingStateWithError(state)).toBe(true);
          expect(state.error?._error).toBe(expectedError);
          done();
        });
      });

      it('should return loading while states that have an error are still marked as loading.', (done) => {
        const expectedError = new Error();

        const a = of(beginLoading<object>());
        const b = of({ ...errorResult<object>(expectedError), loading: true });
        const c = of(beginLoading<object>());
        const d = of(beginLoading<object>());
        const e = of(beginLoading<object>());
        const obs = combineLoadingStates(a, b, c, d, e, () => 1);

        obs.pipe(first()).subscribe((state) => {
          expect(isLoadingStateLoading(state)).toBe(true);
          expect(isLoadingStateWithError(state)).toBe(true);
          expect(state.error?._error).toBe(expectedError);
          done();
        });
      });

      it('should return the error state from the results.', (done) => {
        const expectedError = new Error();

        const a = of(successResult({ a: true }));
        const b = of(errorResult<object>(expectedError));
        const c = of(successResult({ c: true }));
        const d = of(successResult({ d: true }));
        const e = of(successResult({ e: true }));
        const obs = combineLoadingStates(a, b, c, d, e, () => 1);

        obs.pipe(first()).subscribe((state) => {
          expect(isLoadingStateLoading(state)).toBe(false);
          expect(isLoadingStateWithError(state)).toBe(true);
          expect(state.error?._error).toBe(expectedError);
          done();
        });
      });
    });

    it('should merge each of the values together once finished loading using mergeObjects if a merge function is not provided.', (done) => {
      const a = of(successResult({ a: true }));
      const b = of(successResult({ b: true }));
      const c = of(successResult({ c: true }));
      const d = of(successResult({ d: true }));
      const e = of(successResult({ e: true }));

      const obs = combineLoadingStates(a, b, c, d, e);

      obs.pipe(first()).subscribe((state) => {
        expect(isLoadingStateLoading(state)).toBe(false);
        expect(state.loading).toBe(false);
        expect(state.error).toBeUndefined();
        expect(state.value?.a).toBe(true);
        expect(state.value?.b).toBe(true);
        expect(state.value?.c).toBe(true);
        expect(state.value?.d).toBe(true);
        expect(state.value?.e).toBe(true);
        done();
      });
    });

    it('should merge each of the values together once finished loading using mergeObjects if a merge function is not provided.', (done) => {
      const a = of(successResult({ a: true }));
      const b = of(successResult({ b: true }));
      const c = of(successResult({ c: true }));
      const d = of(successResult({ d: true }));
      const e = of(successResult({ e: true }));

      const expectedValue = 0;
      const obs = combineLoadingStates(a, b, c, d, e, (a, b, c, d, e) => {
        expect(a).toBeDefined();
        expect(a.a).toBe(true);
        expect(b).toBeDefined();
        expect(b.b).toBe(true);
        expect(c).toBeDefined();
        expect(c.c).toBe(true);
        expect(d).toBeDefined();
        expect(d.d).toBe(true);
        expect(e).toBeDefined();
        expect(e.e).toBe(true);
        return expectedValue;
      });

      obs.pipe(first()).subscribe((state) => {
        expect(isLoadingStateLoading(state)).toBe(false);
        expect(state.loading).toBe(false);
        expect(state.error).toBeUndefined();
        expect(state.value).toBe(expectedValue);
        done();
      });
    });
  });
});

describe('combineLoadingStatesStatus()', () => {
  describe('two loading states', () => {
    it('should return a loading state as success with true when all loading states are success', (done) => {
      const success = of(successResult(1));
      const success2 = of(successResult(2));

      const obs = combineLoadingStatesStatus([success, success2]);

      obs.pipe(first()).subscribe((x) => {
        expect(x.value).toBe(true);
        expect(isLoadingStateFinishedLoading(x)).toBe(true);
        expect(isLoadingStateWithDefinedValue(x)).toBe(true);
        done();
      });
    });

    it('should return a loading state as loading when one or more loading states are loading', (done) => {
      const loading = of(beginLoading());
      const success = of(successResult(1));
      const success2 = of(successResult(2));

      const obs = combineLoadingStatesStatus([loading, success, success2]);

      obs.pipe(first()).subscribe((x) => {
        expect(x.loading).toBe(true);
        expect(isLoadingStateLoading(x)).toBe(true);
        done();
      });
    });

    it('should return a loading state as success after all items have finished loading', (done) => {
      const state = new BehaviorSubject<LoadingState<number>>(beginLoading());
      const success = of(successResult(1));

      const obs = combineLoadingStatesStatus([state, success]);

      obs.subscribe((x) => {
        if (x.loading) {
          expect(isLoadingStateLoading(x)).toBe(true);
          state.next(successResult(1)); // trigger loading completion
        } else {
          expect(x.loading).toBe(false);
          expect(isLoadingStateLoading(x)).toBe(false);
          state.complete();
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

      obs.pipe(first()).subscribe((x) => {
        expect(x.error).toBeDefined();
        expect(x.error?._error).toBe(errorValue);
        expect(isLoadingStateWithError(x)).toBe(true);
        done();
      });
    });
  });

  describe('more loading states', () => {
    it('should return a loading state as success with true when all loading states are success', (done) => {
      const success = of(successResult(1));
      const success2 = of(successResult(2));
      const success3 = of(successResult(3));
      const success4 = of(successResult(4));
      const success5 = of(successResult(5));

      const obs = combineLoadingStatesStatus([success, success2, success3, success4, success5]);

      obs.pipe(first()).subscribe((x) => {
        expect(x.value).toBe(true);
        expect(isLoadingStateFinishedLoading(x)).toBe(true);
        expect(isLoadingStateWithDefinedValue(x)).toBe(true);
        done();
      });
    });
  });
});

describe('distinctLoadingState()', () => {
  describe('scenario', () => {
    describe('unique model keys', () => {
      let values$: BehaviorSubject<LoadingState<string[]>>;

      beforeEach(() => {
        values$ = new BehaviorSubject<LoadingState<string[]>>({ loading: true });
      });

      afterEach(() => {
        values$.complete();
      });

      describe('default', () => {
        it('should emit on loading changes and when the value changes', (done) => {
          const obs = values$.pipe(distinctLoadingState(objectKeysEqualityComparatorFunction((x) => x)));

          let counter = 0;

          obs.subscribe((state) => {
            const c = counter;
            counter += 1;

            const { value } = state;

            switch (c) {
              case 0:
                expect(value).toBeUndefined();
                values$.next({ value: ['a'] }); // pass a value
                break;
              case 1:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(false);
                values$.next({ loading: true }); // is loading again, retain the value by default
                break;
              case 2:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(true);
                values$.next({ value: ['b'] }); // loading changed
                break;
              case 3:
                expect(value).toBeDefined();
                expect(value).toContain('b');
                expect(isLoadingStateLoading(state)).toBe(false);
                done();
                break;
            }
          });
        });

        it('should emit the loading state changes with the existing value', (done) => {
          const obs = values$.pipe(distinctLoadingState(objectKeysEqualityComparatorFunction((x) => x)));

          let counter = 0;

          obs.subscribe((state) => {
            const c = counter;
            counter += 1;

            const { value } = state;

            switch (c) {
              case 0:
                expect(value).toBeUndefined();
                values$.next({ value: ['a'] }); // pass a value
                break;
              case 1:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(false);
                values$.next({ loading: true }); // is loading again, retain the value by default
                break;
              case 2:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(true);
                values$.next({ value: ['a'] }); // pass the same value again
                break;
              case 3:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(false);
                done();
                break;
            }
          });
        });

        it('should emit the existing value with a new error', (done) => {
          const obs = values$.pipe(distinctLoadingState(objectKeysEqualityComparatorFunction((x) => x)));

          let counter = 0;

          obs.subscribe((state) => {
            const c = counter;
            counter += 1;

            const { value } = state;

            switch (c) {
              case 0:
                expect(value).toBeUndefined();
                values$.next({ value: ['a'] }); // pass a value
                break;
              case 1:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(false);
                values$.next({ error: new Error() }); // is loading again, retain the value by default
                break;
              case 2:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(false);
                expect(isLoadingStateWithError(state)).toBe(true);
                values$.next({ loading: true }); // clear the error and begin loading again.
                break;
              case 3:
                expect(value).toBeDefined();
                expect(value).toContain('a'); // value should still be retained
                expect(isLoadingStateLoading(state)).toBe(true);
                done();
                break;
            }
          });
        });

        it('should clear existing value when null is passed as a value', (done) => {
          const obs = values$.pipe(distinctLoadingState(objectKeysEqualityComparatorFunction((x) => x)));

          let counter = 0;

          obs.subscribe((state) => {
            const c = counter;
            counter += 1;

            const { value } = state;

            switch (c) {
              case 0:
                expect(value).toBeUndefined();
                values$.next({ value: ['a'] }); // pass a value
                break;
              case 1:
                expect(value).toBeDefined();
                expect(value).toContain('a');
                expect(isLoadingStateLoading(state)).toBe(false);
                values$.next({ value: null }); // is loading again, retain the value by default
                break;
              case 2:
                expect(value).toBeNull();
                expect(isLoadingStateLoading(state)).toBe(false);
                values$.next({ loading: true }); // clear the error and begin loading again.
                break;
              case 3:
                expect(value).toBeNull();
                expect(isLoadingStateLoading(state)).toBe(true);
                done();
                break;
            }
          });
        });

        it('should not emit when the value is considered equivalent', (done) => {
          const obs = values$.pipe(distinctLoadingState(objectKeysEqualityComparatorFunction((x) => x)));

          let counter = 0;
          const endCounter = 10;

          const value = ['a', 'b', 'c'];

          obs.subscribe((state) => {
            const c = counter;

            switch (c) {
              case 0:
                expect(isLoadingStateLoading(state)).toBe(true);
                break;
              case 1:
                expect(isLoadingStateLoading(state)).toBe(false);
                expect(value).toBeDefined();
                break;
              default:
                expect(counter).toBe(endCounter);
                expect(isLoadingStateLoading(state)).toBe(true);
                done();
                break;
            }
          });

          for (let i = 0; i < endCounter; i += 1) {
            counter += 1;
            values$.next({ value }); // pass the same value
          }

          values$.next({ loading: true }); // pass final loading state
        });
      });
    });
  });
});
