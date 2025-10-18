import { type AppNotificationTemplateTypeInfoRecordService, type AppNotificationTemplateTypeInfoRecordServiceRef } from '@dereekb/firebase';
import { type DemoApiAuthService } from './auth.service';
import { DemoFirestoreCollections } from 'demo-firebase';
import { type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef, type FirebaseServerStorageService, type FirebaseServerStorageServiceRef } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResultFactory, type TransformAndValidateObjectFactory } from '@dereekb/model';
import { type MailgunService, type MailgunServiceRef } from '@dereekb/nestjs/mailgun';
import { type NotificationExpediteService, type NotificationExpediteServiceRef } from '@dereekb/firebase-server/model';

export abstract class DemoFirebaseServerActionsContext extends DemoFirestoreCollections implements FirebaseServerActionsContext, AppNotificationTemplateTypeInfoRecordServiceRef, FirebaseServerAuthServiceRef<DemoApiAuthService>, FirebaseServerStorageServiceRef, MailgunServiceRef, NotificationExpediteServiceRef {
  abstract readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
  abstract readonly authService: DemoApiAuthService;
  abstract readonly storageService: FirebaseServerStorageService;
  abstract readonly mailgunService: MailgunService;
  abstract readonly notificationExpediteService: NotificationExpediteService;
}
