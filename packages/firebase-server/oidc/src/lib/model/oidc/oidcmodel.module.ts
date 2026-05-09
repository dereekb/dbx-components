import { type ModuleMetadata } from '@nestjs/common';
import { type OidcModelServerActionsContext, oidcModelServerActions, OidcModelServerActions } from './oidcmodel.action.server';
import { OidcClientService } from '../../service/oidc.client.service';
import { OidcService } from '../../service/oidc.service';
import { firebaseServerActionsContext } from '@dereekb/firebase-server';

// MARK: Provider Factories
/**
 * Factory that creates an {@link OidcModelServerActions} instance from the injected services.
 *
 * @param oidcClientService - the OIDC client service for client CRUD actions
 * @param oidcService - the core OIDC service for grant revocation
 * @returns the configured OidcModelServerActions instance
 */
export function oidcModelServerActionsFactory(oidcClientService: OidcClientService, oidcService: OidcService): OidcModelServerActions {
  const context: OidcModelServerActionsContext = {
    ...firebaseServerActionsContext(),
    oidcClientService,
    oidcService
  };

  return oidcModelServerActions(context);
}

// MARK: App OidcModel Module
export interface ProvideAppOidcModelMetadataConfig {
  /**
   * The OidcModule that exports the required OIDC dependencies:
   * - {@link OidcClientService}
   * - {@link OidcService}
   */
  readonly oidcModule: Required<ModuleMetadata>['imports']['0'];
}

/**
 * Convenience function used to generate ModuleMetadata for an app's OidcModelModule.
 *
 * By default this module exports:
 * - OidcModelServerActions
 *
 * @param config - the configuration specifying the OIDC module dependency
 * @returns the NestJS module metadata for the OidcModel module
 */
export function appOidcModelModuleMetadata(config: ProvideAppOidcModelMetadataConfig): ModuleMetadata {
  const { oidcModule } = config;

  return {
    imports: [oidcModule],
    exports: [OidcModelServerActions],
    providers: [
      {
        provide: OidcModelServerActions,
        useFactory: oidcModelServerActionsFactory,
        inject: [OidcClientService, OidcService]
      }
    ]
  };
}
