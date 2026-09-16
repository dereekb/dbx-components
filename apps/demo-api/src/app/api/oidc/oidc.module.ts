import { Logger, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AUTH_ADMIN_ROLE, type AuthClaims, cachedGetter } from '@dereekb/util';
import { CLI_TOKEN_OIDC_SCOPE, type CreateOidcClientParams, EMAIL_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE, OPENID_OIDC_SCOPE, PROFILE_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import {
  CLI_TOKEN_ADMIN_PREDICATE,
  CliTokenApiModuleConfig,
  FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH,
  FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH,
  JwksServiceStorageConfig,
  type CliTokenAdminPredicate,
  type OidcAccountClaims,
  OidcAccountService,
  OidcClientService,
  oidcModuleMetadata,
  type OidcAccountServiceDelegate,
  type OidcProviderConfig
} from '@dereekb/firebase-server/oidc';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';
import { DemoApiAuthService, DemoApiFirestoreModule, DemoApiStorageModule } from '../../common/firebase';
import { FIREBASE_SERVER_SESSION_API_PROTECTED_PATH, FirebaseServerEnvService, type FirebaseServerAuthUserContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { DEMO_APP_OAUTH_INTERACTION_PATH, DEMO_AUTH_CLAIMS_SERVICE, DEMO_OIDC_PROVIDER_PROFILES, DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, demoOidcProviderProfiles, type DemoApiAuthClaims, type DemoOidcScope } from 'demo-firebase';

/**
 * Environment variable naming the registered OAuth client the CLI-token mint issues credentials for
 * — the same `client_id` `demo-cli auth setup` was configured with.
 *
 * Absent ⇒ `POST /oidc/cli-token` is disabled. There is no safe default: minting against the wrong
 * client hands the CLI a refresh token its own `client_id` cannot redeem (a refresh token is
 * client-bound).
 */
export const DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY = 'DEMO_CLI_OIDC_CLIENT_ID';

/**
 * `client_name` of the OAuth client provisioned for the CLI outside production.
 *
 * Deliberately declared here rather than reused from `DEMO_CLI_NAME` in the MCP module: that constant
 * is the CLI BINARY's name (it names the download asset and the rendered `demo-cli auth handoff`
 * command), this one is a registered client's display name, and the MCP module already imports this
 * one — reaching the other way would be circular.
 */
export const DEMO_CLI_OIDC_CLIENT_NAME = 'demo-cli';

export type DemoOidcAccountServiceDelegate = OidcAccountServiceDelegate<DemoOidcScope>;

export const DEMO_OIDC_PROVIDER_CONFIG: OidcProviderConfig<DemoOidcScope> = {
  claims: {
    [OPENID_OIDC_SCOPE]: ['sub'],
    [PROFILE_OIDC_SCOPE]: ['name', 'picture'],
    [EMAIL_OIDC_SCOPE]: ['email', 'email_verified'],
    // offline_access grants a refresh token but adds no extra ID-token claims.
    [OFFLINE_ACCESS_OIDC_SCOPE]: [],
    demo: ['sub', ...DEMO_AUTH_CLAIMS_SERVICE.claimKeys],
    // model.* scopes confer authorization for callModel CRUD operations and add no extra ID-token claims.
    'model.create': [],
    'model.read': [],
    'model.update': [],
    'model.delete': [],
    'model.query': [],
    'model.invoke': [],
    // token.service is admin-only and adds no extra ID-token claims; it makes the grant long-lived and non-rotating.
    [SERVICE_TOKEN_OIDC_SCOPE]: [],
    // session.firestore is admin-only and adds no extra ID-token claims; it authorizes
    // `GET /api/session/firestore` to mint a direct-Firestore session (see DemoSessionApiModule).
    [FIRESTORE_SESSION_OIDC_SCOPE]: [],
    // token.cli confers authorization for `POST /oidc/cli-token` and adds no extra ID-token claims.
    // It is gated by the admin-only `cli-handoff` provider profile rather than by `adminOnlyScopes`
    // below — that array ALSO selects the 365-day service-token TTL tier, and a scope whose whole
    // point is a <=1h credential must never widen the session that carries it.
    [CLI_TOKEN_OIDC_SCOPE]: [],
    // lms / reports are provider-profile-gated (see DEMO_OIDC_PROVIDER_PROFILES) — supported/issuable but
    // only obtainable by a client whose assigned profile unlocks them. They add no extra ID-token claims.
    lms: [],
    reports: []
  },
  responseTypes: ['code'],
  grantTypes: ['authorization_code', 'refresh_token'],
  // Scopes restricted to admins: withheld from a non-admin's consent screen entirely, and
  // hard-rejected with `access_denied` if a consent submit names one anyway.
  //
  // session.firestore is here because the session it unlocks mints a Firebase custom token plus a
  // valid web-app App Check attestation — that has to be admin-gated at consent, not just at the
  // endpoint. Note the endpoint's own FIRESTORE_SESSION_ADMIN_PREDICATE is the load-bearing check:
  // a non-OIDC caller (a plain Firebase ID token) carries no `scope` claim at all.
  adminOnlyScopes: [SERVICE_TOKEN_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE],
  // Only token.service disables refresh-token rotation. A session.firestore grant is an ordinary
  // interactive grant that happens to be admin-only.
  nonRotatingScopes: [SERVICE_TOKEN_OIDC_SCOPE],
  // Provider profiles gate the lms/reports scopes to clients an admin has assigned the profile to.
  providerProfiles: DEMO_OIDC_PROVIDER_PROFILES
};

// MARK: Factories
/**
 * Builds the demo app's OIDC provider config for the running environment.
 *
 * Identical to {@link DEMO_OIDC_PROVIDER_CONFIG} except for the provider profiles, whose CLI-handoff
 * entry becomes a default profile outside production.
 *
 * @param envService - The Firebase server environment service, read for {@link FirebaseServerEnvService.isProduction}.
 * @returns The provider config to supply to the OidcAccountService delegate.
 */
export function demoOidcProviderConfigForEnv(envService: FirebaseServerEnvService): OidcProviderConfig<DemoOidcScope> {
  // Outside production the admin-only `cli-handoff` profile is a DEFAULT profile, so every client —
  // including the connector an agent registers for itself via DCR, whose client_id nobody can predict
  // — resolves to it and can request `token.cli` with no manual assignment step. The profile is still
  // `adminOnly`, so a non-admin is refused at the consent gate exactly as in production; only the
  // per-client assignment goes away.
  //
  // `isProduction` (not `!isTestingEnv`) is the right check: it is false for both a local emulator
  // serve and a test run, and true for staging, so a deployed environment keeps the assignment gate.
  return { ...DEMO_OIDC_PROVIDER_CONFIG, providerProfiles: demoOidcProviderProfiles({ unlockCliHandoffByDefault: !envService.isProduction }) };
}

/**
 * Creates the OidcAccountService for the demo API, configuring how OIDC claims
 * are built from Firebase Auth user records and custom auth claims.
 * Supports the openid, profile, email, and demo scopes.
 *
 * @param demoApiAuthService - The demo auth service used as the underlying auth provider.
 * @param envService - The Firebase server environment service, used to resolve the provider profiles.
 * @returns An OidcAccountService configured with the demo-specific claim builder.
 */
export function demoOidcAccountServiceFactory(demoApiAuthService: DemoApiAuthService, envService: FirebaseServerEnvService): OidcAccountService {
  const delegate: DemoOidcAccountServiceDelegate = {
    providerConfig: demoOidcProviderConfigForEnv(envService),
    async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<DemoOidcScope>): Promise<OidcAccountClaims> {
      const user = await userContext.loadRecord();
      const claims: OidcAccountClaims = { sub: user.uid };

      if (scopes.has(PROFILE_OIDC_SCOPE)) {
        if (user.displayName) {
          claims.name = user.displayName;
        }

        if (user.photoURL) {
          claims.picture = user.photoURL;
        }
      }

      if (scopes.has(EMAIL_OIDC_SCOPE) && user.email) {
        claims.email = user.email;
        claims.email_verified = user.emailVerified ?? false;
      }

      if (scopes.has('demo')) {
        const authClaims = await userContext.loadClaims<DemoApiAuthClaims>();
        Object.assign(claims, DEMO_AUTH_CLAIMS_SERVICE.copyClaims(authClaims));
      }

      return claims;
    },
    // Resolve admin status from the raw auth claims directly — independent of the requested
    // scopes (the `demo`-scope gate in buildClaimsForUser would otherwise hide admin from a
    // token.service request that didn't also ask for `demo`).
    async isAdminUser(userContext: FirebaseServerAuthUserContext): Promise<boolean> {
      const authClaims = await userContext.loadClaims<DemoApiAuthClaims>();
      return DEMO_AUTH_CLAIMS_SERVICE.toRoles(authClaims).has(AUTH_ADMIN_ROLE);
    }
  };

  return new OidcAccountService(demoApiAuthService, delegate);
}

/**
 * Creates the JWKS storage config pointing to the jwks.json file in Firebase Storage.
 * The OIDC provider uses this to persist and retrieve its signing key set.
 *
 * @param firebaseServerStorageService - The Firebase storage service for accessing cloud storage files.
 * @returns A JwksServiceStorageConfig with the storage accessor file reference.
 */
export function demoJwksServiceStorageConfigFactory(firebaseServerStorageService: FirebaseServerStorageService): JwksServiceStorageConfig {
  return {
    jwksStorageAccessorFile: firebaseServerStorageService.file('jwks.json')
  };
}

/**
 * The load-bearing gate on `POST /oidc/cli-token` for the demo app.
 *
 * A minted credential is a real, refreshable CLI login for the caller's own uid, so it is admin-only
 * — the same reasoning (and the same shape) as `demoFirestoreSessionAdminPredicate`. The `token.cli`
 * scope enforced alongside it is defence in depth: a non-OIDC caller carries no `scope` claim at all.
 *
 * @param auth - The calling request's auth data, or undefined for an unauthenticated request.
 * @returns True when the caller holds the admin role.
 */
const demoCliTokenAdminPredicate: CliTokenAdminPredicate = (auth) => DEMO_AUTH_CLAIMS_SERVICE.toRoles((auth?.token ?? {}) as unknown as AuthClaims).has(AUTH_ADMIN_ROLE);

/**
 * Builds the CLI-token mint config for the demo app.
 *
 * `cliClientId` prefers {@link DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY}. Outside production it falls back to
 * provisioning a CLI client on first mint rather than staying disabled, so a dev checkout needs no
 * configured id; in production an explicit value is still required. `apiBaseUrl` and `envName` are
 * echoed into the handoff bundle so a machine with no prior `auth setup` can bootstrap an env from it
 * alone — and so the redeem names that env after THIS deployment rather than after whatever env
 * happened to be active locally.
 *
 * @param envService - The Firebase server environment service, used for the API base URL.
 * @param moduleRef - Used to lazily resolve `OidcClientService` when provisioning the development CLI client.
 * @returns The CLI-token module config.
 */
export function demoCliTokenApiModuleConfigFactory(envService: FirebaseServerEnvService, moduleRef: ModuleRef): CliTokenApiModuleConfig {
  const logger = new Logger('demoCliTokenApiModuleConfig');
  const apiBaseUrl = envService.appApiUrl;

  // Provisioned ON FIRST MINT, not at boot: nothing runs during startup, and a dev checkout never has
  // to be told a client_id. The id is the provider's own generated value, so it is not guessable, and
  // it is written back to the env var so every later mint in this process reuses the one client.
  //
  // Memoized rather than per-mint so repeated mints share a client. A server restart provisions a
  // fresh one, which is fine in dev — the handoff bundle carries `clientId` back to the CLI, so the
  // CLI is always told which client its credential is bound to and never has to have guessed it.
  const resolveDevCliClientId = cachedGetter(async () => {
    // Resolved LAZILY rather than injected: `OidcClientService` is provided by the OIDC module, which
    // imports THIS module as its `dependencyModule` — injecting it into this provider is a
    // construction-time cycle Nest rejects outright ("can't resolve dependencies of the
    // CliTokenApiModuleConfig"). Nothing here runs until the first mint, by which point the OIDC
    // module is fully constructed and a non-strict lookup resolves cleanly.
    const oidcClientService = moduleRef.get(OidcClientService, { strict: false });
    const created = await oidcClientService.createClient({
      client_name: DEMO_CLI_OIDC_CLIENT_NAME,
      // loopback, port-agnostic: the CLI never runs this leg (it redeems a claim code instead), but a
      // registered client still needs a redirect_uri to be valid.
      redirect_uris: ['http://127.0.0.1:0/callback'],
      token_endpoint_auth_method: 'none'
    } as CreateOidcClientParams);

    process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY] = created.client_id;
    logger.log(`Provisioned a development CLI OAuth client (${created.client_id}) for the CLI-token mint.`);
    return created.client_id;
  });

  return {
    // Read from `process.env` per ACCESS rather than captured at boot, so the client id is resolved
    // from the live environment each time a mint runs. A value set after the DI graph was built — a
    // test harness, a `--set-env-vars` update between cold starts — is then picked up without
    // rebuilding the module graph. Deliberately NOT ConfigService: nothing else in this app injects
    // it, and its snapshot is taken at boot, which is exactly the case this resolver exists to cover.
    //
    // In production an explicit value is still REQUIRED: minting against an auto-created client would
    // hand the CLI a credential the deployed `auth setup` cannot refresh, so it stays disabled instead.
    cliClientId: () => process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY] || (envService.isProduction ? undefined : resolveDevCliClientId()),
    ...(apiBaseUrl ? { apiBaseUrl } : undefined),
    // Deliberately NOT `local` / `prod`: a redeem writes the env wholesale, so naming it after the
    // hand-managed env would overwrite a developer's own `local` with a one-hour credential. The
    // `-mcp` names are registered as ALIASES of the same demo-cli presets (env.defaults.ts), so this
    // env stays separate while still inheriting their `firebase` block and `appClientUrl`.
    envName: envService.isProduction ? 'prod-mcp' : 'dev-mcp'
  };
}

