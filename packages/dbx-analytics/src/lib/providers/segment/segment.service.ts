import { Injectable, InjectionToken, Inject, inject, Optional } from '@angular/core';
import { AbstractAsyncWindowLoadedService } from '@dereekb/browser';
import { Maybe, poll } from '@dereekb/util';

export const PRELOAD_SEGMENT_TOKEN = new InjectionToken<string>('DbxAnalyticsSegmentApiServicePreload');

export class DbxAnalyticsSegmentApiServiceConfig {
  writeKey: string;
  logging = true;
  active = true;
  constructor(writeKey: string) {
    this.writeKey = writeKey;
  }
}

/**
 * When the Segment library finishes loading, it is invoked.
 */
type SegmentAnalyticsInvoked = SegmentAnalytics.AnalyticsJS & { invoked?: boolean };

/**
 * Segment API Service used for waiting/retrieving the segment API from window when initialized.
 *
 * This requires some setup in index.html.
 */
@Injectable()
export class DbxAnalyticsSegmentApiService extends AbstractAsyncWindowLoadedService<SegmentAnalytics.AnalyticsJS> {
  private readonly _config = inject(DbxAnalyticsSegmentApiServiceConfig);

  static readonly SEGMENT_API_WINDOW_KEY = 'analytics';
  static readonly SEGMENT_READY_KEY = 'SegmentReady';

  constructor(@Optional() @Inject(PRELOAD_SEGMENT_TOKEN) preload?: Maybe<boolean>) {
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
