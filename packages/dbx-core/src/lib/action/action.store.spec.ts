import { canReadyValue, ActionContextStore, ACTION_CONTEXT_STORE_LOCKSET_DESTROY_DELAY_TIME, loadingStateForActionContextState, type ActionContextState } from './action.store';
import { DbxActionState } from './action';
import { of, first, timeout, delay } from 'rxjs';
import { containsStringAnyCase } from '@dereekb/util';
import { isLoadingStateInErrorState, isLoadingStateInSuccessState, isLoadingStateWithDefinedValue, isLoadingStateInIdleState, LoadingStateType, SubscriptionObject } from '@dereekb/rxjs';
import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { callbackTest } from '@dereekb/util/test';
import { newWithInjector } from '../injection/injector';

function workingState(workProgress?: number | null): ActionContextState {
  return { actionState: DbxActionState.WORKING, isModified: false, workProgress };
}

describe('loadingStateForActionContextState()', () => {
  it('should include loadingProgress when workProgress is set', () => {
    const result = loadingStateForActionContextState(workingState(50));
    expect((result as { loadingProgress?: number }).loadingProgress).toBe(50);
  });

  it('should not include loadingProgress when workProgress is null', () => {
    const result = loadingStateForActionContextState(workingState(null));
    expect((result as { loadingProgress?: number }).loadingProgress).toBeUndefined();
  });

  it('should not include loadingProgress when workProgress is undefined', () => {
    const result = loadingStateForActionContextState(workingState());
    expect((result as { loadingProgress?: number }).loadingProgress).toBeUndefined();
  });
});

