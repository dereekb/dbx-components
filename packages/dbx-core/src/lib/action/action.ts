import { LoadingStateType } from '@dereekb/rxjs';
import { type PercentNumber, type Maybe } from '@dereekb/util';

/**
 * Used to denote the percent progress of a working action.
 *
 * This is a PercentNumber, a number between 0 and 100.
 */
export type DbxActionWorkProgress = PercentNumber;

/**
 * Used for denoting working state or progress.
 *
 * True is working, but no progress level.
 */
export type DbxActionWorkOrWorkProgress = boolean | DbxActionWorkProgress;

/**
 * Used by ActionContextState to denote what state the action is in.
 */
export enum DbxActionState {
  /**
   * No action in progress. Waiting for the trigger.
   */
  IDLE = 'idle',
  /**
   * Idle state that can be set to show that the source is not yet ready.
   */
  DISABLED = 'disabled',
  /**
   * The action was triggered. We wait (and allow) the value to be updated.
   */
  TRIGGERED = 'triggered',
  /**
   * The trigger was accepted and the value is updated. It should begin working immediately.
   *
   * ValueReady cannot be set until triggered is set.
   */
  VALUE_READY = 'valueReady',
  /**
   * The action is in progress.
   */
  WORKING = 'working',
  /**
   * The trigger, action, or value was rejected due to an error or other issue.
   *
   * An error may be specified optionally.
   */
  REJECTED = 'rejected',
  /**
   * The action resolved without issue.
   */
  RESOLVED = 'resolved'
}

/**
 * Contains the input value and the output result from a DbxAction.
 */
export interface DbxActionSuccessPair<T, O> {
  readonly value: T;
  readonly result: Maybe<O>;
}

/**
 * Contains the input value and the output error from a DbxAction.
 */
export interface DbxActionRejectedPair<T> {
  readonly value: T;
  readonly error: unknown;
}

/**
 * Unique key for disabling/enabling.
 */
export type DbxActionDisabledKey = string;

export const DEFAULT_ACTION_DISABLED_KEY = 'dbx_action_disabled';

export function isIdleActionState(actionState: DbxActionState): boolean {
  switch (actionState) {
    case DbxActionState.IDLE:
    case DbxActionState.DISABLED:
    case DbxActionState.REJECTED:
    case DbxActionState.RESOLVED:
      return true;
    default:
      return false;
  }
}

export function loadingStateTypeForActionState(actionState: DbxActionState): LoadingStateType {
  let loadingStateType: LoadingStateType;

  switch (actionState) {
    case DbxActionState.RESOLVED:
      loadingStateType = LoadingStateType.SUCCESS;
      break;
    case DbxActionState.REJECTED:
      loadingStateType = LoadingStateType.ERROR;
      break;
    case DbxActionState.IDLE:
    case DbxActionState.DISABLED:
      loadingStateType = LoadingStateType.IDLE;
      break;
    default:
      loadingStateType = LoadingStateType.LOADING;
      break;
  }

  return loadingStateType;
}
