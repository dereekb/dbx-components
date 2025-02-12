import { DemoApiAuthModule } from './auth.module';
import { DemoApiFirestoreModule } from './firestore.module';
import { DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_DETAILS_RECORD, DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { firebaseServerActionsContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { DemoFirebaseServerActionsContext } from './action.context';
import { DemoApiAuthService } from './auth.service';
import { DemoApiStorageModule } from './storage.module';
import { MailgunService, MailgunServiceModule } from '@dereekb/nestjs/mailgun';
import { appNotificationTemplateTypeDetailsRecordService } from '@dereekb/firebase';

const demoFirebaseServerActionsContextFactory = (collections: DemoFirestoreCollections, authService: DemoApiAuthService, storageService: FirebaseServerStorageService, mailgunService: MailgunService): DemoFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext(),
    storageService,
    authService,
    mailgunService,
    appNotificationTemplateTypeDetailsRecordService: appNotificationTemplateTypeDetailsRecordService(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_DETAILS_RECORD)
  };
};

@Module({
  imports: [DemoApiFirestoreModule, DemoApiAuthModule, DemoApiStorageModule, MailgunServiceModule],
  providers: [
    {
      provide: DemoFirebaseServerActionsContext,
      useFactory: demoFirebaseServerActionsContextFactory,
      inject: [DemoFirestoreCollections, DemoApiAuthService, FirebaseServerStorageService, MailgunService]
    }
  ],
  exports: [DemoFirebaseServerActionsContext]
})
export class DemoApiActionModule {}
