import { NotificationSendService } from '@dereekb/firebase-server/model';
import { demoNotificationMailgunSendService } from './notification.send.mailgun.service';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';

export function demoNotificationSendServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationSendService {
  const { mailgunService } = demoFirebaseServerActionsContext;
  const emailSendService = demoNotificationMailgunSendService(mailgunService);

  const notificationSendService: NotificationSendService = {
    emailSendService
  };

  return notificationSendService;
}
