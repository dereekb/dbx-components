import { Injectable, type OnDestroy } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type Observable, distinctUntilChanged, filter, map, shareReplay, switchMap, startWith, of } from 'rxjs';
import { type BooleanStringKeyArray, BooleanStringKeyArrayUtility, type Maybe, type ReadableError } from '@dereekb/util';
import { type LoadingStateType, idleLoadingState, errorResult, filterMaybe, type LoadingState, scanCount, successResult, beginLoading } from '@dereekb/rxjs';
import { type DbxActionDisabledKey, type DbxActionRejectedPair, DbxActionState, type DbxActionSuccessPair, type DbxActionWorkOrWorkProgress, type DbxActionWorkProgress, DEFAULT_ACTION_DISABLED_KEY, isIdleActionState, loadingStateTypeForActionState } from './action';
import { cleanLockSet } from '../rxjs';

/**
 * Checks whether the action context is enabled (not disabled by any key).
 *
 * @param state - The current action context state to check.
 * @returns `true` if no disabled keys are active.
 */
export function isActionContextEnabled(state: ActionContextState): boolean {
  return BooleanStringKeyArrayUtility.isFalse(state.disabled);
}

/**
 * Checks whether the action context is disabled by at least one disabled key.
 *
 * @param state - The current action context state to check.
 * @returns `true` if any disabled keys are active.
 */
export function isActionContextDisabled(state: ActionContextState): boolean {
  return BooleanStringKeyArrayUtility.isTrue(state.disabled);
}

/**
 * Checks whether the action context state represents an effectively disabled state.
 *
 * An action is considered disabled when it is both idle (not in-progress) and has
 * at least one active disabled key.
 *
 * @param state - The current action context state to check.
 * @returns `true` if the action is idle and disabled.
 */
export function isDisabledActionContextState(state: ActionContextState): boolean {
  return isIdleActionState(state.actionState) && isActionContextDisabled(state);
}

/**
 * Checks whether the given action state represents an in-progress (non-idle) state.
 *
 * This is the inverse of {@link isIdleActionState}. Returns `true` for TRIGGERED, VALUE_READY, and WORKING states.
 *
 * @param actionState - The action state to check.
 * @returns `true` if the action is in any non-idle state.
 */
export function isWorkingActionState(actionState: DbxActionState): boolean {
  return !isIdleActionState(actionState);
}

/**
 * Determines whether the action state allows triggering.
 *
 * An action can be triggered when it is idle (but not DISABLED specifically) and
 * not already in-progress.
 *
 * @param actionState - The action state to check.
 * @returns `true` if the action can be triggered from this state.
 */
export function canTriggerActionState(actionState: DbxActionState): boolean {
  return actionState !== DbxActionState.DISABLED && isIdleActionState(actionState);
}

/**
 * Determines whether the action can be triggered based on the full context state.
 *
 * Requires the action to be both enabled (no disabled keys) and in an idle action state.
 *
 * @param state - The current action context state to check.
 * @returns `true` if the action can be triggered.
 */
export function canTriggerAction(state: ActionContextState): boolean {
  return isActionContextEnabled(state) && isIdleActionState(state.actionState);
}

/**
 * Determines whether a value can be readied for the action.
 *
 * A value can only be readied when the action is in the TRIGGERED state,
 * which means the trigger has been activated and the system is waiting for a value.
 *
 * @param state - The current action context state to check.
 * @returns `true` if the action is in the TRIGGERED state.
 */
export function canReadyValue(state: ActionContextState): boolean {
  return state.actionState === DbxActionState.TRIGGERED;
}

/**
 * Checks whether the action context is both modified and ready to be triggered.
 *
 * This is commonly used by auto-trigger directives to determine when to fire automatically.
 *
 * @param state - The current action context state to check.
 * @returns `true` if the action is modified and can be triggered.
 */
export function actionContextIsModifiedAndCanTrigger(state: ActionContextState): boolean {
  // console.log('check: ', state, state.isModified, canTriggerAction(state));
  return state.isModified && canTriggerAction(state);
}

