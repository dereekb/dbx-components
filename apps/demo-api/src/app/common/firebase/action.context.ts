import { AppNotificationTemplateTypeInfoRecordService, AppNotificationTemplateTypeInfoRecordServiceRef } from '@dereekb/firebase';
import { DemoApiAuthService } from './auth.service';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { FirebaseServerActionsContext, FirebaseServerAuthServiceRef, FirebaseServerStorageService, FirebaseServerStorageServiceRef } from '@dereekb/firebase-server';
import { TransformAndValidateFunctionResultFactory, TransformAndValidateObjectFactory } from '@dereekb/model';
import { MailgunService, MailgunServiceRef } from '@dereekb/nestjs/mailgun';

export abstract class DemoFirebaseServerActionsContext extends DemoFirestoreCollections implements FirebaseServerActionsContext, AppNotificationTemplateTypeInfoRecordServiceRef, FirebaseServerAuthServiceRef<DemoApiAuthService>, FirebaseServerStorageServiceRef, MailgunServiceRef {
  abstract readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
  abstract readonly authService: DemoApiAuthService;
  abstract readonly storageService: FirebaseServerStorageService;
  abstract readonly mailgunService: MailgunService;
}
