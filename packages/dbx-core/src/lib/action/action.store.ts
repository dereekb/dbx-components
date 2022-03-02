import { Injectable, OnDestroy } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, shareReplay, switchMap, startWith } from 'rxjs/operators';
import { BooleanStringKeyArray, BooleanStringKeyArrayUtilityInstance, Maybe, ReadableError } from '@dereekb/util';
import { filterMaybe, LockSet, scanCount } from '@dereekb/rxjs';
import { ActionDisabledKey, ActionState, DEFAULT_ACTION_DISABLED_KEY, isIdleActionState } from './action';

export function isActionContextEnabled(state: ActionContextState): boolean {
  return BooleanStringKeyArrayUtilityInstance.isFalse(state.disabled);
}

export function isActionContextDisabled(state: ActionContextState): boolean {
  return BooleanStringKeyArrayUtilityInstance.isTrue(state.disabled);
}

export function isDisabledActionContextState(state: ActionContextState): boolean {
  return isIdleActionState(state.actionState) && isActionContextDisabled(state);
}

export function isWorkingActionState(actionState: ActionState): boolean {
  return !isIdleActionState(actionState);
}

export function canTriggerActionState(actionState: ActionState): boolean {
  return actionState !== ActionState.Disabled && isIdleActionState(actionState);
}

export function canTriggerAction(state: ActionContextState): boolean {
  return isActionContextEnabled(state) && isIdleActionState(state.actionState);
}

export function canReadyValue(state: ActionContextState): boolean {
  return state.actionState === ActionState.Triggered;
}

export function actionContextIsModifiedAndCanTrigger(state: ActionContextState): boolean {
  // console.log('check: ', state, state.isModified, canTriggerAction(state));
  return state.isModified && canTriggerAction(state);
}

export function actionContextHasNoErrorAndIsModifiedAndCanTrigger(state: ActionContextState): boolean {
  return !state.error && actionContextIsModifiedAndCanTrigger(state);
}

export interface ActionContextState<T = any, O = any> {
  actionState: ActionState;
  isModified: boolean;
  /**
   * Value that is set after a triggered action.
   */
  value?: Maybe<T>;
  result?: Maybe<O>;
  error?: Maybe<ReadableError>;
  /**
   * Current disabled state.
   */
  disabled?: BooleanStringKeyArray;
  /**
   * Number of consecutive errors that have occured.
   */
  errorCount?: number;
}

const INITIAL_STATE: ActionContextState = {
  isModified: false,
  actionState: ActionState.Idle
};

@Injectable()
export class ActionContextStore<T = any, O = any> extends ComponentStore<ActionContextState<T, O>> implements OnDestroy {

  readonly lockSet = new LockSet();

  constructor() {
    super({ ...INITIAL_STATE });
    this.lockSet.addLock('working', this.isWorking$);
  }

  // MARK: Accessors
  readonly actionState$ = this.state$.pipe(map(x => isDisabledActionContextState(x) ? ActionState.Disabled : x.actionState), shareReplay(1));

  /**
   * Returns the current disabled reasons.
   */
  readonly disabled$ = this.state$.pipe(map(x => [...x.disabled ?? []]), distinctUntilChanged(), shareReplay(1));

  /**
   * Maps the current state to true or not when the action state changes to/from disabled.
   */
  readonly isDisabled$ = this.state$.pipe(map(isDisabledActionContextState), distinctUntilChanged(), shareReplay(1));

  /**
   * Pipes when idle but modified.
   */
  readonly isModified$ = this.afterDistinctBoolean(x => x.isModified);

  /**
   * Pipes true when triggered.
   */
  readonly triggered$ = this.afterDistinctActionState(ActionState.Triggered, () => true);

  /**
   * Pipes the readied value on ValueReady.
   */
  readonly valueReady$ = this.afterDistinctActionState(ActionState.ValueReady, x => x.value);

  /**
   * Pipes the error on the rejection state.
   */
  readonly rejected$ = this.afterDistinctActionState(ActionState.Rejected, x => x.error);

  /**
   * Pipes the result when the ActionState becomes working.
   */
  readonly working$ = this.afterDistinctActionState(ActionState.Working, () => true);

  /**
   * Whether or not it is currently in a working state.
   */
  readonly isWorking$ = this.afterDistinctBoolean(x => isWorkingActionState(x.actionState));

