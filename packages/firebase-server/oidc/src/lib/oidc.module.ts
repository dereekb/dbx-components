import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwksService, JwksServiceConfig } from './service/jwks.service';
import { OidcProviderConfigService } from './service/oidc.config.service';
import { OidcModuleConfig, DEFAULT_OIDC_TOKEN_LIFETIMES } from './oidc.config';
import { OidcService } from './service/oidc.service';
import { OidcWellKnownController, OidcInteractionController, OidcProviderController } from './controller';
import { OidcFirestoreCollections, jwksKeyFirestoreCollection, oidcAdapterEntryFirestoreCollection } from './model';
import { FIREBASE_FIRESTORE_CONTEXT_TOKEN, FirebaseServerFirestoreContextModule, FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecret, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { type FirestoreContext } from '@dereekb/firebase';
import { hasHttpPrefix } from '@dereekb/util';
import { ConfigureOidcAuthMiddlewareModule, OidcAuthMiddlewareConfig } from './middleware/oauth-auth.module';

// MARK: Environment Variable Keys
/**
 * Environment variable name for the JWKS encryption secret (hex-encoded AES-256 key).
 *
 * Used for encrypting private keys at rest in Firestore.
 */
export const OIDC_JWKS_ENCRYPTION_SECRET_ENV_KEY = 'OIDC_JWKS_ENCRYPTION_SECRET';

/**
 * Environment variable name for the OIDC issuer path prefix. You typically don't have to update this.
 *
 * Optional. If set, is appended to the appUrl to form the issuer URL.
 * Defaults to '/oidc'.
 */
export const OIDC_ISSUER_PATH_ENV_KEY = 'OIDC_ISSUER_PATH';

export const DEFAULT_OIDC_ISSUER_PATH = '/oidc';

/**
 * Route patterns for OIDC controllers that should be excluded from a global API route prefix.
 *
 * Typically fox dbx-components we set all the routes in the NestJS app to have a global prefix (e.g., '/api').
 * For `firebase-server/oidc` we exclude the routes here so that the global prefix doesn't affect the OIDC routes.
 *
 * Use with `globalApiRoutePrefix.exclude` in {@link NestServerInstanceConfig}.
 */
export const FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = ['.well-known/(.*)', 'oidc/(.*)', 'interaction/(.*)'];

// MARK: Provider Factories
/**
 * Factory that builds {@link OidcModuleConfig} from environment variables and the app's {@link FirebaseServerEnvService}.
 *
 * Derives the issuer URL from `appUrl` + the optional `OIDC_ISSUER_PATH` env var (defaults to `/oidc`).
 * Reads the JWKS encryption secret from `OIDC_JWKS_ENCRYPTION_SECRET`; in test environments,
 * a deterministic fallback is used.
 *
 * @throws {Error} When `appUrl` is missing, lacks an HTTP prefix, or the encryption secret is invalid.
 */
export function oidcModuleConfigFactory(configService: ConfigService, envService: FirebaseServerEnvService): OidcModuleConfig {
  const appUrl = envService.appUrl;

  if (!appUrl) {
    throw new Error('oidcModuleConfigFactory: appUrl is required on the server environment config.');
  }

  const issuerPath = configService.get<string>(OIDC_ISSUER_PATH_ENV_KEY) ?? DEFAULT_OIDC_ISSUER_PATH;
  const issuer = `${appUrl}${issuerPath}`;

  if (!hasHttpPrefix(issuer)) {
    throw new Error(`oidcModuleConfigFactory: appUrl must have an http(s) prefix. Received: ${appUrl}`);
  }

  const loginUrl = `${appUrl}/oidc/interaction/login`;
  const consentUrl = `${appUrl}/oidc/interaction/consent`;

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
    loginUrl,
    consentUrl,
    tokenLifetimes: DEFAULT_OIDC_TOKEN_LIFETIMES,
    jwksServiceConfig: {
      encryptionSecret
    },
    jwksKeyConverterConfig: {
      encryptionSecret
    }
  } as OidcModuleConfig;

  OidcModuleConfig.assertValidConfig(config);
  return config;
}

/**
 * Factory that creates {@link OidcFirestoreCollections} using the provided Firestore context
 * and JWKS encryption config from {@link OidcModuleConfig}.
 */
export function oidcFirestoreCollectionsFactory(firestoreContext: FirestoreContext, oidcModuleConfig: OidcModuleConfig): OidcFirestoreCollections {
  return {
    jwksKeyCollection: jwksKeyFirestoreCollection({ firestoreContext, ...oidcModuleConfig.jwksKeyConverterConfig }),
    oidcAdapterEntryCollection: oidcAdapterEntryFirestoreCollection({ firestoreContext })
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
   */
  readonly config?: Partial<Pick<OidcModuleConfig, 'suppressBodyParserWarning' | 'renderError' | 'protectedPaths'>>;
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
 * @param metadataConfig
 * @returns
 */
export function oidcModuleMetadata(metadataConfig: ProvideAppOidcModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, config, imports, exports, providers } = metadataConfig;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, FirebaseServerFirestoreContextModule, ConfigureOidcAuthMiddlewareModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [OidcWellKnownController, OidcInteractionController, OidcProviderController],
    exports: [OidcService, ...(exports ?? [])],
    providers: [
      {
        provide: OidcModuleConfig,
        inject: [ConfigService, FirebaseServerEnvService],
        useFactory: (configService: ConfigService, envService: FirebaseServerEnvService) => {
          const moduleConfig = oidcModuleConfigFactory(configService, envService);
          return config ? { ...moduleConfig, ...config } : moduleConfig;
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
        provide: OidcFirestoreCollections,
        useFactory: oidcFirestoreCollectionsFactory,
        inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN, OidcModuleConfig]
      },
      OidcProviderConfigService,
      JwksService,
      OidcService,
      ...(providers ?? [])
    ]
  };
}