/**
 * Checks whether the action context has no error, is modified, and can be triggered.
 *
 * A stricter variant of {@link actionContextIsModifiedAndCanTrigger} that also requires
 * no error to be present in the current state.
 *
 * @param state - The current action context state to check.
 * @returns `true` if no error exists and the action is modified and triggerable.
 */
export function actionContextHasNoErrorAndIsModifiedAndCanTrigger(state: ActionContextState): boolean {
  return !state.error && actionContextIsModifiedAndCanTrigger(state);
}

/**
 * Converts an {@link ActionContextState} to a {@link LoadingState} for UI consumption.
 *
 * Maps the action lifecycle states to loading state equivalents:
 * - RESOLVED -> success result with the output value
 * - REJECTED -> error result with the error
 * - IDLE/DISABLED -> idle loading state
 * - All other states -> loading (with optional work progress)
 *
 * @typeParam O - The output result type.
 * @param state - The action context state to convert.
 * @returns A loading state representation of the action context state.
 */
export function loadingStateForActionContextState<O = unknown>(state: ActionContextState<unknown, O>): LoadingState<O> {
  let loadingState: LoadingState<O>;

  switch (state.actionState) {
    case DbxActionState.RESOLVED:
      loadingState = successResult(state.result);
      break;
    case DbxActionState.REJECTED:
      loadingState = errorResult(state.error);
      break;
    case DbxActionState.IDLE:
    case DbxActionState.DISABLED:
      loadingState = idleLoadingState();
      break;
    default:
      loadingState = beginLoading(state.workProgress != null ? { loadingProgress: state.workProgress } : undefined);
      break;
  }

  return loadingState;
}

/**
 * Extracts the {@link LoadingStateType} from the current action context state.
 *
 * A convenience wrapper around {@link loadingStateTypeForActionState} that accepts the full context state.
 *
 * @param state - The action context state to convert.
 * @returns The corresponding loading state type.
 */
export function loadingStateTypeForActionContextState(state: ActionContextState): LoadingStateType {
  return loadingStateTypeForActionState(state.actionState);
}

/**
 * Immutable snapshot of the entire action context state at a given point in time.
 *
 * This is the core state shape managed by {@link ActionContextStore}. It captures:
 * - The current lifecycle phase ({@link DbxActionState})
 * - Whether the source data has been modified
 * - The input value (set after trigger), the output result (set on success), and any error (set on rejection)
 * - The disabled state (a set of keys that each independently control disabling)
 * - Optional work progress for long-running actions
 *
 * @typeParam T - The input value type provided to the action after triggering.
 * @typeParam O - The output result type produced on successful resolution.
 */
export interface ActionContextState<T = unknown, O = unknown> {
  readonly actionState: DbxActionState;
  /**
   * Whether or not this action is flagged as having been modified.
   */
  readonly isModified: boolean;
  /**
   * The working progress of the action.
   *
   * Is reset to null when triggered/ready value is set.
   */
  readonly workProgress?: Maybe<DbxActionWorkProgress>;
  /**
   * Value that is set after a triggered action. Not to be confused with result.
   */
  readonly value?: Maybe<T>;
  /**
   * Resolved result value.
   */
  readonly result?: Maybe<O>;
  /**
   * Rejected error, if available.
   */
  readonly error?: Maybe<ReadableError>;
  /**
   * Current disabled state.
   */
  readonly disabled?: BooleanStringKeyArray;
  /**
   * Number of consecutive errors that have occured.
   */
  readonly errorCount?: number;
}

const INITIAL_STATE: ActionContextState = {
  isModified: false,
  actionState: DbxActionState.IDLE
};

/**
 * Delay in milliseconds before the lock set destroys the store after all locks are released.
 * Provides a grace period for actions to finalize before the store is torn down.
 */
export const ACTION_CONTEXT_STORE_LOCKSET_DESTROY_DELAY_TIME = 2000;

