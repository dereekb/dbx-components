import { type FormSpaceSubmissionNotificationTaskData } from '@dereekb/firebase';
import { type NotificationTaskServiceTaskHandlerConfig, formSpaceSubmissionNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { DEMO_FORM_SPACE_TYPE_CONFIGS } from 'demo-firebase';
import { type DemoFirebaseServerActionsContext } from '../../../../firebase/action.context';
import { demoExampleFormSpaceSubmissionProcessor } from './task.handler.formspace.example';
import { demoGuestbookFormSpaceSubmissionProcessor } from './task.handler.formspace.guestbook';
import { demoTestFormSpaceSubmissionProcessor } from './task.handler.formspace.test';

/**
 * Builds the handler config for the demo `FSS` FormSpace submission notification task.
 *
 * The library handler dispatches to a processor by the space's FormSpaceType, so this is where the demo app's
 * per-type processors are registered.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing the FormSpace collection.
 * @returns The task-handler config registered into `NotificationTaskService`.
 */
export function demoFormSpaceSubmissionNotificationTaskHandler(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationTaskServiceTaskHandlerConfig<FormSpaceSubmissionNotificationTaskData> {
  // `validate` is the app's registered type list — an unhandled type is caught here, at wiring time, rather
  // than at the first submission.
  return formSpaceSubmissionNotificationTaskHandler({
    processors: [demoExampleFormSpaceSubmissionProcessor(), demoTestFormSpaceSubmissionProcessor(), demoGuestbookFormSpaceSubmissionProcessor()],
    validate: DEMO_FORM_SPACE_TYPE_CONFIGS.map((x) => x.formSpaceType),
    formSpaceFirestoreCollections: demoFirebaseServerActionsContext
  });
}
