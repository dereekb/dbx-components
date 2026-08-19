import { Module } from '@nestjs/common';
import { AUTH_ADMIN_ROLE, type AuthClaims } from '@dereekb/util';
import { FIRESTORE_SESSION_ADMIN_PREDICATE, FirebaseServerEnvService, type FirestoreSessionAdminPredicate, SessionApiModuleConfig, sessionApiModuleMetadata } from '@dereekb/firebase-server';
import { DEMO_AUTH_CLAIMS_SERVICE, DEMO_FIREBASE_CLIENT_CONFIG } from 'demo-firebase';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';

/**
 * The load-bearing gate on `GET /api/session/firestore` for the demo app.
 *
 * A session hands the caller a Firebase custom token for their own uid plus a valid web-app App
 * Check attestation, so it is admin-only. `assertIsAdminInRequest` cannot be used here — it needs a
 * synthetic `CallableRequest` with `.nest` attached, and a plain Nest controller only has the Express
 * request's `req.auth` — hence the injected predicate, which also keeps `@dereekb/firebase-server`
 * agnostic about what "admin" means in this app.
 *
 * The `session.firestore` OIDC scope enforced alongside it is defence in depth only: a non-OIDC
 * caller presenting a plain Firebase ID token carries no `scope` claim, and every scope-enforcement
 * site treats an absent claim as "skip".
 *
 * @param auth - The calling request's auth data, or undefined for an unauthenticated request.
 * @returns True when the caller holds the admin role.
 */
const demoFirestoreSessionAdminPredicate: FirestoreSessionAdminPredicate = (auth) => DEMO_AUTH_CLAIMS_SERVICE.toRoles((auth?.token ?? {}) as unknown as AuthClaims).has(AUTH_ADMIN_ROLE);

/**
 * Builds the session API config for the demo app.
 *
 * `appCheckAppId` is the registered **web** app from {@link DEMO_FIREBASE_CLIENT_CONFIG} — the same
 * app the Angular client and demo-cli initialize with, since an attestation minted for a different
 * appId is rejected wherever App Check is enforced.
 *
 * It is only supplied outside of tests: `admin.appCheck().createToken()` calls the live App Check
 * backend, which has no emulator, so a test/emulator run would fail the whole handshake on a
 * credential the emulators never verify anyway. `createCliFirestoreSessionContext` likewise skips
 * `initializeAppCheck` when the CLI env targets emulators, so both halves agree.
 *
 * @param envService - The Firebase server environment service, used to detect a test environment.
 * @returns The session module config for this environment.
 */
export function demoSessionApiModuleConfigFactory(envService: FirebaseServerEnvService): SessionApiModuleConfig {
  return {
    ...(envService.isTestingEnv ? undefined : { appCheckAppId: DEMO_FIREBASE_CLIENT_CONFIG.appId })
  };
}

/**
 * Dependency module for {@link DemoSessionApiModule}.
 *
 * Imports {@link DemoApiAuthModule} to match the sibling API modules' shape (the session service
 * itself only needs `FIREBASE_APP_TOKEN`, which `nestServerInstance` provides globally).
 */
@Module({
  imports: [DemoApiAuthModule],
  providers: [
    {
      provide: SessionApiModuleConfig,
      useFactory: demoSessionApiModuleConfigFactory,
      inject: [FirebaseServerEnvService]
    },
    {
      provide: FIRESTORE_SESSION_ADMIN_PREDICATE,
      useValue: demoFirestoreSessionAdminPredicate
    }
  ],
  exports: [SessionApiModuleConfig, FIRESTORE_SESSION_ADMIN_PREDICATE]
})
export class DemoSessionApiDependencyModule {}

/**
 * Registers the direct-Firestore session controller for the demo app.
 *
 * Route: `GET /api/session/firestore`, authenticated by the OIDC bearer middleware — which requires
 * `FIREBASE_SERVER_SESSION_API_PROTECTED_PATH` to be listed in `DemoApiOidcModule`'s
 * `protectedPaths`.
 */
@Module(
  sessionApiModuleMetadata({
    dependencyModule: DemoSessionApiDependencyModule
  })
)
export class DemoSessionApiModule {}