/**
 * NgRx ComponentStore that manages the reactive state machine for a single action lifecycle.
 *
 * This is the central state container for the action system. It tracks the full lifecycle
 * of an action from idle through trigger, value preparation, work execution, and resolution
 * or rejection. Multiple selectors expose derived reactive streams for each phase.
 *
 * The store uses a {@link LockSet} for cleanup coordination: it delays its own destruction
 * until all in-flight work completes (e.g., a working action finishes), preventing
 * premature teardown of subscriptions.
 *
 * State transitions follow this flow:
 * ```
 * IDLE/DISABLED -> TRIGGERED -> VALUE_READY -> WORKING -> RESOLVED | REJECTED
 * ```
 *
 * @typeParam T - The input value type provided after triggering.
 * @typeParam O - The output result type produced on resolution.
 *
 * @see {@link ActionContextStoreSource} for providing store access to directives.
 * @see {@link DbxActionContextStoreSourceInstance} for the convenience wrapper.
 */
@Injectable()
export class ActionContextStore<T = unknown, O = unknown> extends ComponentStore<ActionContextState<T, O>> implements OnDestroy {
  readonly lockSet = cleanLockSet({
    onLockSetDestroy: () => super.ngOnDestroy(),
    destroyLocksetTiming: {
      delayTime: ACTION_CONTEXT_STORE_LOCKSET_DESTROY_DELAY_TIME
    }
  });

  constructor() {
    super({ ...INITIAL_STATE } as ActionContextState<T, O>);
    this.lockSet.addLock('working', this.isWorking$);
  }

  // MARK: Accessors
  readonly actionState$ = this.state$.pipe(
    map((x) => (isDisabledActionContextState(x) ? DbxActionState.DISABLED : x.actionState)),
    shareReplay(1)
  );