  /**
   * Pipes the current error.
   */
  readonly error$ = this.state$.pipe(map(x => x.error), distinctUntilChanged(), shareReplay(1));

  /**
   * Pipes the result when the ActionState becomes success.
   */
  readonly success$ = this.afterDistinctActionState(ActionState.Success, x => x.result);

  /**
   * Whether or not it is currently in a success state.
   */
  readonly isSuccess$ = this.afterDistinctBoolean(x => x.actionState === ActionState.Success);

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
  readonly canTrigger$ = this.state$.pipe(
    map(canTriggerAction),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Pipe that maps whether or not this is modified and can be triggered.
   *
   * Updates every state update instead of when the value changes.
   */
  readonly isModifiedAndCanTriggerUpdates$ = this.state$.pipe(
    map((x) => actionContextIsModifiedAndCanTrigger(x), shareReplay(1))
  );

  /**
   * Whether or not it can be triggered and modified.
   */
  readonly isModifiedAndCanTrigger$ = this.isModifiedAndCanTriggerUpdates$.pipe(
    distinctUntilChanged()
  );

  readonly hasNoErrorAndIsModifiedAndCanTrigger$ = this.state$.pipe(
    map((x) => actionContextHasNoErrorAndIsModifiedAndCanTrigger(x)),
    distinctUntilChanged(), shareReplay(1)
  );

  // MARK: State Changes
  /**
   * Adds a disabled reason.
   */
  readonly disable = this.updater((state, key?: void | ActionDisabledKey) => ({
    ...state,
    disabled: BooleanStringKeyArrayUtilityInstance.insert(state.disabled, ((key as any) ?? DEFAULT_ACTION_DISABLED_KEY))
  }));

  /**
   * Removes a disabled reason.
   */
  readonly enable = this.updater((state, key?: void | ActionDisabledKey) => ({
    ...state,
    disabled: BooleanStringKeyArrayUtilityInstance.remove(state.disabled, ((key as any) ?? DEFAULT_ACTION_DISABLED_KEY))
  }));

  /**
   * Triggers the modified state, if not disabled.
   */
  readonly setIsModified = this.updater((state, isModified: void | boolean) => ({
    ...state,
    actionState: (state.actionState === ActionState.Success) ? ActionState.Idle : state.actionState,  // Set to idle from success.
    isModified: (isModified as boolean) ?? true
  }));

  /**
   * Triggers the action if the state is currently not idle. The current state is cleared, but the error is retained (as we may need the error from the previous attempt).
   *
   * Will not fire if the action is disabled.
   */
  readonly trigger = this.updater((state) => canTriggerAction(state)
    ? ({ isModified: state.isModified, actionState: ActionState.Triggered, error: state.error, value: undefined })
    : state);

  /**
   * Updates the value, setting value ready. The current result is cleared.
   */
  readonly readyValue = this.updater((state, value: Maybe<T>) => canReadyValue(state)
    ? ({ ...state, actionState: ActionState.ValueReady, value, result: undefined })
    : state);

  /**
   * Notifys the context that the action is in progress.
   */
  readonly startWorking = this.updater((state) => ({ ...state, actionState: ActionState.Working }));

  /**
   * Triggers rejection of the action. The value is cleared.
   */
  readonly reject = this.updater((state, error?: Maybe<ReadableError>) => ({ isModified: state.isModified, actionState: ActionState.Rejected, error, errorCount: (state.errorCount ?? 0) + 1 }));

  /**
   * Updates the state to success, and optionally sets a result.
   *
   * Clears modified state, and any errors.
   */
  readonly success = this.updater((state, result?: O) => ({ isModified: false, actionState: ActionState.Success, value: state.value, result, error: undefined }));

  /**
   * Completely resets the store.
   */
  readonly reset = this.updater((state) => ({ ...INITIAL_STATE }));

  // MARK: Utility
  afterDistinctBoolean(fromState: (state: ActionContextState) => boolean): Observable<boolean> {
    return this.state$.pipe(
      map(x => fromState(x)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  afterDistinctActionState<X>(actionState: ActionState, fromState: (state: ActionContextState) => X): Observable<X> {
    return this.state$.pipe(
      map((x) => ([x, x.actionState]) as [ActionContextState, ActionState]),
      distinctUntilChanged((a, b) => a?.[1] === b?.[1]),  // Filter out when the state remains the same.
      filter(([x, y]) => y === actionState),  // Only pipe when the action state matches.
      map(x => fromState(x[0])),
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
