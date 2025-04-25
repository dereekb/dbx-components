import * as admin from 'firebase-admin';
import { firebaseServerAuthModuleMetadata, FIREBASE_AUTH_TOKEN } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiAuthService } from './auth.service';
import { MailgunService, MailgunServiceModule } from '@dereekb/nestjs/mailgun';

@Module(
  firebaseServerAuthModuleMetadata({
    imports: [MailgunServiceModule],
    serviceProvider: {
      provide: APP_CODE_PREFIXApiAuthService,
      useFactory: (auth: admin.auth.Auth, mailgunService: MailgunService) => new APP_CODE_PREFIXApiAuthService(auth, mailgunService),
      inject: [FIREBASE_AUTH_TOKEN, MailgunService]
    }
  })
)
export class APP_CODE_PREFIXApiAuthModule {}
