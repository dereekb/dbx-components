import { type ModuleMetadata } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { OIDC_ANALYTICS_SERVICE } from './oidc.analytics.handler';
import { FirebaseServerOidcAnalyticsService } from './oidc.analytics.service';
import { FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG, type FirebaseServerOidcAnalyticsConfig } from './oidc.analytics.config';

/**
 * Configuration for {@link appOidcAnalyticsModuleMetadata}.
 */
export interface AppOidcAnalyticsMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional {@link FirebaseServerOidcAnalyticsConfig} provided under
   * {@link FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG}. When omitted, the service uses its defaults.
   */
  readonly oidcAnalyticsConfig?: Maybe<FirebaseServerOidcAnalyticsConfig>;
}

/**
 * Generates NestJS module metadata that registers {@link FirebaseServerOidcAnalyticsService} as the
 * OIDC analytics consumer, aliased to {@link OIDC_ANALYTICS_SERVICE}.
 *
 * Mirrors the convention used by `appMcpAnalyticsModuleMetadata`. Requires no dependency module —
 * `FirebaseServerAnalyticsService` is resolved optionally and is expected to be supplied globally by
 * the app's analytics module.
 *
 * Decorate a `@Global()` module with the result so the `OIDC_ANALYTICS_SERVICE` token is visible to
 * the OIDC controllers and services provided by the app's OIDC module.
 *
 * @param config - Optional metadata + analytics config to merge in.
 * @returns NestJS module metadata providing + exporting the OIDC analytics service and token.
 *
 * @example
 * ```typescript
 * @Global()
 * @Module(appOidcAnalyticsModuleMetadata())
 * export class AppOidcAnalyticsModule {}
 * ```
 */
export function appOidcAnalyticsModuleMetadata(config: AppOidcAnalyticsMetadataConfig = {}): ModuleMetadata {
  const { oidcAnalyticsConfig, imports, exports, providers } = config;
  const configProviders = oidcAnalyticsConfig ? [{ provide: FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG, useValue: oidcAnalyticsConfig }] : [];

  return {
    imports: [...(imports ?? [])],
    exports: [OIDC_ANALYTICS_SERVICE, FirebaseServerOidcAnalyticsService, ...(exports ?? [])],
    providers: [
      FirebaseServerOidcAnalyticsService,
      {
        provide: OIDC_ANALYTICS_SERVICE,
        useExisting: FirebaseServerOidcAnalyticsService
      },
      ...configProviders,
      ...(providers ?? [])
    ]
  };
}
