import { canReadyValue } from './action.store';
import { of } from 'rxjs';
import { first, timeoutWith } from 'rxjs/operators';
import { ActionContextStore } from './action.store';
import { containsStringAnyCase } from '@dereekb/util';
import { isErrorLoadingState, isSuccessLoadingState, loadingStateHasValue, loadingStateIsIdle, LoadingStateType } from '@dereekb/rxjs';

describe('ActionContextStore', () => {

  let contextStore: ActionContextStore;

  beforeEach(() => {
    contextStore = new ActionContextStore();
  });

  afterEach(() => {
    contextStore.ngOnDestroy();
  });

  describe('trigger()', () => {

    it('should set state to triggered on trigger()', (done) => {
      contextStore.trigger();

      contextStore.triggered$.subscribe((x) => {
        expect(x).toBe(true);
        done();
      });

    });

  });

  describe('readyValue()', () => {

    const READY_VALUE = 1;
    const TIMEOUT_VALUE = 'timeout';

    it('should not ready a value if the current state cannot ready a value.', (done) => {
      contextStore.state$.pipe(first()).subscribe((state) => {
        expect(canReadyValue(state)).toBe(false);

        contextStore.readyValue(READY_VALUE);

        contextStore.valueReady$.pipe(timeoutWith(100, of(TIMEOUT_VALUE))).subscribe((x) => {
          expect(x).toBe(TIMEOUT_VALUE);
          done();
        });
      });
    });

    it('should allow a ready value if the current state can ready a value.', (done) => {
      contextStore.trigger();
      contextStore.state$.pipe(first()).subscribe((state) => {
        expect(canReadyValue(state)).toBe(true);

        contextStore.readyValue(READY_VALUE);

        contextStore.valueReady$.subscribe((x) => {
          expect(x).toBe(READY_VALUE);
          done();
        });
      });
    });

  });

  describe('with disabled keys', () => {

    const disableKeyA = 'a';
    const disableKeyB = 'b';
    const allKeys = [disableKeyA, disableKeyB];

    beforeEach(() => {
      contextStore.disable(disableKeyA);
      contextStore.disable(disableKeyB);
    })

    it('should retain the disabled keys if resolve() is called', () => {
      contextStore.resolve('a');

      contextStore.disabledKeys$.pipe(first()).subscribe((keys) => {
        expect(keys.length).toBe(allKeys.length);
        expect(containsStringAnyCase(keys, disableKeyA)).toBe(true);
        expect(containsStringAnyCase(keys, disableKeyB)).toBe(true);
      });
    });

    it('should retain the disabled keys if reject() is called', () => {
      contextStore.reject(undefined);

      contextStore.disabledKeys$.pipe(first()).subscribe((keys) => {
        expect(keys.length).toBe(allKeys.length);
        expect(containsStringAnyCase(keys, disableKeyA)).toBe(true);
        expect(containsStringAnyCase(keys, disableKeyB)).toBe(true);
      });
    });

  });

  describe('loadingState', () => {

    it('should be an idle loading state after a reset.', () => {
      contextStore.reset();

      contextStore.loadingState$.pipe(first()).subscribe((x) => {
        expect(loadingStateIsIdle(x)).toBe(true);
      });

      contextStore.loadingStateType$.pipe(first()).subscribe((x) => {
        expect(x).toBe(LoadingStateType.IDLE);
      });

    });

    it('should be a success loading state after resolving..', () => {
      const value = 'result';
      contextStore.resolve(value);

      contextStore.loadingState$.pipe(first()).subscribe((x) => {
        expect(loadingStateHasValue(x)).toBe(true);
        expect(isSuccessLoadingState(x)).toBe(true);
        expect(x.value).toBe(value);
      });

      contextStore.loadingStateType$.pipe(first()).subscribe((x) => {
        expect(x).toBe(LoadingStateType.SUCCESS);
      });

    });

    it('should be an error loading state after rejecting.', () => {
      contextStore.reject(undefined);

      contextStore.loadingState$.pipe(first()).subscribe((x) => {
        expect(isErrorLoadingState(x)).toBe(true);
      });

      contextStore.loadingStateType$.pipe(first()).subscribe((x) => {
        expect(x).toBe(LoadingStateType.ERROR);
      });

    });

  });

  // TODO: Add other tests.

});