@Module({
  imports: [DemoApiAuthModule, DemoApiStorageModule, DemoApiFirestoreModule],
  exports: [DemoApiFirestoreModule, OidcAccountService, JwksServiceStorageConfig, CliTokenApiModuleConfig, CLI_TOKEN_ADMIN_PREDICATE],
  providers: [
    {
      provide: OidcAccountService,
      useFactory: demoOidcAccountServiceFactory,
      inject: [DemoApiAuthService, FirebaseServerEnvService]
    },
    {
      provide: JwksServiceStorageConfig,
      useFactory: demoJwksServiceStorageConfigFactory,
      inject: [FirebaseServerStorageService]
    },
    {
      provide: CliTokenApiModuleConfig,
      useFactory: demoCliTokenApiModuleConfigFactory,
      inject: [FirebaseServerEnvService, ModuleRef]
    },
    {
      provide: CLI_TOKEN_ADMIN_PREDICATE,
      useValue: demoCliTokenAdminPredicate
    }
  ]
})
export class DemoApiOidcDependencyModule {}

@Module(
  oidcModuleMetadata({
    dependencyModule: DemoApiOidcDependencyModule,
    config: {
      suppressBodyParserWarning: true,
      // FIREBASE_SERVER_SESSION_API_PROTECTED_PATH ('/api/session') is required by
      // DemoSessionApiModule — the session controller reads `req.auth`, which only this bearer
      // middleware populates.
      protectedPaths: ['/api/model', '/mcp', FIREBASE_SERVER_SESSION_API_PROTECTED_PATH, FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH],
      // `POST /oidc/cli-token/claim` is UNAUTHENTICATED BY DESIGN — the one-time claim code IS the
      // credential, and the machine redeeming it has none yet. Protection matches by prefix, so
      // without this exclusion the `/oidc/cli-token` entry above would 401 exactly the callers the
      // handoff exists for. Do NOT "fix" this by deleting the line.
      unprotectedPaths: [FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH],
      appOAuthInteractionPath: DEMO_APP_OAUTH_INTERACTION_PATH,
      tokenEndpointAuthMethods: DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS,
      configureMcpResourceServer: true,
      // Cross-origin browser relying parties. The explicit allowlist reflects a known demo RP
      // origin on every OIDC endpoint (discovery + token); `clientBased` additionally trusts any
      // registered client's redirect_uris origins on the client-assigned routes (e.g. /token), so
      // a browser PKCE client works from its own origin without being added to `allowOrigins`.
      cors: {
        allowOrigins: ['https://rp.test.dereekb.com'],
        clientBased: true
      }
    },
    // `registrationEnabled` (DCR) is unauthenticated and rate-limit-free, so any caller
    // can write Firestore client docs unbounded. Allow it in non-prod (dev, emulator,
    // tests) so Claude/mcp-inspector can self-register, but lock it down in prod —
    // prod clients should be provisioned out-of-band as public PKCE clients
    // (`token_endpoint_auth_method: 'none'`) via `oidcClientService.createClient()`.
    configFactory: (envService) => ({
      registrationEnabled: !envService.isProduction
    })
  })
)
export class DemoApiOidcModule {}