describe('ActionContextStore', () => {
  let contextStore: ActionContextStore;
  const cleanupSubscriptionObjectA = new SubscriptionObject();
  const cleanupSubscriptionObjectB = new SubscriptionObject();

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  beforeEach(() => {
    const rootInjector = TestBed.inject(Injector);
    contextStore = newWithInjector(ActionContextStore, rootInjector);

    // reset subscription context if still set
    cleanupSubscriptionObjectA.destroy();
    cleanupSubscriptionObjectB.destroy();
  });

  afterEach(() => {
    contextStore.ngOnDestroy();
    cleanupSubscriptionObjectA.destroy();
    cleanupSubscriptionObjectB.destroy();
    TestBed.resetTestingModule();
  });

  describe('trigger()', () => {
    it(
      'should set state to triggered on trigger()',
      callbackTest((done) => {
        contextStore.trigger();

        contextStore.triggered$.subscribe((x) => {
          expect(x).toBe(true);
          done();
        });
      })
    );
  });

  describe('readyValue()', () => {
    const READY_VALUE = 1;
    const TIMEOUT_VALUE = 'timeout';

    it(
      'should not ready a value if the current state cannot ready a value.',
      callbackTest((done) => {
        contextStore.state$.pipe(first()).subscribe((state) => {
          expect(canReadyValue(state)).toBe(false);

          contextStore.readyValue(READY_VALUE);

          cleanupSubscriptionObjectA.subscription = contextStore.valueReady$.pipe(timeout({ first: 100, with: () => of(TIMEOUT_VALUE) })).subscribe((x) => {
            expect(x).toBe(TIMEOUT_VALUE);
            done();
          });
        });
      })
    );

    it(
      'should allow a ready value if the current state can ready a value.',
      callbackTest((done) => {
        contextStore.trigger();
        contextStore.state$.pipe(first()).subscribe((state) => {
          expect(canReadyValue(state)).toBe(true);

          contextStore.readyValue(READY_VALUE);

          cleanupSubscriptionObjectA.subscription = contextStore.valueReady$.subscribe((x) => {
            expect(x).toBe(READY_VALUE);
            done();
          });
        });
      })
    );
  });

  describe('with disabled keys', () => {
    const disableKeyA = 'a';
    const disableKeyB = 'b';
    const allKeys = [disableKeyA, disableKeyB];

    beforeEach(() => {
      contextStore.disable(disableKeyA);
      contextStore.disable(disableKeyB);
    });

    it('should retain the disabled keys if resolve() is called', () => {
      contextStore.resolve('a');

      cleanupSubscriptionObjectA.subscription = contextStore.disabledKeys$.pipe(first()).subscribe((keys) => {
        expect(keys.length).toBe(allKeys.length);
        expect(containsStringAnyCase(keys, disableKeyA)).toBe(true);
        expect(containsStringAnyCase(keys, disableKeyB)).toBe(true);
      });
    });

    it('should retain the disabled keys if reject() is called', () => {
      contextStore.reject(undefined);

      cleanupSubscriptionObjectA.subscription = contextStore.disabledKeys$.pipe(first()).subscribe((keys) => {
        expect(keys.length).toBe(allKeys.length);
        expect(containsStringAnyCase(keys, disableKeyA)).toBe(true);
        expect(containsStringAnyCase(keys, disableKeyB)).toBe(true);
      });
    });
  });

  describe('loadingState', () => {
    it('should be an idle loading state after a reset.', () => {
      contextStore.reset();

      cleanupSubscriptionObjectA.subscription = contextStore.loadingState$.pipe(first()).subscribe((x) => {
        expect(isLoadingStateInIdleState(x)).toBe(true);
      });

      cleanupSubscriptionObjectB.subscription = contextStore.loadingStateType$.pipe(first()).subscribe((x) => {
        expect(x).toBe(LoadingStateType.IDLE);
      });
    });

    it('should be a success loading state after resolving..', () => {
      const value = 'result';
      contextStore.resolve(value);

      cleanupSubscriptionObjectA.subscription = contextStore.loadingState$.pipe(first()).subscribe((x) => {
        expect(isLoadingStateWithDefinedValue(x)).toBe(true);
        expect(isLoadingStateInSuccessState(x)).toBe(true);
        expect(x.value).toBe(value);
      });

      cleanupSubscriptionObjectB.subscription = contextStore.loadingStateType$.pipe(first()).subscribe((x) => {
        expect(x).toBe(LoadingStateType.SUCCESS);
      });
    });

    it('should be an error loading state after rejecting.', () => {
      contextStore.reject(undefined);

      cleanupSubscriptionObjectA.subscription = contextStore.loadingState$.pipe(first()).subscribe((x) => {
        expect(isLoadingStateInErrorState(x)).toBe(true);
      });

      cleanupSubscriptionObjectB.subscription = contextStore.loadingStateType$.pipe(first()).subscribe((x) => {
        expect(x).toBe(LoadingStateType.ERROR);
      });
    });
  });

  describe('lock set destruction', () => {
    it(
      'should not destroy the context while the action is working',
      callbackTest((done) => {
        let destroyed = false;

        cleanupSubscriptionObjectA.subscription = contextStore.lockSet.onDestroy$.subscribe(() => {
          destroyed = true;
        });

        // start working
        contextStore.startWorking();

        // now simulate the destroy event.
        // Don't call ngOnDestroy on the contextStore as it won't do anything. the lockSet watches for the NgInjection to destroy.
        contextStore.lockSet._cleanDestroy();

        contextStore.lockSet.isLocked$.pipe(first()).subscribe((isLocked) => {
          expect(isLocked).toBe(true);
          expect(contextStore.lockSet.isDestroyed).toBe(false);
          expect(destroyed).toBe(false);

          contextStore.resolve(undefined); // should resolve, stopping the working

          cleanupSubscriptionObjectB.subscription = contextStore.isWorking$.pipe(first()).subscribe((isWorking) => {
            expect(isWorking).toBe(false);

            // check the locked state again, should now be destroyed
            contextStore.lockSet.isLocked$.pipe(delay(ACTION_CONTEXT_STORE_LOCKSET_DESTROY_DELAY_TIME + 1000), first()).subscribe((isLocked) => {
              expect(isLocked).toBe(false);
              expect(destroyed).toBe(true);
              expect(contextStore.lockSet.isDestroyed).toBe(true);

              done();
            });
          });
        });
      })
    );
  });
});
