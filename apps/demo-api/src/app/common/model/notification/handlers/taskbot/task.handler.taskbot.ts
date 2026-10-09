import { createNotificationDocument, type NotificationTaskBotRunNotificationTaskData } from '@dereekb/firebase';
import { type NotificationTaskBotScriptProcessorConfig, type NotificationTaskServiceTaskHandlerConfig, notificationTaskBotDelayUntilDue, notificationTaskBotRunNotificationTaskHandler, runNotificationTaskBotEntryTransaction } from '@dereekb/firebase-server/model';
import { DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL, DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS, DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, type DemoPingNotificationTaskBotEntryData, exampleNotificationTemplate } from 'demo-firebase';
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
 * Builds the processor for the demo `demo_ping` NotificationTaskBot script.
 *
 * - wait: delays the run until `lsat + iv`, unless the run is FORCED or explicit.
 * - ping: in a fenced transaction, creates an example notification for the profile, marks the run submitted and counts it.
 * - cleanup: schedules the next run after `iv`, or pauses the entry once `c` reaches `pa`.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing the Profile and Notification collections.
 * @returns The script processor.
 */
export function demoPingNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationTaskBotScriptProcessorConfig<DemoPingNotificationTaskBotEntryData> {
  const { profileCollection } = demoFirebaseServerActionsContext;

  return {
    target: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
    flow: [
      {
        subtask: DEMO_PING_NOTIFICATION_TASK_BOT_WAIT_SUBTASK,
        fn: async (input) => {
          const { lsat, d } = input.entry;
          const due = lsat ? new Date(lsat.getTime() + (d?.iv ?? DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL)) : undefined;
          return (await notificationTaskBotDelayUntilDue(input, due)) ?? { completion: DEMO_PING_NOTIFICATION_TASK_BOT_WAIT_SUBTASK };
        }
      },
      {
        subtask: DEMO_PING_NOTIFICATION_TASK_BOT_PING_SUBTASK,
        fn: async (input) => {
          await runNotificationTaskBotEntryTransaction<void, DemoPingNotificationTaskBotEntryData>(input, async ({ transaction, entry, alreadySubmitted, markSubmitted, updateEntryData }) => {
            // a re-run of this step after a crash finds the run already submitted, and does not send twice
            if (!alreadySubmitted) {
              const profileDocument = profileCollection.documentAccessorForTransaction(transaction).loadDocumentForKey(input.model);
              await createNotificationDocument({ context: demoFirebaseServerActionsContext, transaction, template: exampleNotificationTemplate({ profileDocument }) });
              markSubmitted();
              updateEntryData({ c: (entry.d?.c ?? 0) + 1 });
            }
          });

          return { completion: DEMO_PING_NOTIFICATION_TASK_BOT_PING_SUBTASK };
        }
      }
    ],
    cleanup: (input) => {
      const { c, iv, pa } = input.entry.d ?? {};

      return pa != null && (c ?? 0) >= pa ? { pause: { reason: DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT } } : { nextRunAt: new Date(Date.now() + (iv ?? DEFAULT_DEMO_PING_NOTIFICATION_TASK_BOT_INTERVAL)) };
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
    processors: [demoPingNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext)],
    validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType),
    notificationTaskBotContext: demoFirebaseServerActionsContext
  });
}
