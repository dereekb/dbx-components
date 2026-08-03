import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DemoFirestoreCollections } from 'demo-firebase';
import { appUserExternalConnectionModuleMetadata } from '@dereekb/firebase-server/model';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { DemoApiFirestoreModule } from '../../firebase';
import { DemoApiUserExternalConnectionStateCoder, demoApiUserExternalConnectionStateCoderFactory } from './userexternalconnection.state';

/**
 * UserExternalConnection model module.
 *
 * NOTE: the private half of the connection pair is provided ONLY here. It is deliberately absent
 * from `DemoFirestoreCollections` and `DemoFirebaseServerActionsContext`, so app code cannot reach
 * the credentials collection except through `UserExternalConnectionServerActions`.
 */
@Module(
  appUserExternalConnectionModuleMetadata({
    dependencyModule: DemoApiFirestoreModule,
    appCollectionsToken: DemoFirestoreCollections,
    imports: [ConfigModule],
    // provider-agnostic: the OAuth `state` is a feature of the authorization-code flow, not of any
    // one provider, so every registered provider shares this coder and its secret
    providers: [
      {
        provide: DemoApiUserExternalConnectionStateCoder,
        useFactory: demoApiUserExternalConnectionStateCoderFactory,
        inject: [ConfigService, FirebaseServerEnvService]
      }
    ],
    exports: [DemoApiUserExternalConnectionStateCoder]
  })
)
export class UserExternalConnectionModule {}
