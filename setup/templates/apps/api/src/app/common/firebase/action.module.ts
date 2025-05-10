import { APP_CODE_PREFIXApiAuthModule } from './auth.module';
import { APP_CODE_PREFIXApiFirestoreModule } from './firestore.module';
import { APP_CODE_PREFIX_CAPS_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD, APP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';
import { firebaseServerActionsContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from './action.context';
import { APP_CODE_PREFIXApiAuthService } from './auth.service';
import { APP_CODE_PREFIXApiStorageModule } from './storage.module';
import { MailgunService, MailgunServiceModule } from '@dereekb/nestjs/mailgun';
import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { ServerEnvironmentService } from '@dereekb/nestjs';

const APP_CODE_PREFIXFirebaseServerActionsContextFactory = (serverEnvironmentService: ServerEnvironmentService, collections: APP_CODE_PREFIXFirestoreCollections, authService: APP_CODE_PREFIXApiAuthService, storageService: FirebaseServerStorageService, mailgunService: MailgunService): APP_CODE_PREFIXFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext({ logError: serverEnvironmentService.isTestingEnv }),
    storageService,
    authService,
    mailgunService,
    appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(APP_CODE_PREFIX_CAPS_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
  };
};

@Module({
  imports: [APP_CODE_PREFIXApiFirestoreModule, APP_CODE_PREFIXApiAuthModule, APP_CODE_PREFIXApiStorageModule, MailgunServiceModule],
  providers: [
    {
      provide: APP_CODE_PREFIXFirebaseServerActionsContext,
      useFactory: APP_CODE_PREFIXFirebaseServerActionsContextFactory,
      inject: [ServerEnvironmentService, APP_CODE_PREFIXFirestoreCollections, APP_CODE_PREFIXApiAuthService, FirebaseServerStorageService, MailgunService]
    }
  ],
  exports: [APP_CODE_PREFIXFirebaseServerActionsContext]
})
export class APP_CODE_PREFIXApiActionModule { }
