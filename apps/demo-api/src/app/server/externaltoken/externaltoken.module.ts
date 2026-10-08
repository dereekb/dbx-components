import { Module } from '@nestjs/common';
import { AUTH_ADMIN_ROLE, type Maybe } from '@dereekb/util';
import { type OidcEntryClientId } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE, UserExternalConnectionTokenApiModuleConfig, type UserExternalConnectionTokenPredicate, userExternalConnectionTokenApiModuleMetadata } from '@dereekb/firebase-server/model';
import { DemoApiApiModule } from '../../api/api.module';
import { DemoApiAuthService } from '../../common/firebase';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';
import { UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * Environment variable listing the OIDC client ids allowed to mint external connection tokens: the
 * `client_id`(s) demo-cli's `external-token` env was set up with (`demo-cli auth setup --env
 * external-token --client-id <id>`), comma-separated.
 *
 * Read per mint rather than at boot, like `DEMO_CLI_OIDC_CLIENT_ID`, so a value set after the module
 * graph was built (a test harness, an env update between cold starts) applies without a rebuild.
 *
 * Absent or blank:
 * - in production, NO client may mint — there is no safe default, the allowlist is part of the gate;
 * - outside production (local emulators, tests), any OIDC client may — the admin predicate, the
 *   admin-only `external-token` profile assignment and the `token.external` scope still apply.
 */
export const DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY = 'DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS';

/**
 * Reads {@link DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY} from the live environment.
 *
 * @returns The configured client ids, or undefined when the variable is absent or lists none.
 */
export function readDemoExternalConnectionTokenAllowedClientIds(): Maybe<OidcEntryClientId[]> {
  const clientIds = (process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  return clientIds.length > 0 ? clientIds : undefined;
}

/**
 * Creates the load-bearing gate on `GET /api/session/external/:providerType` for the demo app: admins
 * only.
 *
 * A minted token reaches the caller's own third-party account off-platform, so — like the session and
 * CLI-token predicates — it is admin-only, for every provider. (The only exportable demo provider,
 * `zoho_admin`, is also admin-only to connect, so a non-admin could never hold one anyway.) The
 * `token.external` scope and the client allowlist enforced alongside it are defence in depth.
 *
 * Unlike those predicates it reads the caller's LIVE roles rather than the access token's claims:
 * account claims are only baked into a token whose grant carries the `demo` scope, and demo-cli's
 * `external-token` env deliberately requests nothing but `openid offline_access token.external`. It
 * also means a demoted admin stops minting at once, rather than when their grant lapses.
 *
 * @param authService - The demo auth service, used to load the caller's current roles.
 * @returns The token predicate.
 */
export function demoExternalConnectionTokenPredicateFactory(authService: DemoApiAuthService): UserExternalConnectionTokenPredicate {
  return async ({ auth }) => {
    const roles = await authService.userContext(auth.uid).loadRoles();
    return roles.has(AUTH_ADMIN_ROLE);
  };
}

/**
 * Builds the external connection token API config for the demo app.
 *
 * Only the client allowlist is configured, from {@link DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY};
 * the minimum remaining lifetime and the required scope (`token.external`) keep their defaults, and
 * non-OIDC callers (a plain Firebase ID token, which carries neither a scope nor a client id) stay
 * refused.
 *
 * @param envService - The Firebase server environment service, used to decide what an unset allowlist means.
 * @returns The token module config.
 */
export function demoExternalConnectionTokenApiModuleConfigFactory(envService: FirebaseServerEnvService): UserExternalConnectionTokenApiModuleConfig {
  const isProduction = envService.isProduction;

  return {
    allowedClientIds: (clientId) => {
      const allowedClientIds = readDemoExternalConnectionTokenAllowedClientIds();
      return allowedClientIds == null ? !isProduction : allowedClientIds.includes(clientId);
    }
  };
}

/**
 * Dependency module for {@link DemoExternalConnectionTokenApiModule}.
 *
 * Re-exports {@link DemoApiApiModule} for the connection reader and the OAuth provider registry (which
 * supplies each provider's exportable `extra` keys), and {@link UserExternalConnectionModule} for the
 * provider policy registry (the `tokenExport` opt-in). Neither imports anything under `server/`, so
 * there is no cycle. {@link DemoApiAuthModule} supplies the auth service the admin predicate reads
 * roles through.
 */
@Module({
  imports: [DemoApiAuthModule, DemoApiApiModule, UserExternalConnectionModule],
  providers: [
    {
      provide: UserExternalConnectionTokenApiModuleConfig,
      useFactory: demoExternalConnectionTokenApiModuleConfigFactory,
      inject: [FirebaseServerEnvService]
    },
    {
      provide: USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE,
      useFactory: demoExternalConnectionTokenPredicateFactory,
      inject: [DemoApiAuthService]
    }
  ],
  exports: [DemoApiApiModule, UserExternalConnectionModule, UserExternalConnectionTokenApiModuleConfig, USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE]
})
export class DemoExternalConnectionTokenApiDependencyModule {}

/**
 * Registers the external connection token controller for the demo app, which mints an admin's
 * `zoho_admin` access token out to `zoho-cli` (through `demo-cli external-token zoho_admin`).
 *
 * Route: `GET /api/session/external/:providerType`, authenticated by the OIDC bearer middleware — it
 * sits under `FIREBASE_SERVER_SESSION_API_PROTECTED_PATH`, which `DemoApiOidcModule` already protects.
 */
@Module(
  userExternalConnectionTokenApiModuleMetadata({
    dependencyModule: DemoExternalConnectionTokenApiDependencyModule
  })
)
export class DemoExternalConnectionTokenApiModule {}
