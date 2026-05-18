import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwksService, JwksServiceConfig } from './service/oidc.jwks.service';
import { OidcModuleConfig, DEFAULT_OIDC_TOKEN_LIFETIMES } from './oidc.config';
import { OidcService } from './service/oidc.service';
import { OidcWellKnownController, OidcInteractionController, OidcProviderController } from './controller';
import { oidcEntryFirestoreCollection, type FirestoreContext } from '@dereekb/firebase';
import { FIREBASE_FIRESTORE_CONTEXT_TOKEN, FirebaseServerFirestoreContextModule, FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecret, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { type Configurable, hasHttpPrefix } from '@dereekb/util';
import { OidcAuthMiddlewareConfig } from './middleware/oauth-auth.module';
import { OidcEncryptionService } from './service/oidc.encryption.service';
import { OidcClientService } from './service/oidc.client.service';
import { OidcProviderConfigService } from './service/oidc.config.service';
import { jwksKeyFirestoreCollection } from './model/jwks/jwks';
import { OidcServerFirestoreCollections } from './model/model';
import { OidcInteractionService } from './service/oidc.interaction.service';

// MARK: Environment Variable Keys
/**
 * Environment variable name for the JWKS encryption secret (hex-encoded AES-256 key).
 *
 * Used for encrypting private keys at rest in Firestore.
 */
export const OIDC_JWKS_ENCRYPTION_SECRET_ENV_KEY = 'OIDC_JWKS_ENCRYPTION_SECRET';

/**
 * Default path appended to `appUrl` to form the OIDC issuer URL.
 *
 * The issuer is the canonical identity of the OIDC provider (e.g., `https://example.com/oidc`).
 * It appears in the `.well-known/openid-configuration` discovery document and is passed
 * to `new Provider(issuer, ...)`. All provider endpoints (auth, token, userinfo, etc.)
 * are served under this path via the {@link OidcProviderController}.
 *
 * This path is also used as the proxy target on the frontend (e.g., `/oidc/**` → backend),
 * so frontend interaction routes must NOT live under this prefix.
 */
export const DEFAULT_OIDC_ISSUER_PATH = '/oidc';

/**
 * Default frontend base path for OAuth interaction pages (login, consent).
 *
 * This is the path prefix on the **frontend app** where the OAuth interaction UI lives.
 * The backend `OidcInteractionController` GET handler redirects the browser here after
 * reading the oidc-provider interaction session.
 *
 * Uses `/oauth/interaction` instead of `/oidc/...` to avoid colliding with the
 * `/oidc/**` proxy rule that forwards requests to the backend OIDC provider.
 *
 * Apps typically override this (e.g., `/demo/oauth`) via {@link ProvideAppOidcModuleMetadataConfig.config}.
 */
export const DEFAULT_APP_OAUTH_INTERACTION_PATH = '/oauth/interaction';

/**
 * Default path part appended to `appOAuthInteractionPath` for the frontend login page.
 *
 * Combined with `appOAuthInteractionPath` to form the full login redirect URL
 * (e.g., `/oauth/interaction/login?uid=...`).
 */
export const DEFAULT_APP_OAUTH_LOGIN_PATH_PART = '/login';

/**
 * Default path part appended to `appOAuthInteractionPath` for the frontend consent page.
 *
 * Combined with `appOAuthInteractionPath` to form the full consent redirect URL
 * (e.g., `/oauth/interaction/consent?uid=...`).
 */
export const DEFAULT_APP_OAUTH_CONSENT_PATH_PART = '/consent';

/**
 * Route patterns for OIDC controllers that should be excluded from a global API route prefix.
 *
 * Typically fox dbx-components we set all the routes in the NestJS app to have a global prefix (e.g., '/api').
 * For `firebase-server/oidc` we exclude the routes here so that the global prefix doesn't affect the OIDC routes.
 *
 * Use with `globalApiRoutePrefix.exclude` in {@link NestServerInstanceConfig}.
 */
export const FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = ['.well-known/{*path}', 'oidc/{*path}', 'interaction/{*path}'];

// MARK: Provider Factories
/**
 * Extracts the origin (protocol + host + port) from `envService.appApiUrl`, when it points at a
 * different origin than `envService.appUrl`. Used to root the OIDC issuer at the API host when
 * the frontend and the OIDC server live on different origins.
 *
 * Returns `undefined` if `appApiUrl` is missing, equal to `appUrl`, or shares its origin — the
 * caller then falls back to `appUrl` (the single-origin default). The compare is on the parsed
 * URL origin so a default `appApiUrl = "${appUrl}/api"` is treated as the same origin.
 *
 * @param envService - The Firebase server environment service.
 * @returns The API origin (no trailing slash) when distinct from the frontend origin, otherwise `undefined`.
 *
 * @example
 * ```typescript
 * // appUrl = 'https://app.example.com', appApiUrl = 'https://app.example.com/api'
 * // → undefined (same origin; fall back to appUrl)
 *
 * // appUrl = 'https://app.example.com', appApiUrl = 'https://api.example.com'
 * // → 'https://api.example.com'
 * ```
 */
function resolveOidcIssuerOriginFromEnv(envService: FirebaseServerEnvService): string | undefined {
  const appUrl = envService.appUrl;
  const appApiUrl = envService.appApiUrl;
  let result: string | undefined;

  if (appUrl && appApiUrl) {
    try {
      const appOrigin = new URL(appUrl).origin;
      const apiOrigin = new URL(appApiUrl).origin;

      if (apiOrigin !== appOrigin) {
        result = apiOrigin;
      }
    } catch {
      // appUrl / appApiUrl validity is enforced elsewhere; ignore parse errors here so the
      // caller's appUrl-based fallback path still runs.
    }
  }

  return result;
}

/**
 * Factory that builds {@link OidcModuleConfig} from environment variables and the app's {@link FirebaseServerEnvService}.
 *
 * Derives the issuer URL from `appUrl` (or, when set to a distinct origin, the origin of `appApiUrl`)
 * plus {@link DEFAULT_OIDC_ISSUER_PATH} (defaults to `/oidc`). Reads the JWKS encryption secret from
 * `OIDC_JWKS_ENCRYPTION_SECRET`; in test environments, a deterministic fallback is used.
 *
 * The issuer can also be overridden directly by passing `issuer` on the `config` block to
 * {@link oidcModuleMetadata}; the override wins over the factory-derived value.
 *
 * @param configService - The NestJS ConfigService for reading environment variables.
 * @param envService - The Firebase server environment service for app URL and env detection.
 * @returns The constructed OidcModuleConfig.
 * @throws {Error} When `appUrl` is missing, the resolved issuer lacks an HTTP prefix, or the encryption secret is invalid.
 */
export function oidcModuleConfigFactory(configService: ConfigService, envService: FirebaseServerEnvService): OidcModuleConfig {
  const appUrl = envService.appUrl;

  if (!appUrl) {
    throw new Error('oidcModuleConfigFactory: appUrl is required on the server environment config.');
  }

  const issuerPath = DEFAULT_OIDC_ISSUER_PATH;
  // The issuer base is the origin where the OIDC server lives. When `appApiUrl` is set on
  // a different origin from `appUrl` (e.g., the frontend lives on `https://app.example.com`
  // while the OIDC server lives on `https://api.example.com`), use its origin so cookies
  // emitted by oidc-provider are scoped to the API host. Otherwise fall back to `appUrl` —
  // the common single-origin case where both the frontend and the OIDC server share a host.
  // Consumers can still override the resolved issuer entirely via the `config.issuer` field
  // on `oidcModuleMetadata({ config: { issuer: ... } })`.
  const issuerBase = resolveOidcIssuerOriginFromEnv(envService) ?? appUrl;
  const issuer = `${issuerBase}${issuerPath}`;

  if (!hasHttpPrefix(issuer)) {
    throw new Error(`oidcModuleConfigFactory: issuer must have an http(s) prefix. Received: ${issuer}`);
  }

  let encryptionSecret: AES256GCMEncryptionSecret = configService.get<string>(OIDC_JWKS_ENCRYPTION_SECRET_ENV_KEY) ?? '';

  if (!isValidAES256GCMEncryptionSecret(encryptionSecret)) {
    if (envService.isTestingEnv) {
      encryptionSecret = `54686520717569636b2062726f776e20f09fa68a206a756d7073206f76657220`;
    } else {
      throw new Error(`oidcModuleConfigFactory: The secret provided by ${OIDC_JWKS_ENCRYPTION_SECRET_ENV_KEY} is not valid. Expected a 64-character hexadecimal string.`);
    }
  }

  const config: OidcModuleConfig = {
    issuer,
    appOAuthLoginUrlPart: DEFAULT_APP_OAUTH_LOGIN_PATH_PART,
    appOAuthConsentUrlPart: DEFAULT_APP_OAUTH_CONSENT_PATH_PART,
    appOAuthInteractionPath: DEFAULT_APP_OAUTH_INTERACTION_PATH,
    tokenLifetimes: DEFAULT_OIDC_TOKEN_LIFETIMES,
    trustProxy: envService.isProduction, // defaults to true in production
    trustProxyInNonProduction: false,
    jwksServiceConfig: {
      encryptionSecret
    },
    jwksKeyConverterConfig: {
      encryptionSecret
    }
  };

  OidcModuleConfig.assertValidConfig(config);
  return config;
}

/**
 * Factory that creates {@link OidcServerFirestoreCollections} using the provided Firestore context
 * and JWKS encryption config from {@link OidcModuleConfig}.
 *
 * @param firestoreContext - The Firestore context for collection creation.
 * @param oidcModuleConfig - The OIDC module config containing JWKS encryption settings.
 * @returns The configured OidcServerFirestoreCollections.
 */
export function oidcFirestoreCollectionsFactory(firestoreContext: FirestoreContext, oidcModuleConfig: OidcModuleConfig): OidcServerFirestoreCollections {
  return {
    jwksKeyCollection: jwksKeyFirestoreCollection({ firestoreContext, ...oidcModuleConfig.jwksKeyConverterConfig }),
    oidcEntryCollection: oidcEntryFirestoreCollection({ firestoreContext })
  };
}

// MARK: App Oidc Module
export interface ProvideAppOidcModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule: Required<ModuleMetadata>['imports']['0'];
  /**
   * Optional overrides to merge into the {@link OidcModuleConfig} produced by the factory.
   *
   * The `issuer` override is honored verbatim and takes precedence over the factory-derived issuer
   * (which is normally built from `envService.appApiUrl` origin ?? `envService.appUrl`). Pass an
   * explicit `issuer` when the consumer wants a canonical issuer URL that does not match either
   * environment URL — e.g., when serving OIDC behind a non-`/oidc` path or under a vanity host.
   */
  readonly config?: Partial<Pick<OidcModuleConfig, 'issuer' | 'suppressBodyParserWarning' | 'renderError' | 'protectedPaths' | 'appOAuthInteractionPath' | 'appOAuthLoginUrlPart' | 'appOAuthConsentUrlPart' | 'tokenEndpointAuthMethods' | 'registrationEnabled' | 'trustProxy' | 'trustProxyInNonProduction' | 'tokenLifetimes' | 'maxRequestedLoginDuration' | 'minRequestedLoginDuration' | 'defaultRequestedLoginDuration'>>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's OidcModule.
 *
 * The OidcModule requires the following dependencies in order to initialize properly:
 * - FIREBASE_FIRESTORE_CONTEXT_TOKEN
 * - OidcAccountService (provided via factory)
 *
 * Additionally, the following may be optionally provided:
 * - JwksServiceStorageConfig
 *
 * @param metadataConfig - The configuration for generating the OIDC module metadata.
 * @returns The NestJS module metadata for the OIDC module.
 */
export function oidcModuleMetadata(metadataConfig: ProvideAppOidcModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, config, imports, exports, providers } = metadataConfig;
  const dependencyModuleImport = [dependencyModule];

  return {
    imports: [ConfigModule, FirebaseServerFirestoreContextModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [OidcWellKnownController, OidcInteractionController, OidcProviderController],
    exports: [OidcClientService, OidcService, OidcModuleConfig, OidcAuthMiddlewareConfig, OidcServerFirestoreCollections, ...(exports ?? [])],
    providers: [
      {
        provide: OidcModuleConfig,
        inject: [ConfigService, FirebaseServerEnvService],
        useFactory: (configService: ConfigService, envService: FirebaseServerEnvService) => {
          const moduleConfig = oidcModuleConfigFactory(configService, envService);
          let result: OidcModuleConfig = moduleConfig;

          if (config) {
            result = { ...moduleConfig, ...config };

            if (config.trustProxyInNonProduction && !envService.isProduction) {
              (result as Configurable<OidcModuleConfig>).trustProxy = true;
            }
          }

          return result;
        }
      },
      {
        provide: OidcAuthMiddlewareConfig,
        useFactory: (x: OidcModuleConfig) => ({ protectedPaths: x.protectedPaths ?? [] }),
        inject: [OidcModuleConfig]
      },
      {
        provide: JwksServiceConfig,
        useFactory: (x: OidcModuleConfig) => x.jwksServiceConfig,
        inject: [OidcModuleConfig]
      },
      {
        provide: OidcServerFirestoreCollections,
        useFactory: oidcFirestoreCollectionsFactory,
        inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN, OidcModuleConfig]
      },
      OidcInteractionService,
      OidcProviderConfigService,
      OidcEncryptionService,
      OidcService,
      JwksService,
      {
        provide: OidcClientService,
        useFactory: (oidcService: OidcService) => new OidcClientService(oidcService),
        inject: [OidcService]
      },
      ...(providers ?? [])
    ]
  };
}
