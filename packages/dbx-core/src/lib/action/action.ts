
/**
 * Used by ActionContextState to denote what state the action is in.
 */
 export enum ActionState {
  /**
   * No action in progress. Waiting for the trigger.
   */
  Idle = 'idle',
  /**
   * Idle state that can be set to show that the source is not yet ready.
   */
  Disabled = 'disabled',
  /**
   * The action was triggered. We wait (and allow) the value to be updated.
   */
  Triggered = 'triggered',
  /**
   * The trigger was accepted and the value is updated. It should begin working immediately.
   *
   * ValueReady cannot be set until triggered is set.
   */
  ValueReady = 'valueReady',
  /**
   * The action is in progress.
   */
  Working = 'working',
  /**
   * The trigger, action, or value was rejected due to an error or other issue.
   *
   * An error may be specified optionally.
   */
  Rejected = 'rejected',
  /**
   * The action was successful.
   */
  Success = 'success'
}

/**
 * Unique key for disabling/enabling.
 */
export type ActionDisabledKey = string;

export const DEFAULT_ACTION_DISABLED_KEY = 'default';

export function isIdleActionState(actionState: ActionState): boolean {
  switch (actionState) {
    case ActionState.Idle:
    case ActionState.Disabled:
    case ActionState.Rejected:
    case ActionState.Success:
      return true;
    default:
      return false;
  }
}
