import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwksServiceConfig } from './jwks/jwks.service';
import { OidcModuleConfig } from './oidc.config';
import { JwksFirestoreCollections, JwksKeyConverterConfig, jwksKeyFirestoreCollection } from './model';
import { FIREBASE_FIRESTORE_CONTEXT_TOKEN, FirebaseServerFirestoreContextModule } from '@dereekb/firebase-server';
import { FirestoreContext } from '@dereekb/firebase';

// MARK: Provider Factories
export function oidcModuleConfigFactory(configService: ConfigService): OidcModuleConfig {
  const config: OidcModuleConfig = {
    jwksServiceConfig: {} as any, // TODO
    jwksKeyConverterConfig: {} as any // TODO, pull from environment variables.
  };

  OidcModuleConfig.assertValidConfig(config);
  return config;
}

export function jwksFirestoreCollectionsFactory(firestoreContext: FirestoreContext, oidcModuleConfig: OidcModuleConfig): JwksFirestoreCollections {
  return {
    jwksKeyCollection: jwksKeyFirestoreCollection({ firestoreContext, ...oidcModuleConfig.jwksKeyConverterConfig })
  };
}

// MARK: App Oidc Module
export interface ProvideAppOidcModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule: Required<ModuleMetadata>['imports']['0'];
}

/**
 * Convenience function used to generate ModuleMetadata for an app's OidcModule.
 *
 * The OidcModule requires the following dependencies in order to initialze properly:
 * - FIREBASE_FIRESTORE_CONTEXT_TOKEN
 * - OIDC_ACCOUNT_SERVICE_TOKEN
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function oidcModuleMetadata(config: ProvideAppOidcModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [...(exports ?? [])],
    providers: [
      {
        provide: OidcModuleConfig,
        inject: [ConfigService],
        useFactory: oidcModuleConfigFactory
      },
      {
        provide: JwksServiceConfig,
        useFactory: (x: OidcModuleConfig) => x.jwksServiceConfig,
        inject: [OidcModuleConfig]
      },
      {
        provide: JwksFirestoreCollections,
        useFactory: jwksFirestoreCollectionsFactory,
        inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN]
      },
      // TODO: Controller, etc.
      ...(providers ?? [])
    ]
  };
}
