import { createNotificationDocument, getDocumentSnapshotData, type NotificationTaskBotRunNotificationTaskData, type NotificationTaskBotScriptType, notificationTaskFailed } from '@dereekb/firebase';
import {
  type NotificationTaskBotRunCleanupInstructions,
  type NotificationTaskBotRunSubtaskResult,
  type NotificationTaskBotScriptProcessorConfig,
  type NotificationTaskServiceTaskHandlerConfig,
  notificationTaskBotDelayUntilDue,
  notificationTaskBotRunNotificationTaskHandler,
  runNotificationTaskBotEntryTransaction
} from '@dereekb/firebase-server/model';
import { addMilliseconds } from '@dereekb/util';
import {
  DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL,
  DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS,
  DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT,
  DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  type DemoPingNotificationTaskBotEntryData,
  exampleNotificationTemplate
} from 'demo-firebase';
import { type DemoFirebaseServerActionsContext } from '../../../../firebase/action.context';

/**
 * Subtask of the demo ping script that waits until the ping is due.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_WAIT_SUBTASK = 'wait';

/**
 * Subtask of the demo ping script that sends the ping.
 */
export const DEMO_PING_NOTIFICATION_TASK_BOT_PING_SUBTASK = 'ping';

/**
 * Builds the processor for a demo ping NotificationTaskBot script (`demo_ping` or `demo_ping_required`).
 *
 * - wait: delays the run until `lsat + iv`, unless the run is FORCED or explicit.
 * - ping: reports a failure when `f` is set. Otherwise, in a fenced transaction, creates an example notification for the
 *   profile, marks the run submitted and counts it. The count restarts when the entry resumes from the `'limit'` pause
 *   (`rpr`). Nothing is sent when the profile no longer exists.
 * - cleanup: removes the entry when the profile no longer exists. Otherwise schedules the next run after `iv`, or pauses
 *   the entry once `c` reaches `pa`.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing the Profile and Notification collections.
 * @param target - The ping script type to process. Defaults to `demo_ping`.
 * @returns The script processor.
 */
export function demoPingNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext, target: NotificationTaskBotScriptType = DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE): NotificationTaskBotScriptProcessorConfig<DemoPingNotificationTaskBotEntryData> {
  const { profileCollection } = demoFirebaseServerActionsContext;

  return {
    target,
    flow: [
      {
        subtask: DEMO_PING_NOTIFICATION_TASK_BOT_WAIT_SUBTASK,
        fn: async (input) => {
          const { lsat, d } = input.entry;
          const due = addMilliseconds(lsat, d?.iv ?? DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL);
          return (await notificationTaskBotDelayUntilDue(input, due)) ?? { completion: DEMO_PING_NOTIFICATION_TASK_BOT_WAIT_SUBTASK };
        }
      },
      {
        subtask: DEMO_PING_NOTIFICATION_TASK_BOT_PING_SUBTASK,
        fn: async (input) => {
          let result: NotificationTaskBotRunSubtaskResult;

          if (input.entry.d?.f) {
            // a failed step is retried after the failure delay, then lost and repaired
            result = notificationTaskFailed();
          } else {
            await runNotificationTaskBotEntryTransaction<void, DemoPingNotificationTaskBotEntryData>(input, async ({ transaction, entry, alreadySubmitted, markSubmitted, updateEntryData }) => {
              const profileDocument = profileCollection.documentAccessorForTransaction(transaction).loadDocumentForKey(input.model);
              const profile = await getDocumentSnapshotData(profileDocument);

              // a re-run of this step after a crash finds the run already submitted, and does not send twice
              if (!alreadySubmitted && profile) {
                await createNotificationDocument({ context: demoFirebaseServerActionsContext, transaction, template: exampleNotificationTemplate({ profileDocument }) });
                markSubmitted();

                // the count restarts when an admin resumes the entry from the limit pause
                const count = entry.rpr === DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT ? 0 : (entry.d?.c ?? 0);
                updateEntryData({ c: count + 1 });
              }
            });

            result = { completion: DEMO_PING_NOTIFICATION_TASK_BOT_PING_SUBTASK };
          }

          return result;
        }
      }
    ],
    cleanup: async (input) => {
      const { c, iv, pa } = input.entry.d ?? {};
      const profile = await getDocumentSnapshotData(profileCollection.documentAccessor().loadDocumentForKey(input.model));

      let result: NotificationTaskBotRunCleanupInstructions<DemoPingNotificationTaskBotEntryData>;

      if (!profile) {
        // the attached profile was deleted, so the entry ends itself
        result = { remove: true };
      } else if (pa != null && (c ?? 0) >= pa) {
        result = { pause: { reason: DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT } };
      } else {
        result = { nextRunAt: addMilliseconds(new Date(), iv ?? DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL) };
      }

      return result;
    }
  };
}

/**
 * Builds the handler config for the demo `NTBR` NotificationTaskBot run task.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing the NotificationTaskBot collections and script registry.
 * @returns The task-handler config registered into `NotificationTaskService`.
 */
export function demoNotificationTaskBotRunNotificationTaskHandler(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationTaskServiceTaskHandlerConfig<NotificationTaskBotRunNotificationTaskData> {
  return notificationTaskBotRunNotificationTaskHandler({
    processors: [demoPingNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext), demoPingNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)],
    validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType),
    notificationTaskBotContext: demoFirebaseServerActionsContext
  });
}