  /**
   * Returns the current disabled reasons/keys.
   */
  readonly disabledKeys$ = this.state$.pipe(
    map((x) => [...(x.disabled ?? [])]),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Current value of the state.
   */
  readonly currentValue$: Observable<Maybe<T>> = this.state$.pipe(map((x) => x.value));

  /**
   * Maps the current state to true or not when the action state changes to/from disabled.
   */
  readonly isDisabled$ = this.state$.pipe(map(isDisabledActionContextState), distinctUntilChanged(), shareReplay(1));

  /**
   * Pipes when idle but modified.
   */
  readonly isModified$ = this.afterDistinctBoolean((x) => x.isModified);

  /**
   * Pipes true when idle.
   */
  readonly idle$ = this.actionState$.pipe(
    map((x) => x === DbxActionState.IDLE),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Pipes true when triggered.
   */
  readonly triggered$ = this.afterDistinctActionState(DbxActionState.TRIGGERED, () => true);

  /**
   * Pipes the readied value on ValueReady.
   */
  readonly valueReady$: Observable<T> = this.afterDistinctActionState(DbxActionState.VALUE_READY, (x) => x.value as T);

  /**
   * Pipes the working progress on the working state.
   */
  readonly workProgress$ = this.state$.pipe(
    map((x) => x.workProgress),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Pipes the error on the rejection state.
   */
  readonly rejected$ = this.afterDistinctActionState(DbxActionState.REJECTED, (x) => x.error);

  /**
   * Pipes the result when the ActionState becomes rejected.
   */
  readonly rejectedPair$ = this.afterDistinctActionState(DbxActionState.RESOLVED, (x) => ({ value: x.value, error: x.error }) as DbxActionRejectedPair<T>);

  /**
   * Pipes the result when the ActionState becomes working.
   */
  readonly working$ = this.afterDistinctActionState(DbxActionState.WORKING, () => true);

  /**
   * Whether or not it is currently in a working state.
   */
  readonly isWorking$ = this.afterDistinctBoolean((x) => isWorkingActionState(x.actionState));

  /**
   * Pipes the current work or work progress.
   */
  readonly isWorkingOrWorkProgress$ = this.isWorking$.pipe(
    switchMap((x) => {
      let obs: Observable<DbxActionWorkOrWorkProgress>;

      if (x) {
        obs = this.workProgress$.pipe(
          filter((x) => x != null),
          startWith(x)
        );
      } else {
        obs = of(x);
      }

      return obs;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Pipes the current error.
   */
  readonly error$ = this.state$.pipe(
    map((x) => x.error),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Pipes the result when the ActionState becomes success.
   */
  readonly success$ = this.afterDistinctActionState(DbxActionState.RESOLVED, (x) => x.result);

  /**
   * Pipes the result when the ActionState becomes success.
   */
  readonly successPair$ = this.afterDistinctActionState(DbxActionState.RESOLVED, (x) => ({ value: x.value, result: x.result }) as DbxActionSuccessPair<T, O>);

  /**
   * Whether or not it is currently in a success state.
   */
  readonly isSuccess$ = this.afterDistinctBoolean((x) => x.actionState === DbxActionState.RESOLVED);

  /**
   * Returns a loading state based on the current state.
   */
  readonly loadingState$ = this.afterDistinctLoadingStateTypeChange().pipe(
    switchMap((x) => {
      const base = loadingStateForActionContextState<O>(x);
      let obs: Observable<LoadingState<O>>;

      if (base.loading === true) {
        obs = this.workProgress$.pipe(
          filter((x) => x != null),
          map((loadingProgress) => ({ ...base, loadingProgress })),
          startWith(base)
        );
      } else {
        obs = of(base);
      }

      return obs;
    }),
    shareReplay(1)
  );

  /**
   * Returns the current LoadingStateType based on the current state.
   */
  readonly loadingStateType$ = this.state$.pipe(
    map((x) => loadingStateTypeForActionContextState(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Number of errors since last success.
   */
  readonly errorCountSinceLastSuccess$ = this.isSuccess$.pipe(
    startWith(false),
    distinctUntilChanged(),
    switchMap(() => this.error$.pipe(filterMaybe(), scanCount(), startWith(0))),
    shareReplay(1)
  );

  /**
   * Whether or not the state can be triggered.
   */
  readonly canTrigger$ = this.state$.pipe(map(canTriggerAction), distinctUntilChanged(), shareReplay(1));

  /**
   * Pipe that maps whether or not this is modified and can be triggered.
   *
   * Updates every state update instead of when the value changes.
   */
  readonly isModifiedAndCanTriggerUpdates$ = this.state$.pipe(map((x) => actionContextIsModifiedAndCanTrigger(x), shareReplay(1)));

  /**
   * Whether or not it can be triggered and modified.
   */
  readonly isModifiedAndCanTrigger$ = this.isModifiedAndCanTriggerUpdates$.pipe(distinctUntilChanged());

  readonly hasNoErrorAndIsModifiedAndCanTrigger$ = this.state$.pipe(
    map((x) => actionContextHasNoErrorAndIsModifiedAndCanTrigger(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  /**
   * Adds a disabled reason.
   */
  readonly disable = this.updater((state, key?: void | DbxActionDisabledKey) => ({
    ...state,
    disabled: BooleanStringKeyArrayUtility.insert(state.disabled, (key as string) ?? DEFAULT_ACTION_DISABLED_KEY)
  }));

  /**
   * Removes a disabled reason.
   */
  readonly enable = this.updater((state, key?: void | DbxActionDisabledKey) => ({
    ...state,
    disabled: BooleanStringKeyArrayUtility.remove(state.disabled, (key as string) ?? DEFAULT_ACTION_DISABLED_KEY)
  }));

  /**
   * Triggers the modified state, if not disabled.
   *
   * Equivalent to calling setIsModified() with opposite input.
   */
  readonly setIsSame = this.updater<void, void | boolean>(updateIsSameOnActionContextState);

  /**
   * Triggers the modified state, if not disabled.
   */
  readonly setIsModified = this.updater<void, void | boolean>(updateIsModifiedOnActionContextState);

  /**
   * Triggers the action if the state is currently not idle. The current state is cleared, but the error is retained (as we may need the error from the previous attempt).
   *
   * Will not fire if the action is disabled.
   */
  readonly trigger = this.updater((state) => (canTriggerAction(state) ? { isModified: state.isModified, actionState: DbxActionState.TRIGGERED, error: state.error, value: undefined } : state));

  /**
   * Updates the value, setting value ready. The current result is cleared.
   */
  readonly readyValue = this.updater((state, value: T) => (canReadyValue(state) ? { ...state, actionState: DbxActionState.VALUE_READY, value, result: undefined } : state));

  /**
   * Notifys the context that the action is in progress.
   */
  readonly startWorking = this.updater((state) => ({ ...state, actionState: DbxActionState.WORKING, workProgress: null }));

  /**
   * Updates the working progress.
   */
  readonly setWorkProgress = this.updater((state, workProgress: Maybe<DbxActionWorkProgress>) => ({ ...state, workProgress }));

  /**
   * Triggers rejection of the action. The value is cleared.
   */
  readonly reject = this.updater((state, error?: Maybe<ReadableError>) => ({
    isModified: state.isModified,
    actionState: DbxActionState.REJECTED,
    error,
    errorCount: (state.errorCount ?? 0) + 1,
    disabled: state.disabled
  }));

  /**
   * Updates the state to success, and optionally sets a result.
   *
   * Clears modified state, and any errors.
   */
  readonly resolve = this.updater((state, result?: Maybe<O>) => ({ isModified: false, actionState: DbxActionState.RESOLVED, value: state.value, result, error: undefined, disabled: state.disabled }));

  /**
   * Completely resets the store.
   */
  readonly reset = this.updater(() => ({ ...INITIAL_STATE }) as ActionContextState<T, O>);

  // MARK: Utility
  afterDistinctBoolean(fromState: (state: ActionContextState<T, O>) => boolean): Observable<boolean> {
    return this.state$.pipe(
      map((x) => fromState(x)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  afterDistinctActionState<X>(actionState: DbxActionState, fromState: (state: ActionContextState<T, O>) => X): Observable<X> {
    return this.afterDistinctActionStateChange().pipe(
      filter((x) => x.actionState === actionState), // Only pipe when the new action state matches.
      map((x) => fromState(x)),
      shareReplay(1)
    );
  }

  afterDistinctActionStateChange(): Observable<ActionContextState<T, O>> {
    return this.state$.pipe(
      map((x) => [x, x.actionState] as [ActionContextState, DbxActionState]),
      distinctUntilChanged((a, b) => a?.[1] === b?.[1]), // Filter out when the state remains the same.
      map((x) => x[0] as ActionContextState<T, O>),
      shareReplay(1)
    );
  }

  afterDistinctLoadingStateTypeChange(): Observable<ActionContextState<T, O>> {
    return this.state$.pipe(
      map((x) => [x, loadingStateTypeForActionContextState(x)] as [ActionContextState, LoadingStateType]),
      distinctUntilChanged((a, b) => a?.[1] === b?.[1]), // Filter out when the loading state remains the same.
      map((x) => x[0] as ActionContextState<T, O>),
      shareReplay(1)
    );
  }

  // MARK: Cleanup
  override ngOnDestroy(): void {
    // do not call super.destroy here, to keep the component store from destroying itself.
    // the lockset is configured to cleanup the component store.
  }
}

function updateIsSameOnActionContextState<T, O>(state: ActionContextState<T, O>, isSame?: void | boolean): ActionContextState<T, O> {
  return updateIsModifiedOnActionContextState(state, isSame == null ? false : !isSame);
}

function updateIsModifiedOnActionContextState<T, O>(state: ActionContextState<T, O>, isModified?: void | boolean): ActionContextState<T, O> {
  return {
    ...state,
    actionState: state.actionState === DbxActionState.RESOLVED ? DbxActionState.IDLE : state.actionState, // Set to idle from success.
    isModified: (isModified as boolean) ?? true // if isModified is not input, default it to true
  };
}
