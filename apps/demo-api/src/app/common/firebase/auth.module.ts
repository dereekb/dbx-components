import * as admin from 'firebase-admin';
import { firebaseServerAuthModuleMetadata, FIREBASE_AUTH_TOKEN } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { DemoApiAuthService } from './auth.service';
import { MailgunService, MailgunServiceModule } from '@dereekb/nestjs/mailgun';

@Module(
  firebaseServerAuthModuleMetadata({
    imports: [MailgunServiceModule],
    serviceProvider: {
      provide: DemoApiAuthService,
      useFactory: (auth: admin.auth.Auth, mailgunService: MailgunService) => new DemoApiAuthService(auth, mailgunService),
      inject: [FIREBASE_AUTH_TOKEN, MailgunService]
    }
  })
)
export class DemoApiAuthModule {}
