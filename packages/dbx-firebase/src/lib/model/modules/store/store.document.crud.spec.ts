import { describe, expect, it } from 'vitest';
import { type Observable, lastValueFrom, of, toArray } from 'rxjs';
import { type FirebaseFunction, type OnCallCreateModelResult, type TargetModelParams } from '@dereekb/firebase';
import { isLoadingStateLoading, type LoadingState } from '@dereekb/rxjs';
import { type DbxFirebaseDocumentStore } from './store';
import { firebaseDocumentStoreCreateFunction, firebaseDocumentStoreCrudFunction, firebaseDocumentStoreDeleteFunction, firebaseDocumentStoreUpdateFunction } from './store.document.crud';

/**
 * Longer than the 50ms loadingStateFromObs() waits before it emits a loading state and subscribes to its source again.
 */
const SLOW_FUNCTION_DELAY_MS = 100;

/**
 * Creates a function that resolves with the result after SLOW_FUNCTION_DELAY_MS and counts how many times it is called.
 *
 * @param result - The value the function resolves with.
 * @returns The function and its call counter.
 */
function slowCountedFunction<I, O>(result: O) {
  const counter = { calls: 0 };
  const fn: FirebaseFunction<I, O> = () => {
    counter.calls += 1;
    return new Promise<O>((resolve) => setTimeout(() => resolve(result), SLOW_FUNCTION_DELAY_MS));
  };

  return { counter, fn };
}

function loadingStatesFrom<O>(obs: Observable<LoadingState<O>>): Promise<LoadingState<O>[]> {
  return lastValueFrom(obs.pipe(toArray()));
}

const store = { key$: of('mockItem/a'), setKey: () => undefined, clearRefs: () => undefined } as unknown as DbxFirebaseDocumentStore<any, any>;

describe('firebaseDocumentStoreCreateFunction()', () => {
  it('should call the function once when it takes longer than 50ms', async () => {
    const { counter, fn } = slowCountedFunction<object, OnCallCreateModelResult>({ modelKeys: ['mockItem/a'] });
    const states = await loadingStatesFrom(firebaseDocumentStoreCreateFunction(store, fn)({}));

    expect(isLoadingStateLoading(states[0])).toBe(true);
    expect(counter.calls).toBe(1);
  });
});

describe('firebaseDocumentStoreCrudFunction()', () => {
  it('should call the function once when it takes longer than 50ms', async () => {
    const { counter, fn } = slowCountedFunction<object, void>(undefined);
    const states = await loadingStatesFrom(firebaseDocumentStoreCrudFunction(fn)({}));

    expect(isLoadingStateLoading(states[0])).toBe(true);
    expect(counter.calls).toBe(1);
  });
});

describe('firebaseDocumentStoreUpdateFunction()', () => {
  it('should call the function once when it takes longer than 50ms', async () => {
    const { counter, fn } = slowCountedFunction<TargetModelParams, void>(undefined);
    const states = await loadingStatesFrom(firebaseDocumentStoreUpdateFunction(store, fn)({}));

    expect(isLoadingStateLoading(states[0])).toBe(true);
    expect(counter.calls).toBe(1);
  });

  it('should call onResult once when the function takes longer than 50ms', async () => {
    const { fn } = slowCountedFunction<TargetModelParams, void>(undefined);
    let onResultCalls = 0;
    await loadingStatesFrom(firebaseDocumentStoreUpdateFunction(store, fn, { onResult: () => (onResultCalls += 1) })({}));

    expect(onResultCalls).toBe(1);
  });
});

describe('firebaseDocumentStoreDeleteFunction()', () => {
  it('should call the function once when it takes longer than 50ms', async () => {
    const { counter, fn } = slowCountedFunction<TargetModelParams, void>(undefined);
    const states = await loadingStatesFrom(firebaseDocumentStoreDeleteFunction(store, fn)({}));

    expect(isLoadingStateLoading(states[0])).toBe(true);
    expect(counter.calls).toBe(1);
  });
});
