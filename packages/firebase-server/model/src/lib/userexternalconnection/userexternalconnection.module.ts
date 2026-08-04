import { type InjectionToken, type ModuleMetadata, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type FirestoreContext, type FirestoreContextReference, type UserExternalConnectionFirestoreCollections } from '@dereekb/firebase';
import { FIREBASE_FIRESTORE_CONTEXT_TOKEN, FirebaseServerEnvService, FirebaseServerFirestoreContextModule } from '@dereekb/firebase-server';
import { type AES256GCMEncryptionSecret, isValidAES256GCMEncryptionSecret } from '@dereekb/nestjs';
import { type UserExternalConnectionPrivateConverterConfig, UserExternalConnectionServerFirestoreCollections, userExternalConnectionPrivateFirestoreCollection } from './userexternalconnection.private';
import { UserExternalConnectionServerActions, type UserExternalConnectionServerActionsContext, userExternalConnectionServerActions } from './userexternalconnection.action.server';
import { UserExternalConnectionAccessor, userExternalConnectionAccessor } from './userexternalconnection.accessor.service';
import { UserExternalConnectionReader, userExternalConnectionReader } from './userexternalconnection.reader.service';
import { UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionStateCoder, userExternalConnectionOAuthRegistryCredentialsRefresher, userExternalConnectionStateCoderFactory } from './oauth';

// MARK: Environment Variable Keys
/**
 * Environment variable name for the external-connection credentials encryption secret
 * (hex-encoded AES-256 key).
 *
 * IMPORTANT: there is NO key rotation. `firestoreEncryptedField` resolves and validates the key once
 * at converter construction and closes over it, so changing this value makes every existing
 * `uecp` document permanently undecryptable. Treat it as write-once per environment.
 */
export const USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET_ENV_KEY = 'USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET';

/**
 * Deterministic secret used when running in a testing environment and no real secret is configured,
 * so specs never need a live credential.
 *
 * Deliberately distinct from the OIDC JWKS testing secret so a leaked emulator blob is attributable.
 */
export const TESTING_USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET: AES256GCMEncryptionSecret = '5573657220457874726e616c20436f6e6e656374696f6e2054657374204b6579';

// MARK: Config
/**
 * Configuration for the UserExternalConnection server module.
 */
export abstract class UserExternalConnectionModuleConfig {
  abstract readonly userExternalConnectionPrivateConverterConfig: UserExternalConnectionPrivateConverterConfig;
}

/**
 * Builds the {@link UserExternalConnectionModuleConfig} from the environment.
 *
 * @param configService - The Nest config service used to read the encryption secret.
 * @param envService - Used to detect a testing environment for the secret fallback.
 * @returns The module configuration.
 * @throws {Error} When the configured secret is invalid outside a testing environment.
 */
export function userExternalConnectionModuleConfigFactory(configService: ConfigService, envService: FirebaseServerEnvService): UserExternalConnectionModuleConfig {
  let encryptionSecret: AES256GCMEncryptionSecret = configService.get<string>(USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET_ENV_KEY) ?? '';

  if (!isValidAES256GCMEncryptionSecret(encryptionSecret)) {
    if (envService.isTestingEnv) {
      encryptionSecret = TESTING_USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET;
    } else {
      throw new Error(`userExternalConnectionModuleConfigFactory: The secret provided by ${USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET_ENV_KEY} is not valid. Expected a 64-character hexadecimal string.`);
    }
  }

  return {
    userExternalConnectionPrivateConverterConfig: {
      encryptionSecret
    }
  };
}

// MARK: Provider Factories
/**
 * Creates the {@link UserExternalConnectionServerFirestoreCollections}.
 *
 * This is a bespoke provider rather than a `provideAppFirestoreCollections()` entry because that
 * helper hard-codes a `(context: FirestoreContext) => T` factory and cannot carry the encryption
 * secret this collection needs.
 *
 * @param firestoreContext - The Firestore context.
 * @param config - The module configuration carrying the encryption secret.
 * @returns The server-only collections.
 */
export function userExternalConnectionServerFirestoreCollectionsFactory(firestoreContext: FirestoreContext, config: UserExternalConnectionModuleConfig): UserExternalConnectionServerFirestoreCollections {
  return {
    userExternalConnectionPrivateCollection: userExternalConnectionPrivateFirestoreCollection({ firestoreContext, ...config.userExternalConnectionPrivateConverterConfig })
  };
}

/**
 * Assembles the {@link UserExternalConnectionServerActionsContext} from the app-supplied public
 * collections and the module-owned private collection.
 *
 * @param appCollections - The app's collections, carrying the public UserExternalConnection collection.
 * @param serverCollections - The module-owned private collection.
 * @returns The assembled server actions context.
 */
export function userExternalConnectionServerActionsContextFactory(appCollections: UserExternalConnectionFirestoreCollections & FirestoreContextReference, serverCollections: UserExternalConnectionServerFirestoreCollections): UserExternalConnectionServerActionsContext {
  return {
    firestoreContext: appCollections.firestoreContext,
    userExternalConnectionCollection: appCollections.userExternalConnectionCollection,
    userExternalConnectionPrivateCollection: serverCollections.userExternalConnectionPrivateCollection
  };
}

/**
 * NestJS injection token for the assembled {@link UserExternalConnectionServerActionsContext}.
 */
export const USER_EXTERNAL_CONNECTION_SERVER_ACTIONS_CONTEXT_TOKEN: InjectionToken = 'USER_EXTERNAL_CONNECTION_SERVER_ACTIONS_CONTEXT';

