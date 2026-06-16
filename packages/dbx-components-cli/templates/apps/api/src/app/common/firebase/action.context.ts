import { type AppNotificationTemplateTypeInfoRecordService, type AppNotificationTemplateTypeInfoRecordServiceRef } from '@dereekb/firebase';
import { APP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';
import { type FirebaseServerActionsContext, type FirebaseServerStorageService, type FirebaseServerStorageServiceRef, type FirebaseServerAuthServiceRef } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResultFactory, type TransformAndValidateObjectFactory } from '@dereekb/model';
import { type APP_CODE_PREFIXApiAuthService } from './auth.service';
import { type MailgunService, type MailgunServiceRef } from '@dereekb/nestjs/mailgun';
import { type NotificationExpediteService, type NotificationExpediteServiceRef } from '@dereekb/firebase-server/model';

export abstract class APP_CODE_PREFIXFirebaseServerActionsContext extends APP_CODE_PREFIXFirestoreCollections implements FirebaseServerActionsContext, AppNotificationTemplateTypeInfoRecordServiceRef, FirebaseServerAuthServiceRef<APP_CODE_PREFIXApiAuthService>, FirebaseServerStorageServiceRef, MailgunServiceRef, NotificationExpediteServiceRef {
  abstract readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
  abstract readonly authService: APP_CODE_PREFIXApiAuthService;
  abstract readonly storageService: FirebaseServerStorageService;
  abstract readonly mailgunService: MailgunService;
  abstract readonly notificationExpediteService: NotificationExpediteService;
}
