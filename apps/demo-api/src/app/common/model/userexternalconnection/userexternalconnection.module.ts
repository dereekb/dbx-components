import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DemoFirestoreCollections } from 'demo-firebase';
import { appUserExternalConnectionModuleMetadata } from '@dereekb/firebase-server/model';
import { DemoApiFirestoreModule } from '../../firebase';

/**
 * Path on the app URL a user is returned to after an external-connection OAuth handoff.
 *
 * Declared in code rather than configured: it is the page the connect action was started from, which
 * is a property of the app's route tree, not of a deployment. The origin comes from the server
 * environment's `appUrl`.
 */
export const DEMO_EXTERNAL_CONNECTION_RETURN_PATH = '/demo/app/settings';

/**
 * Path a user is returned to after a FAILED external-connection OAuth handoff.
 *
 * The same settings page, flagged — without the flag a failed connect is indistinguishable from a
 * successful one to the user.
 */
export const DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH = `${DEMO_EXTERNAL_CONNECTION_RETURN_PATH}?connect=failed`;

/**
 * UserExternalConnection model module.
 *
 * NOTE: the private half of the connection pair is provided ONLY here. It is deliberately absent
 * from `DemoFirestoreCollections` and `DemoFirebaseServerActionsContext`, so app code cannot reach
 * the credentials collection except through `UserExternalConnectionServerActions`.
 *
 * The provider-agnostic OAuth `state` coder comes from the module metadata, so every registered
 * provider shares one coder and one secret.
 */
@Module(
  appUserExternalConnectionModuleMetadata({
    dependencyModule: DemoApiFirestoreModule,
    appCollectionsToken: DemoFirestoreCollections,
    imports: [ConfigModule]
  })
)
export class UserExternalConnectionModule {}
