import { type EnvironmentProviders, type Provider, type Type, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { type Maybe } from '@dereekb/util';
import { DbxAuthImpersonationService } from './impersonation.service';
import { type DbxAuthImpersonationDelegate, provideDbxAuthImpersonationDelegate } from './impersonation.details';
import { DbxAppAuthImpersonationEffects } from '../state/effect/impersonation.effect';

/**
 * Configuration for {@link provideDbxAuthImpersonation}.
 */
export interface ProvideDbxAuthImpersonationConfig {
  /**
   * When true, registers the {@link DbxAppAuthImpersonationEffects} bridge that mirrors the service's
   * lifecycle into the `app.auth` impersonation NgRx slice. Defaults to false.
   */
  readonly ngrx?: Maybe<boolean>;
  /**
   * Optional {@link DbxAuthImpersonationDelegate} implementation used to load the impersonated user's details.
   */
  readonly delegateType?: Maybe<Type<DbxAuthImpersonationDelegate>>;
}

/**
 * Opt-in provider that enables the impersonation ("view as another user") feature.
 *
 * Registers {@link DbxAuthImpersonationService} (and the optional details delegate / NgRx bridge effect).
 * The route trigger {@link DbxAuthImpersonationTriggerDirective} is standalone and imported where used.
 *
 * The impersonation NgRx reducer slice itself is always registered by `provideDbxAppAuthState()`; this
 * provider only adds the service, the optional delegate, and (when `ngrx` is set) the effect that feeds the slice.
 *
 * @param config - Optional configuration.
 * @returns Angular `EnvironmentProviders` for the impersonation feature.
 */
export function provideDbxAuthImpersonation(config?: ProvideDbxAuthImpersonationConfig): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [DbxAuthImpersonationService];

  if (config?.delegateType != null) {
    providers.push(...provideDbxAuthImpersonationDelegate(config.delegateType));
  }

  if (config?.ngrx) {
    providers.push(provideEffects(DbxAppAuthImpersonationEffects));
  }

  return makeEnvironmentProviders(providers);
}
