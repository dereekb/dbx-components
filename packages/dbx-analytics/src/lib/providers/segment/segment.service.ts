import { Injectable, InjectionToken, inject } from '@angular/core';
import { AbstractAsyncWindowLoadedService } from '@dereekb/browser';
import { poll } from '@dereekb/util';

/**
 * Injection token for optionally preloading the Segment analytics script.
 */
export const PRELOAD_SEGMENT_TOKEN = new InjectionToken<string>('DbxAnalyticsSegmentApiServicePreload');

/**
 * Configuration for the Segment analytics integration.
 *
 * @example
 * ```ts
 * const config = new DbxAnalyticsSegmentApiServiceConfig('your-segment-write-key');
 * config.active = environment.production;
 * config.logging = !environment.production;
 * ```
 */
export class DbxAnalyticsSegmentApiServiceConfig {
  writeKey: string;
  logging = true;
  active = true;
  constructor(writeKey: string) {
    this.writeKey = writeKey;
  }
}

/**
 * Extended Segment analytics type that includes the `invoked` flag set after the snippet initializes.
 */
type SegmentAnalyticsInvoked = SegmentAnalytics.AnalyticsJS & { invoked?: boolean };

/**
 * Service that manages the async loading and initialization of the Segment analytics SDK from `window.analytics`.
 *
 * Polls for the Segment snippet to be invoked, then calls `analytics.load()` with the configured write key.
 * Once Segment reports ready, the resolved SDK instance is available via the inherited `service$` observable.
 *
 * Requires the Segment analytics snippet to be included in `index.html`.
 *
 * Provided via {@link provideDbxAnalyticsSegmentApiService}.
 *
 * @example
 * ```ts
 * // In app.config.ts
 * provideDbxAnalyticsSegmentApiService({
 *   dbxAnalyticsSegmentApiServiceConfigFactory: (injector) => {
 *     const config = new DbxAnalyticsSegmentApiServiceConfig(environment.analytics.segment);
 *     config.active = environment.production;
 *     return config;
 *   }
 * })
 * ```
 */
@Injectable()
export class DbxAnalyticsSegmentApiService extends AbstractAsyncWindowLoadedService<SegmentAnalytics.AnalyticsJS> {
  private readonly _config = inject(DbxAnalyticsSegmentApiServiceConfig);

  static readonly SEGMENT_API_WINDOW_KEY = 'analytics';
  static readonly SEGMENT_READY_KEY = 'SegmentReady';

  constructor() {
    const preload = inject(PRELOAD_SEGMENT_TOKEN, { optional: true });
    super(DbxAnalyticsSegmentApiService.SEGMENT_API_WINDOW_KEY, undefined, 'Segment', preload);
  }

  get config(): DbxAnalyticsSegmentApiServiceConfig {
    return this._config;
  }

  protected override _prepareCompleteLoadingService(): Promise<void> {
    return poll({
      // poll until analytics.invoked is true.
      check: () => Boolean((window.analytics as SegmentAnalyticsInvoked).invoked),
      timesToGiveup: 100
    });
  }

  protected override _initService(service: SegmentAnalytics.AnalyticsJS): Promise<SegmentAnalytics.AnalyticsJS> {
    return new Promise((resolve, reject) => {
      try {
        service.load(this._config.writeKey); // Initialize Segment

        // Wait for the service to ready itself.
        service.ready(() => {
          // Segment changes itself or rather the target, and the previous initial target is ignored after.
          const segment: SegmentAnalytics.AnalyticsJS = window[DbxAnalyticsSegmentApiService.SEGMENT_API_WINDOW_KEY];
          resolve(segment);
        });
      } catch (e) {
        console.log('Failed to init segment: ' + e);
        reject(e);
      }
    });
  }
}
