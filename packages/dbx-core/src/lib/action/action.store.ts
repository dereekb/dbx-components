import { Injectable, OnDestroy } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, filter, map, shareReplay, switchMap, startWith, of } from 'rxjs';
import { BooleanStringKeyArray, BooleanStringKeyArrayUtility, Maybe, ReadableError } from '@dereekb/util';
import { LoadingStateType, idleLoadingState, errorResult, filterMaybe, LoadingState, LockSet, scanCount, successResult, beginLoading } from '@dereekb/rxjs';
import { DbxActionDisabledKey, DbxActionRejectedPair, DbxActionState, DbxActionSuccessPair, DbxActionWorkOrWorkProgress, DbxActionWorkProgress, DEFAULT_ACTION_DISABLED_KEY, isIdleActionState, loadingStateTypeForActionState } from './action';

export function isActionContextEnabled(state: ActionContextState): boolean {
  return BooleanStringKeyArrayUtility.isFalse(state.disabled);
}

export function isActionContextDisabled(state: ActionContextState): boolean {
  return BooleanStringKeyArrayUtility.isTrue(state.disabled);
}

export function isDisabledActionContextState(state: ActionContextState): boolean {
  return isIdleActionState(state.actionState) && isActionContextDisabled(state);
}

export function isWorkingActionState(actionState: DbxActionState): boolean {
  return !isIdleActionState(actionState);
}

export function canTriggerActionState(actionState: DbxActionState): boolean {
  return actionState !== DbxActionState.DISABLED && isIdleActionState(actionState);
}

export function canTriggerAction(state: ActionContextState): boolean {
  return isActionContextEnabled(state) && isIdleActionState(state.actionState);
}

export function canReadyValue(state: ActionContextState): boolean {
  return state.actionState === DbxActionState.TRIGGERED;
}

export function actionContextIsModifiedAndCanTrigger(state: ActionContextState): boolean {
  // console.log('check: ', state, state.isModified, canTriggerAction(state));
  return state.isModified && canTriggerAction(state);
}

export function actionContextHasNoErrorAndIsModifiedAndCanTrigger(state: ActionContextState): boolean {
  return !state.error && actionContextIsModifiedAndCanTrigger(state);
}

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

export function loadingStateTypeForActionContextState(state: ActionContextState): LoadingStateType {
  return loadingStateTypeForActionState(state.actionState);
}

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

@Injectable()
export class ActionContextStore<T = unknown, O = unknown> extends ComponentStore<ActionContextState<T, O>> implements OnDestroy {
  readonly lockSet = new LockSet();

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
    // Wait for any actions to complete before destroying.
    this.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
    }, 2000);
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
