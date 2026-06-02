import { type InjectionToken } from '@nestjs/common';
import { type OidcAnalyticsEventType } from './oidc.analytics.handler';

/**
 * Default prefix prepended to every resolved OIDC analytics event name forwarded
 * to the downstream analytics pipeline (e.g. `'OIDC ' + 'Login'` → `'OIDC Login'`).
 */
export const DEFAULT_OIDC_ANALYTICS_EVENT_NAME_PREFIX = 'OIDC ';

/**
 * Default per-type downstream event name parts (the {@link DEFAULT_OIDC_ANALYTICS_EVENT_NAME_PREFIX}
 * is prepended at send time).
 */
export const DEFAULT_OIDC_ANALYTICS_EVENT_NAMES: Record<OidcAnalyticsEventType, string> = {
  login: 'Login',
  consent: 'Consent'
};

/**
 * Configuration for {@link FirebaseServerOidcAnalyticsService}.
 *
 * Apps provide this via {@link FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG} (typically through
 * {@link appOidcAnalyticsModuleMetadata}) to tune how OIDC events are named, logged, and forwarded.
 */
export interface FirebaseServerOidcAnalyticsConfig {
  /**
   * The prefix prepended to every resolved event name.
   * Defaults to {@link DEFAULT_OIDC_ANALYTICS_EVENT_NAME_PREFIX}.
   */
  readonly eventNamePrefix?: string;
  /**
   * Per-type overrides for the (unprefixed) event name part. Merged over
   * {@link DEFAULT_OIDC_ANALYTICS_EVENT_NAMES}.
   */
  readonly eventNames?: Partial<Record<OidcAnalyticsEventType, string>>;
  /**
   * Whether to emit a per-event `Logger` line for each OIDC event.
   *
   * Defaults to `true` on non-production environments.
   */
  readonly logEvents?: boolean;
}

/**
 * NestJS injection token for the optional {@link FirebaseServerOidcAnalyticsConfig} provider.
 *
 * @example
 * ```typescript
 * @Module(appOidcAnalyticsModuleMetadata({ oidcAnalyticsConfig: { eventNamePrefix: 'OIDC ', logEvents: true } }))
 * export class AppOidcAnalyticsModule {}
 * ```
 */
export const FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG = 'FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG' as InjectionToken<FirebaseServerOidcAnalyticsConfig>;
