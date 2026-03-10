import { LoadingStateType } from '@dereekb/rxjs';
import { type PercentNumber, type Maybe } from '@dereekb/util';

/**
 * Represents the percent completion of an in-progress action.
 *
 * This is a {@link PercentNumber}, a number between 0 and 100 where 0 means just started and 100 means complete.
 *
 * @see {@link DbxActionWorkOrWorkProgress} for the union type that includes boolean working state.
 */
export type DbxActionWorkProgress = PercentNumber;

/**
 * Union type representing either a boolean working indicator or a numeric progress value.
 *
 * - `true` indicates the action is working but no specific progress percentage is available.
 * - `false` indicates the action is not working.
 * - A {@link DbxActionWorkProgress} number (0-100) indicates both that the action is working and how far along it is.
 *
 * @see {@link DbxActionWorkProgress}
 */
export type DbxActionWorkOrWorkProgress = boolean | DbxActionWorkProgress;

/**
 * Creates a working progress value from an array of working progress values.
 *
 * @param workOrWorkProgress The array of working progress values to use.
 * @param progressPercent An optional progress percent value to use if the working progress is a boolean.
 * @returns The working progress value.
 */
export function dbxActionWorkProgress(workOrWorkProgress: Maybe<DbxActionWorkOrWorkProgress>[], progressPercent?: Maybe<DbxActionWorkProgress>) {
  const workingValue = workOrWorkProgress.reduce((acc, val) => acc ?? val);
  const isWorking = workingValue != null && workingValue !== false;

  let workingProgress: DbxActionWorkOrWorkProgress;

  if (isWorking) {
    if (typeof workingValue === 'number') {
      workingProgress = workingValue;
    } else {
      workingProgress = progressPercent ?? true;
    }
  } else {
    workingProgress = false;
  }

  return workingProgress;
}

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
 * Pairs the input value with the output result from a successfully resolved action.
 *
 * Emitted by {@link ActionContextStore.successPair$} when an action completes without error.
 *
 * @typeParam T - The input value type provided to the action.
 * @typeParam O - The output result type produced by the action.
 */
export interface DbxActionSuccessPair<T, O> {
  readonly value: T;
  readonly result: Maybe<O>;
}

/**
 * Pairs the input value with the error from a rejected action.
 *
 * Emitted by {@link ActionContextStore.rejectedPair$} when an action fails.
 *
 * @typeParam T - The input value type that was provided to the action before rejection.
 */
export interface DbxActionRejectedPair<T> {
  readonly value: T;
  readonly error: unknown;
}

/**
 * Unique string key used to track individual reasons for disabling an action.
 *
 * Multiple keys can be active simultaneously, and the action remains disabled
 * as long as at least one key is present. This allows multiple independent sources
 * (e.g., form validation, permissions, working state) to each control the disabled state
 * without conflicting with one another.
 *
 * @see {@link ActionContextStore.disable}
 * @see {@link ActionContextStore.enable}
 */
export type DbxActionDisabledKey = string;

/**
 * The default disabled key used when no specific key is provided to {@link ActionContextStore.disable}.
 */
export const DEFAULT_ACTION_DISABLED_KEY = 'dbx_action_disabled';

/**
 * Determines whether the given action state represents an idle-like state.
 *
 * Idle-like states include IDLE, DISABLED, REJECTED, and RESOLVED -- any state
 * where the action is not currently in-progress (triggered, value-ready, or working).
 *
 * @param actionState - The action state to check.
 * @returns `true` if the state is idle-like, `false` if the action is in-progress.
 */
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

/**
 * Maps a {@link DbxActionState} to the corresponding {@link LoadingStateType}.
 *
 * This bridges the action state machine with the loading state system from `@dereekb/rxjs`,
 * allowing action states to be represented as loading states for UI display.
 *
 * @param actionState - The action state to convert.
 * @returns The corresponding loading state type (IDLE, LOADING, SUCCESS, or ERROR).
 */
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
