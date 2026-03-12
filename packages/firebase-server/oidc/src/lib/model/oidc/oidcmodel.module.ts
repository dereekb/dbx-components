import { type ModuleMetadata } from '@nestjs/common';
import { type OidcModelServerActionsContext, oidcModelServerActions, OidcModelServerActions } from './oidcmodel.action.server';
import { OidcClientService } from '../../service/client.service';
import { firebaseServerActionsContext } from '@dereekb/firebase-server';

// MARK: Provider Factories
/**
 * Factory that creates an {@link OidcModelServerActions} instance from the injected {@link OidcClientService}.
 */
export function oidcModelServerActionsFactory(oidcClientService: OidcClientService): OidcModelServerActions {
  const context: OidcModelServerActionsContext = {
    ...firebaseServerActionsContext(),
    oidcClientService
  };

  return oidcModelServerActions(context);
}

// MARK: App OidcModel Module
export interface ProvideAppOidcModelMetadataConfig {
  /**
   * The OidcModule that exports the required OIDC dependencies:
   * - {@link OidcClientService}
   */
  readonly oidcModule: Required<ModuleMetadata>['imports']['0'];
}

/**
 * Convenience function used to generate ModuleMetadata for an app's OidcModelModule.
 *
 * By default this module exports:
 * - OidcModelServerActions
 *
 * @param config
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
        inject: [OidcClientService]
      }
    ]
  };
}
