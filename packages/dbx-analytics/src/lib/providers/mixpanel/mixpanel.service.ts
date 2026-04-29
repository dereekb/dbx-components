import { Injectable, InjectionToken, inject } from '@angular/core';
import { AbstractAsyncWindowLoadedService } from '@dereekb/browser';

/**
 * Injection token for optionally preloading the Mixpanel SDK on the page.
 *
 * In typical setups Mixpanel is loaded by Segment device mode, so this token is rarely needed.
 */
export const PRELOAD_MIXPANEL_TOKEN = new InjectionToken<string>('DbxAnalyticsMixpanelApiServicePreload');

/**
 * Minimal subset of the Mixpanel JS SDK surface used by the Mixpanel listener.
 *
 * Avoids taking a runtime dependency on `mixpanel-browser` since the SDK is loaded on the page
 * by Segment's Mixpanel (Actions) device-mode destination. Widen this interface if more
 * Mixpanel APIs are needed.
 */
export interface MixpanelLike {
  start_session_recording(): void;
  stop_session_recording(): void;
  pause_session_recording(): void;
  resume_session_recording(): void;
}

/**
 * Configuration for the Mixpanel analytics integration.
 *
 * Unlike {@link DbxAnalyticsSegmentApiServiceConfig}, this config does not take a write key —
 * Mixpanel is initialized by Segment device mode. The `active` and `logging` flags exist for
 * parity with the Segment config and to gate listener behavior.
 *
 * @example
 * ```ts
 * const config = new DbxAnalyticsMixpanelApiServiceConfig();
 * config.active = environment.production;
 * config.logging = !environment.production;
 * ```
 */
export class DbxAnalyticsMixpanelApiServiceConfig {
  logging = true;
  active = true;
}

/**
 * Service that manages async access to the Mixpanel JS SDK exposed on `window.mixpanel`.
 *
 * The Mixpanel SDK is typically loaded by Segment's Mixpanel (Actions) device-mode destination,
 * so this service waits for `window.mixpanel` to exist using the inherited window-loading polling.
 * The resolved SDK instance is available via the inherited `service$` observable.
 *
 * Provided via {@link provideDbxAnalyticsMixpanelApiService}.
 *
 * @example
 * ```ts
 * // In app.config.ts
 * provideDbxAnalyticsMixpanelApiService({
 *   dbxAnalyticsMixpanelApiServiceConfigFactory: () => {
 *     const config = new DbxAnalyticsMixpanelApiServiceConfig();
 *     config.active = environment.production;
 *     return config;
 *   }
 * })
 * ```
 */
@Injectable()
export class DbxAnalyticsMixpanelApiService extends AbstractAsyncWindowLoadedService<MixpanelLike> {
  private readonly _config = inject(DbxAnalyticsMixpanelApiServiceConfig);

  static readonly MIXPANEL_API_WINDOW_KEY = 'mixpanel';

  constructor() {
    const preload = inject(PRELOAD_MIXPANEL_TOKEN, { optional: true });
    super(DbxAnalyticsMixpanelApiService.MIXPANEL_API_WINDOW_KEY, undefined, 'Mixpanel', preload);
  }

  get config(): DbxAnalyticsMixpanelApiServiceConfig {
    return this._config;
  }
}
