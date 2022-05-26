import * as admin from 'firebase-admin';
import { firebaseServerAuthModuleMetadata } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { DemoApiAuthService } from './auth.service';

@Module(
  firebaseServerAuthModuleMetadata({
    serviceProvider: {
      provide: DemoApiAuthService,
      useFactory: (auth: admin.auth.Auth) => new DemoApiAuthService(auth)
    }
  })
)
export class DemoApiAuthModule {}
