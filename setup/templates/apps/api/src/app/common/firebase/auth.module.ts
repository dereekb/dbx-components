import * as admin from 'firebase-admin';
import { firebaseServerAuthModuleMetadata } from "@dereekb/firebase-server";
import { Module } from "@nestjs/common";
import { APP_CODE_PREFIXApiAuthService } from "./auth.service";

@Module(firebaseServerAuthModuleMetadata({
  serviceProvider: {
    provide: APP_CODE_PREFIXApiAuthService,
    useFactory: (auth: admin.auth.Auth) => new APP_CODE_PREFIXApiAuthService(auth),
  }
}))
export class APP_CODE_PREFIXApiAuthModule { }
