import { NotificationTaskService, NotificationTaskServiceTaskHandlerConfig, notificationTaskService } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';

export function APP_CODE_PREFIXNotificationTaskServiceFactory(APP_CODE_PREFIX_CAMELFirebaseServerActionsContext: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationTaskService {
  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [];

  const notificationSendService: NotificationTaskService = notificationTaskService({
    validate: [], // TODO: Add event types for validation
    handlers
  });

  return notificationSendService;
}
