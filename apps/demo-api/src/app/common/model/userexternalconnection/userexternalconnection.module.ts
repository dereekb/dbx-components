import { type InjectionToken, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DEMO_DISCORD_EXTERNAL_CONNECTION_PROVIDER_TYPE, DemoFirestoreCollections } from 'demo-firebase';
import { type UserExternalConnectionSignInDelegate, appUserExternalConnectionModuleMetadata, autoCreateUserSignInDelegate } from '@dereekb/firebase-server/model';
import { DemoApiAuthModule, DemoApiAuthService, DemoApiFirestoreModule } from '../../firebase';

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
 * Path a user is returned to after a successful SIGN-IN.
 *
 * Deliberately NOT the settings page a connect returns to: someone who just signed in was not on the
 * settings page to begin with, so they land where a freshly signed-in user belongs.
 */
export const DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH = '/demo/app/home';

/**
 * Path a user is returned to after a FAILED sign-in, flagged and carrying the reason code.
 *
 * The LOGIN page rather than the connect failure page: a failed sign-in leaves the browser signed
 * out, and the settings page is auth-gated — sending them there would replace the explanation with a
 * redirect to the login page anyway, minus the reason.
 */
export const DEMO_EXTERNAL_CONNECTION_SIGN_IN_FAILURE_PATH = '/demo/auth/login?signin=failed';

/**
 * NestJS injection token for the demo's {@link UserExternalConnectionSignInDelegate}.
 */
export const DEMO_USER_EXTERNAL_CONNECTION_SIGN_IN_DELEGATE: InjectionToken = 'DEMO_USER_EXTERNAL_CONNECTION_SIGN_IN_DELEGATE';

/**
 * UserExternalConnection model module.
 *
 * NOTE: the private half of the connection pair is provided ONLY here. It is deliberately absent
 * from `DemoFirestoreCollections` and `DemoFirebaseServerActionsContext`, so app code cannot reach
 * the credentials collection except through `UserExternalConnectionServerActions`.
 *
 * The provider-agnostic OAuth `state` coder comes from the module metadata, so every registered
 * provider shares one coder and one secret.
 *
 * Discord is the demo's one SIGN-IN provider: it is the only adapter in the workspace that reads a
 * stable external account id plus an email out of its token exchange, which is what the identity
 * rules below need.
 */
@Module(
  appUserExternalConnectionModuleMetadata({
    dependencyModule: DemoApiFirestoreModule,
    appCollectionsToken: DemoFirestoreCollections,
    imports: [ConfigModule, DemoApiAuthModule],
    providerPolicies: [
      {
        providerType: DEMO_DISCORD_EXTERNAL_CONNECTION_PROVIDER_TYPE,
        // one Discord account is one demo account: sharing it would make the sign-in lookup, which
        // takes the first match, pick arbitrarily between the users holding it
        unique: true,
        signIn: true,
        // deliberately NOT signInConnects: the demo requests narrow identity scopes for a sign-in and
        // its own data scopes for a connect, so a login must not overwrite the data connection with the
        // narrower grant. It is also what makes the settings page's two Discord buttons independently
        // meaningful — one manages the login link, the other the connected app
        onCollision: 'block'
      }
    ],
    signIn: {
      authServiceToken: DemoApiAuthService,
      delegateToken: DEMO_USER_EXTERNAL_CONNECTION_SIGN_IN_DELEGATE,
      // stated rather than left to the default: a Discord email matching an existing demo account
      // must REJECT the sign-in, not adopt the account. The remedy is to recover that email, sign in
      // with it, and connect Discord from settings — which is the connect flow.
      allowVerifiedEmailLinking: false
    },
    providers: [
      {
        provide: DEMO_USER_EXTERNAL_CONNECTION_SIGN_IN_DELEGATE,
        // open registration: anyone who can authenticate at Discord gets a demo account. The email
        // requirement is passed explicitly even though it is the default, so the knob is visible.
        useFactory: (): UserExternalConnectionSignInDelegate => autoCreateUserSignInDelegate({ requireEmailToCreateUser: 'verified' })
      }
    ]
  })
)
export class UserExternalConnectionModule {}
