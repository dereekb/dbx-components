import { type NotificationTaskCheckpointString, type NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';
import { asArray } from '@dereekb/util';

/**
 * Removes checkpoints from the completions array based on the task handler result's removal instructions.
 *
 * If `removeAllCompletedCheckpoints` is true, returns an empty array (resets all progress).
 * If `removeFromCompletedCheckpoints` is set, removes only those specific checkpoints.
 * Otherwise, returns the original array unchanged.
 *
 * @param inputCompletions - the current list of completed checkpoint strings
 * @param handleTaskResult - the handler result containing removal instructions
 * @returns the filtered completions array with specified checkpoints removed
 *
 * @example
 * ```ts
 * const remaining = removeFromCompletionsArrayWithTaskResult(
 *   ['validate', 'process', 'cleanup'],
 *   { removeFromCompletedCheckpoints: ['process'] }
 * );
 * // remaining === ['validate', 'cleanup']
 * ```
 */
export function removeFromCompletionsArrayWithTaskResult<S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(inputCompletions: S[], handleTaskResult: Pick<NotificationTaskServiceHandleNotificationTaskResult<any, S>, 'removeAllCompletedCheckpoints' | 'removeFromCompletedCheckpoints'>) {
  const { removeAllCompletedCheckpoints, removeFromCompletedCheckpoints } = handleTaskResult;

  let result: S[];

  if (removeAllCompletedCheckpoints) {
    result = [];
  } else if (removeFromCompletedCheckpoints != null) {
    const removeFromCompletionsSet = new Set(asArray(removeFromCompletedCheckpoints));
    result = inputCompletions.filter((x) => !removeFromCompletionsSet.has(x));
  } else {
    result = inputCompletions;
  }

  return result;
}
