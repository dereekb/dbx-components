import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AppFormSpaceTypeConfigService, appFormSpaceTypeConfigService, type FormSpaceTypeConfig, formSpaceTypeConfigRecord } from '@dereekb/firebase';

/**
 * Configuration for {@link provideDbxFirebaseFormSpaceTypeConfigService}.
 *
 * Either the app's already-built service, or the configs to build one from. An app that exports a single
 * resolved registry — the one its API also reads — should pass THAT, since two registries built from
 * different lists is precisely the drift this service exists to prevent.
 */
export interface ProvideDbxFirebaseFormSpaceTypeConfigServiceConfig {
  readonly service?: AppFormSpaceTypeConfigService;
  readonly configs?: readonly FormSpaceTypeConfig[];
}

/**
 * Provides the app's {@link AppFormSpaceTypeConfigService} to the client.
 *
 * The registry is PURE DATA shared with the server, not a client-side copy of it: the same
 * `FormSpaceTypeConfig` array the API's submit gate reads is what tells the UI a slot is required, how many
 * files it takes, and whether it validates. Providing it is what lets `FormSpaceDocumentStore` report
 * submit blockers, and so what lets a page disable a submit button the server would have refused.
 *
 * Optional. Without it the store's config-dependent observables emit undefined, `isSubmittable$` stays false,
 * and every other part of the FormSpace feature — uploads, listings, removal — works exactly as before.
 *
 * @param config - The service, or the configs to build one from.
 * @returns The environment providers.
 * @throws {Error} When neither a service nor any configs are given.
 *
 * @example
 * ```ts
 * providers: [provideDbxFirebaseFormSpaceTypeConfigService({ service: DEMO_FORM_SPACE_TYPE_CONFIG_SERVICE })]
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxFirebaseFormSpaceTypeConfigService(config: ProvideDbxFirebaseFormSpaceTypeConfigServiceConfig): EnvironmentProviders {
  const { service, configs } = config;

  if (service == null && configs == null) {
    throw new Error('provideDbxFirebaseFormSpaceTypeConfigService(): pass either a service or the configs to build one from.');
  }

  const useValue = service ?? appFormSpaceTypeConfigService(formSpaceTypeConfigRecord([...(configs as FormSpaceTypeConfig[])]));

  return makeEnvironmentProviders([
    {
      provide: AppFormSpaceTypeConfigService,
      useValue
    }
  ]);
}
