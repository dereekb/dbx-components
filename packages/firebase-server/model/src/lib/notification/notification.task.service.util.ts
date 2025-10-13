import { NotificationTaskCheckpointString, NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';
import { asArray } from '@dereekb/util';

/**
 * Removes the completed checkpoints from the inputCompletions array based on the handleTaskResult.
 *
 * @param inputCompletions
 * @param handleTaskResult
 * @returns
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
