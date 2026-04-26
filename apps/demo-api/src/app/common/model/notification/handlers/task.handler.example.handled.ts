import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_HANDLED_NOTIFICATION_TASK_PING_CHECKPOINT, EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE, type ExampleHandledNotificationTaskCheckpoint, type ExampleHandledNotificationTaskData } from 'demo-firebase';
import { type DemoFirebaseServerActionsContext } from '../../../firebase/action.context';

/**
 * Builds the handler config for the demo `EH` notification task. The
 * handler is intentionally minimal: a single `ping` checkpoint that
 * completes immediately. It exists to exercise the
 * `notification/handlers/` split convention end-to-end so the
 * `dbx_validate_notification_folder` and
 * `dbx_validate_app_notifications` tools have a real-tree fixture
 * for the multi-file pattern.
 *
 * @param _context - server actions context (unused; kept for factory signature consistency).
 * @returns the task-handler config registered into `NotificationTaskService`.
 */
export function demoExampleHandledNotificationTaskHandler(_context: DemoFirebaseServerActionsContext): NotificationTaskServiceTaskHandlerConfig<ExampleHandledNotificationTaskData, ExampleHandledNotificationTaskCheckpoint> {
  const handler: NotificationTaskServiceTaskHandlerConfig<ExampleHandledNotificationTaskData, ExampleHandledNotificationTaskCheckpoint> = {
    type: EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: EXAMPLE_HANDLED_NOTIFICATION_TASK_PING_CHECKPOINT,
        fn: async (_notificationTask) => {
          return { completion: true };
        }
      }
    ]
  };
  return handler;
}
