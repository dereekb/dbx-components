import { type ModuleMetadata, type Provider } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { type FirestoreContext, type SystemStateStoredDataConverterMap, type SystemStateUnknownTypeBehavior } from '@dereekb/firebase';
import { FIREBASE_FIRESTORE_CONTEXT_TOKEN, FirebaseServerFirestoreContextModule } from '@dereekb/firebase-server';
import { SystemStatePrivateFirestoreCollections, systemStatePrivateFirestoreCollection } from './system.private';

// MARK: Config
/**
 * Configuration for the {@link SystemStatePrivateFirestoreCollections} provider.
 */
export abstract class SystemStatePrivateModuleConfig {
  /**
   * Server-only stored-data converters, keyed by SystemStateTypeIdentifier.
   *
   * Secret-bearing converters are built by the app, which owns its own `ConfigService`/env access —
   * the framework never sees the secrets.
   */
  abstract readonly converters: SystemStateStoredDataConverterMap;
  /**
   * Behavior when a document's type has no registered converter. Defaults to `error`.
   */
  abstract readonly unknownTypeBehavior?: Maybe<SystemStateUnknownTypeBehavior>;
}

// MARK: Provider Factories
/**
 * Creates the {@link SystemStatePrivateFirestoreCollections}.
 *
 * This is a bespoke provider rather than a `provideAppFirestoreCollections()` entry because that
 * helper hard-codes a `(context: FirestoreContext) => T` factory and cannot carry the converters
 * (and therefore the encryption secrets) this collection needs.
 *
 * @param firestoreContext - The Firestore context.
 * @param config - The module configuration carrying the server-only converters.
 * @returns The server-only collections.
 */
export function systemStatePrivateFirestoreCollectionsFactory(firestoreContext: FirestoreContext, config: SystemStatePrivateModuleConfig): SystemStatePrivateFirestoreCollections {
  return {
    systemStatePrivateCollection: systemStatePrivateFirestoreCollection({
      firestoreContext,
      converters: config.converters,
      unknownTypeBehavior: config.unknownTypeBehavior
    })
  };
}

// MARK: Module
/**
 * Configuration for {@link appSystemStatePrivateModuleMetadata}.
 */
export interface ProvideAppSystemStatePrivateModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Provider for {@link SystemStatePrivateModuleConfig}.
   *
   * The app declares this so it can inject its own `ConfigService`/env service and build each
   * secret-bearing converter itself.
   */
  readonly configProvider: Provider;
}

/**
 * Generates NestJS {@link ModuleMetadata} for an app's server-only SystemState module.
 *
 * IMPORTANT: do NOT add {@link SystemStatePrivateFirestoreCollections} to an app's shared
 * `FirestoreCollections` class. Keeping it on its own provider is what stops the private collection
 * from reaching client-shared code.
 *
 * @param config - The app's config provider plus optional additional module metadata.
 * @returns Module metadata ready for the `@Module()` decorator.
 *
 * @example
 * ```typescript
 * @Module(
 *   appSystemStatePrivateModuleMetadata({
 *     configProvider: {
 *       provide: SystemStatePrivateModuleConfig,
 *       useFactory: myConfigFactory,
 *       inject: [ConfigService, FirebaseServerEnvService]
 *     },
 *     imports: [ConfigModule]
 *   })
 * )
 * export class AppSystemStatePrivateModule {}
 * ```
 */
export function appSystemStatePrivateModuleMetadata(config: ProvideAppSystemStatePrivateModuleMetadataConfig): ModuleMetadata {
  const { configProvider, imports, exports: configExports, providers } = config;

  return {
    imports: [FirebaseServerFirestoreContextModule, ...(imports ?? [])],
    providers: [
      configProvider,
      {
        provide: SystemStatePrivateFirestoreCollections,
        useFactory: systemStatePrivateFirestoreCollectionsFactory,
        inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN, SystemStatePrivateModuleConfig]
      },
      ...(providers ?? [])
    ],
    exports: [SystemStatePrivateFirestoreCollections, SystemStatePrivateModuleConfig, ...(configExports ?? [])]
  };
}
