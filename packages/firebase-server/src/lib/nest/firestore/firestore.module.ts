import type * as admin from 'firebase-admin';
import { type InjectionToken, Module, type ModuleMetadata, type Provider } from '@nestjs/common';
import { type FirestoreContext } from '@dereekb/firebase';
import { type ClassLikeType } from '@dereekb/util';
import { googleCloudFirestoreContextFactory } from '../../firestore/firestore';
import { FIREBASE_APP_TOKEN } from '../firebase/firebase.module';

// MARK: Tokens
/**
 * Token to access the Firestore.
 */
export const FIREBASE_FIRESTORE_TOKEN: InjectionToken = 'FIREBASE_FIRESTORE_TOKEN';

/**
 * Token to access the root FirestoreContext for a server.
 */
export const FIREBASE_FIRESTORE_CONTEXT_TOKEN: InjectionToken = 'FIREBASE_FIRESTORE_CONTEXT_TOKEN';

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [
    {
      provide: FIREBASE_FIRESTORE_TOKEN,
      useFactory: (app: admin.app.App) => app.firestore(),
      inject: [FIREBASE_APP_TOKEN]
    }
  ],
  exports: [FIREBASE_FIRESTORE_TOKEN]
})
export class FirebaseServerFirestoreModule {}

/**
 * Nest provider module for firebase that includes the FirebaseServerFirestoreModule and provides a value for FIRESTORE_CONTEXT_TOKEN using the googleCloudFirestoreContextFactory.
 */
@Module({
  imports: [FirebaseServerFirestoreModule],
  providers: [
    {
      provide: FIREBASE_FIRESTORE_CONTEXT_TOKEN,
      useFactory: googleCloudFirestoreContextFactory,
      inject: [FIREBASE_FIRESTORE_TOKEN]
    }
  ],
  exports: [FirebaseServerFirestoreModule, FIREBASE_FIRESTORE_CONTEXT_TOKEN]
})
export class FirebaseServerFirestoreContextModule {}

// MARK: AppFirestoreCollections
/**
 * Factory function that creates an app's Firestore collections instance from a {@link FirestoreContext}.
 */
export type ProvideAppFirestoreCollectionsFactory<T> = (context: FirestoreContext) => T;

/**
 * Configuration for providing an app's Firestore collections class via NestJS DI.
 */
export interface ProvideAppFirestoreCollectionsConfig<T> {
  provide: ClassLikeType<T>;
  useFactory: ProvideAppFirestoreCollectionsFactory<T>;
}

/**
 * Creates a NestJS provider that initializes a Firestore collections instance from the app's {@link FirestoreContext}.
 *
 * @param config - The provide token and factory function configuration.
 * @param config.provide - The class token to provide.
 * @param config.useFactory - Factory that creates the collections from a FirestoreContext.
 * @returns A tuple containing the configured NestJS provider.
 *
 * @example
 * ```typescript
 * const [provider] = provideAppFirestoreCollections({
 *   provide: DemoFirestoreCollections,
 *   useFactory: (context) => new DemoFirestoreCollections(context)
 * });
 * ```
 */
export function provideAppFirestoreCollections<T>({ provide, useFactory }: ProvideAppFirestoreCollectionsConfig<T>): [Provider<T>] {
  return [
    {
      provide,
      useFactory,
      inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN]
    }
  ];
}

// MARK: app firestore module
export interface ProvideAppFirestoreModuleMetadataConfig<T> extends ProvideAppFirestoreCollectionsConfig<T>, Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {}

/**
 * Generates NestJS {@link ModuleMetadata} for an app's Firestore module, including the
 * {@link FirebaseServerFirestoreContextModule} import and the app's collections provider.
 *
 * @param config - The Firestore collections config plus optional additional module metadata.
 * @returns NestJS module metadata ready to be passed to the `@Module()` decorator.
 *
 * @example
 * ```typescript
 * @Module(appFirestoreModuleMetadata({
 *   provide: DemoFirestoreCollections,
 *   useFactory: (context) => new DemoFirestoreCollections(context)
 * }))
 * export class AppFirestoreModule {}
 * ```
 */
export function appFirestoreModuleMetadata<T>(config: ProvideAppFirestoreModuleMetadataConfig<T>): ModuleMetadata {
  return {
    imports: [FirebaseServerFirestoreContextModule, ...(config.imports ?? [])],
    exports: [FirebaseServerFirestoreContextModule, config.provide, ...(config.exports ?? [])],
    providers: [...provideAppFirestoreCollections(config), ...(config.providers ?? [])]
  };
}
