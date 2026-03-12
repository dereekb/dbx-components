import { Injectable, inject } from '@angular/core';
import { type LabeledValue, type Maybe } from '@dereekb/util';

export const DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH = '/oidc/auth';

/**
 * Abstract configuration class used as a DI token for app-level OIDC settings.
 *
 * Apps provide a concrete implementation via `provideDbxFirebaseOidc()`.
 */
export abstract class DbxFirebaseOidcConfig {
  /** Available scopes for the OIDC provider. Used in scope picker fields. */
  abstract readonly availableScopes: LabeledValue<string>[];
  /** Path to the authorization endpoint. Defaults to '/oidc/auth'. */
  readonly authorizationEndpointPath?: Maybe<string>;
}

/**
 * Service that exposes the app-level OIDC configuration.
 *
 * Inject this service in components to access centralized OIDC settings
 * (scopes, endpoint paths, etc.) without requiring explicit inputs.
 */
@Injectable()
export class DbxFirebaseOidcConfigurationService {
  private readonly config = inject(DbxFirebaseOidcConfig);

  get availableScopes(): LabeledValue<string>[] {
    return this.config.availableScopes;
  }

  get authorizationEndpointPath(): string {
    return this.config.authorizationEndpointPath ?? DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH;
  }
}