// MARK: App UserExternalConnection Module
export interface ProvideAppUserExternalConnectionModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the app's collections token. When provided, it is automatically included in
   * the generated `imports` array.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * Token that resolves the app's collections — anything implementing both
   * `UserExternalConnectionFirestoreCollections` and `FirestoreContextReference`.
   *
   * Taking this as a token is what keeps the package from ever naming an app's collections class.
   */
  readonly appCollectionsToken: InjectionToken;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's UserExternalConnectionModule.
 *
 * By default this module exports:
 * - UserExternalConnectionServerActions
 * - UserExternalConnectionAccessor
 * - UserExternalConnectionServerFirestoreCollections
 * - UserExternalConnectionModuleConfig
 * - UserExternalConnectionStateCoder
 *
 * NOTE what is absent: `UserExternalConnectionReader`. The reader can be configured with a refresher,
 * and the only refresher an app normally wants is backed by the OAuth provider registry — which this
 * module cannot see without importing the provider modules that import it. Provide the reader with
 * `userExternalConnectionReaderProvider()` from wherever the registry is declared.
 *
 * @param config - The module configuration.
 * @returns The assembled {@link ModuleMetadata}.
 */
export function appUserExternalConnectionModuleMetadata(config: ProvideAppUserExternalConnectionModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, appCollectionsToken, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, FirebaseServerFirestoreContextModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [UserExternalConnectionServerActions, UserExternalConnectionAccessor, UserExternalConnectionServerFirestoreCollections, UserExternalConnectionModuleConfig, UserExternalConnectionStateCoder, ...(exports ?? [])],
    providers: [
      {
        provide: UserExternalConnectionModuleConfig,
        useFactory: userExternalConnectionModuleConfigFactory,
        inject: [ConfigService, FirebaseServerEnvService]
      },
      {
        // provider-agnostic: the OAuth `state` is a feature of the authorization-code flow itself,
        // not of any one provider, so every registered provider shares this coder and its secret
        provide: UserExternalConnectionStateCoder,
        useFactory: userExternalConnectionStateCoderFactory,
        inject: [ConfigService, FirebaseServerEnvService]
      },
      {
        provide: UserExternalConnectionServerFirestoreCollections,
        useFactory: userExternalConnectionServerFirestoreCollectionsFactory,
        inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN, UserExternalConnectionModuleConfig]
      },
      {
        provide: USER_EXTERNAL_CONNECTION_SERVER_ACTIONS_CONTEXT_TOKEN,
        useFactory: userExternalConnectionServerActionsContextFactory,
        inject: [appCollectionsToken, UserExternalConnectionServerFirestoreCollections]
      },
      {
        provide: UserExternalConnectionServerActions,
        useFactory: userExternalConnectionServerActions,
        inject: [USER_EXTERNAL_CONNECTION_SERVER_ACTIONS_CONTEXT_TOKEN]
      },
      {
        // the same context the actions are built from already carries both collections, which is all a
        // read needs
        provide: UserExternalConnectionAccessor,
        useFactory: userExternalConnectionAccessor,
        inject: [USER_EXTERNAL_CONNECTION_SERVER_ACTIONS_CONTEXT_TOKEN]
      },
      ...(providers ?? [])
    ]
  };
}

// MARK: Reader Provider
/**
 * Configuration for {@link userExternalConnectionReaderProvider}.
 */
export interface UserExternalConnectionReaderProviderConfig {
  /**
   * Whether to build the reader's refresher from the {@link UserExternalConnectionOAuthProviderRegistry}.
   * Defaults to true.
   *
   * Set false for an app that registers no OAuth provider services — the registry token would not
   * resolve, and a reader with no refresher is still useful for reading.
   */
  readonly refreshWithOAuthProviderRegistry?: Maybe<boolean>;
  /**
   * Overrides how long before its stated expiration a credential is treated as expired.
   */
  readonly expirationBuffer?: Maybe<Milliseconds>;
}

/**
 * Creates the NestJS provider for the {@link UserExternalConnectionReader}.
 *
 * Declared by the app rather than by the UserExternalConnection module, for the same reason
 * {@link userExternalConnectionOAuthProviderRegistryProvider} is: the reader refreshes through the
 * registry, and the registry can only be assembled somewhere that is able to import the provider
 * modules — each of which imports the UserExternalConnection module. Put this beside the registry
 * provider.
 *
 * @param config - Optional configuration. By default the reader refreshes through the registry.
 * @returns The NestJS provider.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionReaderProvider(config?: Maybe<UserExternalConnectionReaderProviderConfig>): Provider {
  const { refreshWithOAuthProviderRegistry, expirationBuffer } = config ?? {};
  const withRegistry = refreshWithOAuthProviderRegistry ?? true;

  return {
    provide: UserExternalConnectionReader,
    useFactory: (accessor: UserExternalConnectionAccessor, actions: UserExternalConnectionServerActions, registry?: Maybe<UserExternalConnectionOAuthProviderRegistry>) =>
      userExternalConnectionReader({
        accessor,
        actions,
        refresher: registry ? userExternalConnectionOAuthRegistryCredentialsRefresher({ registry }) : null,
        expirationBuffer
      }),
    inject: withRegistry ? [UserExternalConnectionAccessor, UserExternalConnectionServerActions, UserExternalConnectionOAuthProviderRegistry] : [UserExternalConnectionAccessor, UserExternalConnectionServerActions]
  };
}
