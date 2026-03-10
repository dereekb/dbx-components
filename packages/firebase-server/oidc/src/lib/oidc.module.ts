import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwksService, JwksServiceConfig } from './service/jwks.service';
import { OidcModuleConfig } from './oidc.config';
import { OidcService } from './service/oidc.service';
import { OidcWellKnownController, OidcInteractionController } from './oidc.controller';
import { OidcFirestoreCollections, jwksKeyFirestoreCollection, oidcAdapterEntryFirestoreCollection } from './model';
import { FIREBASE_FIRESTORE_CONTEXT_TOKEN, FirebaseServerFirestoreContextModule } from '@dereekb/firebase-server';
import { type FirestoreContext } from '@dereekb/firebase';

// MARK: Provider Factories
export function oidcModuleConfigFactory(configService: ConfigService): OidcModuleConfig {
  const config: OidcModuleConfig = {
    jwksServiceConfig: {} as any, // TODO
    jwksKeyConverterConfig: {} as any // TODO, pull from environment variables.
  } as any;

  OidcModuleConfig.assertValidConfig(config);
  return config;
}

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
}

/**
 * Convenience function used to generate ModuleMetadata for an app's OidcModule.
 *
 * The OidcModule requires the following dependencies in order to initialize properly:
 * - FIREBASE_FIRESTORE_CONTEXT_TOKEN
 * - OIDC_ACCOUNT_SERVICE_TOKEN
 *
 * @param config
 * @returns
 */
export function oidcModuleMetadata(config: ProvideAppOidcModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, FirebaseServerFirestoreContextModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [OidcWellKnownController, OidcInteractionController],
    exports: [OidcService, ...(exports ?? [])],
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
        provide: OidcFirestoreCollections,
        useFactory: oidcFirestoreCollectionsFactory,
        inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN, OidcModuleConfig]
      },
      JwksService,
      OidcService,
      ...(providers ?? [])
    ]
  };
}
