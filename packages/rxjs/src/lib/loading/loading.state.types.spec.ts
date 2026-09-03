import { describe, expectTypeOf, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { map, type Observable } from 'rxjs';
import { arrayValueFromFinishedLoadingState } from './loading.state.list';
import { beginLoading, errorResult, successPageResult, idleLoadingState, isLoadingStateWithDefinedValue, isLoadingStateWithError, isLoadingStateFinishedLoadingWithDefinedValue, isLoadingStateFinishedLoadingWithError, isPageLoadingState, loadingStateHasNextPage, loadingStateValue, loadingStateWithValueType, mergeLoadingStatesArray, type ListLoadingState, type LoadingState, type LoadingStateValue, type LoadingStateWithValueType, type PageLoadingState } from './loading.state';
import { catchLoadingStateErrorWithOperator, currentValueFromLoadingState, distinctLoadingState, mapLoadingState, mapLoadingStateValueWithOperator, startWithBeginLoading, tapOnLoadingStateSuccess, valueFromFinishedLoadingState, valueFromLoadingState } from './loading.state.rxjs';

/**
 * Type-level assertions for the LoadingState generics.
 *
 * These pin the two failure modes that compile and pass at runtime, and so are invisible to every
 * other spec in this package: an operator silently widening the value type to `unknown`, and a
 * shape-preserving operator dropping the input state's `page` key.
 */

interface TestItem {
  readonly id: string;
}

interface TestData {
  readonly data: TestItem[];
}

declare const pageState$: Observable<PageLoadingState<TestData>>;
declare const listState$: Observable<ListLoadingState<TestItem>>;
declare const maybePageState: Maybe<PageLoadingState<TestData>>;
declare const pageState: PageLoadingState<TestData>;
declare const maybeState: Maybe<LoadingState<TestData>>;

describe('LoadingState typings', () => {
  describe('family 1 (value-out)', () => {
    it('should infer the value type from the source without a type argument', () => {
      expectTypeOf(pageState$.pipe(currentValueFromLoadingState())).toEqualTypeOf<Observable<Maybe<TestData>>>();
      expectTypeOf(pageState$.pipe(valueFromLoadingState())).toEqualTypeOf<Observable<TestData>>();
      expectTypeOf(pageState$.pipe(valueFromFinishedLoadingState())).toEqualTypeOf<Observable<Maybe<TestData>>>();
    });

    it('should not let a default value poison the inferred value type', () => {
      // Without NoInfer on the default, `() => []` infers T = never[] and rejects the real stream.
      expectTypeOf(listState$.pipe(valueFromFinishedLoadingState(() => []))).toEqualTypeOf<Observable<TestItem[]>>();
      expectTypeOf(listState$.pipe(arrayValueFromFinishedLoadingState())).toEqualTypeOf<Observable<TestItem[]>>();
    });
  });

  describe('family 2 (shape-preserving, value derived)', () => {
    it('should preserve the source state type through mono-type operators', () => {
      expectTypeOf(pageState$.pipe(startWithBeginLoading())).toEqualTypeOf<Observable<PageLoadingState<TestData>>>();
      expectTypeOf(pageState$.pipe(startWithBeginLoading({ page: 1 }))).toEqualTypeOf<Observable<PageLoadingState<TestData>>>();
      expectTypeOf(pageState$.pipe(tapOnLoadingStateSuccess((x) => x.value))).toEqualTypeOf<Observable<PageLoadingState<TestData>>>();
      expectTypeOf(pageState$.pipe(distinctLoadingState((a, b) => a === b))).toEqualTypeOf<Observable<PageLoadingState<TestData>>>();
      // `catchLoadingStateErrorWithOperator`'s operator mentions `L` directly; without NoInfer this
      // infers `L` from the replacement state instead of from the stream, and stops compiling.
      expectTypeOf(pageState$.pipe(catchLoadingStateErrorWithOperator(map(() => successPageResult(0, { data: [] }))))).toEqualTypeOf<Observable<PageLoadingState<TestData>>>();
    });

    it('should type a tapped state as the full source state', () => {
      pageState$.pipe(
        tapOnLoadingStateSuccess((state) => {
          expectTypeOf(state).toEqualTypeOf<PageLoadingState<TestData>>();
          expectTypeOf(state.value).toEqualTypeOf<Maybe<TestData>>();
        })
      );
    });
  });

  describe('type guards', () => {
    it('should intersect the narrowed value/error type with the input state, keeping page', () => {
      if (isLoadingStateWithDefinedValue(maybePageState)) {
        expectTypeOf(maybePageState.value).toEqualTypeOf<TestData>();
        expectTypeOf(maybePageState.page).toEqualTypeOf<number>();
      }

      if (isLoadingStateFinishedLoadingWithDefinedValue(maybePageState)) {
        expectTypeOf(maybePageState.value).toEqualTypeOf<TestData>();
        expectTypeOf(maybePageState.page).toEqualTypeOf<number>();
      }

      if (isLoadingStateWithError(maybePageState)) {
        expectTypeOf(maybePageState.page).toEqualTypeOf<number>();
      }

      if (isLoadingStateFinishedLoadingWithError(maybePageState)) {
        expectTypeOf(maybePageState.page).toEqualTypeOf<number>();
      }
    });

    it('should narrow a plain loading state to a page state', () => {
      if (isPageLoadingState(maybeState)) {
        expectTypeOf(maybeState.page).toEqualTypeOf<number>();
      }
    });
  });

  describe('family 3 (shape-preserving, value transformed)', () => {
    it('should infer the mapped value from an unannotated mapValue and keep the page key', () => {
      const mapped$ = pageState$.pipe(mapLoadingState({ mapValue: (x) => x.data }));

      expectTypeOf(mapped$).toEqualTypeOf<Observable<LoadingStateWithValueType<PageLoadingState<TestData>, TestItem[]>>>();
      expectTypeOf(mapped$).toExtend<Observable<PageLoadingState<TestItem[]>>>();
    });

    it("should pass the full source state as mapValue's second argument", () => {
      pageState$.pipe(
        mapLoadingState({
          mapValue: (value, state) => {
            expectTypeOf(value).toEqualTypeOf<TestData>();
            expectTypeOf(state).toEqualTypeOf<PageLoadingState<TestData>>();
            return value.data;
          }
        })
      );
    });

    it('should keep the page key when mapping the value through an operator', () => {
      const mapped$ = pageState$.pipe(mapLoadingStateValueWithOperator<PageLoadingState<TestData>, TestItem[]>(map((x) => x.data)));
      expectTypeOf(mapped$).toExtend<Observable<PageLoadingState<TestItem[]>>>();
    });
  });

  describe('accessors', () => {
    it('should read the value and hasNextPage without widening to unknown', () => {
      expectTypeOf(loadingStateValue(pageState)).toEqualTypeOf<Maybe<TestData>>();
      expectTypeOf(loadingStateHasNextPage(pageState)).toEqualTypeOf<Maybe<boolean>>();
      expectTypeOf(loadingStateWithValueType(pageState, [] as TestItem[])).toExtend<PageLoadingState<TestItem[]>>();
    });

    it('should infer the merged value type from a non-variadic merge', () => {
      expectTypeOf(mergeLoadingStatesArray([], (a: TestData) => a.data)).toEqualTypeOf<LoadingState<TestItem[]>>();
    });
  });

  describe('constructors', () => {
    it('should default to never so a bare constructor is assignable into any loading state', () => {
      expectTypeOf(beginLoading()).toEqualTypeOf<LoadingState<never>>();
      expectTypeOf(idleLoadingState()).toEqualTypeOf<LoadingState<never>>();
      expectTypeOf<LoadingState<never>>().toExtend<LoadingState<TestData>>();
      expectTypeOf(beginLoading({ page: 1 })).toEqualTypeOf<PageLoadingState<never>>();
      expectTypeOf(errorResult(new Error())).toExtend<LoadingState<never>>();
    });
  });

  describe('LoadingStateValue', () => {
    it('should resolve the state value type', () => {
      expectTypeOf<LoadingStateValue<PageLoadingState<TestData>>>().toEqualTypeOf<TestData>();
      expectTypeOf<LoadingStateValue<ListLoadingState<TestItem>>>().toEqualTypeOf<TestItem[]>();
    });
  });
});
