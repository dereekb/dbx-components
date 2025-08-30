import { DemoApiAuthModule } from './auth.module';
import { DemoApiFirestoreModule } from './firestore.module';
import { DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD, DemoFirestoreCollections } from 'demo-firebase';
import { firebaseServerActionsContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { DemoFirebaseServerActionsContext } from './action.context';
import { DemoApiAuthService } from './auth.service';
import { DemoApiStorageModule } from './storage.module';
import { MailgunService, MailgunServiceModule } from '@dereekb/nestjs/mailgun';
import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { ServerEnvironmentService } from '@dereekb/nestjs';
import { NotificationExpediteService } from '@dereekb/firebase-server/model';

const demoFirebaseServerActionsContextFactory = (serverEnvironmentService: ServerEnvironmentService, collections: DemoFirestoreCollections, authService: DemoApiAuthService, storageService: FirebaseServerStorageService, mailgunService: MailgunService, notificationExpediteService: NotificationExpediteService): DemoFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext({ logError: serverEnvironmentService.isTestingEnv }),
    storageService,
    authService,
    mailgunService,
    notificationExpediteService,
    appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
  };
};

@Module({
  imports: [DemoApiFirestoreModule, DemoApiAuthModule, DemoApiStorageModule, MailgunServiceModule],
  providers: [
    {
      provide: DemoFirebaseServerActionsContext,
      useFactory: demoFirebaseServerActionsContextFactory,
      inject: [ServerEnvironmentService, DemoFirestoreCollections, DemoApiAuthService, FirebaseServerStorageService, MailgunService, NotificationExpediteService]
    }
  ],
  exports: [DemoFirebaseServerActionsContext]
})
export class DemoApiActionModule {}
