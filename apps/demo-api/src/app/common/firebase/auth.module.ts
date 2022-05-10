import * as admin from 'firebase-admin';
import { appAuthModuleMetadata } from "@dereekb/firebase-server";
import { Module } from "@nestjs/common";
import { DemoApiAuthService } from "./auth.service";

@Module(appAuthModuleMetadata({
  serviceProvider: {
    provide: DemoApiAuthService,
    useFactory: (auth: admin.auth.Auth) => new DemoApiAuthService(auth),
  }
}))
export class DemoApiAuthModule { }
