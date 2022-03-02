import { Injectable, InjectionToken, Inject } from '@angular/core';
import { AbstractAsyncWindowLoadedService } from '@dereekb/browser';
import { poll } from '@dereekb/util';

export const PRELOAD_SEGMENT_TOKEN = new InjectionToken<string>('PreLoadSegmentService');

export class SegmentApiServiceConfig {
  logging = true;
  active = true;
  constructor(public writeKey: string) { }
}


/**
 * Segment API Service used for waiting/retrieving the segment API from window when initialized.
 *
 * This requires some setup in index.html.
 */
@Injectable()
export class SegmentApiService extends AbstractAsyncWindowLoadedService<SegmentAnalytics.AnalyticsJS> {

  static readonly SEGMENT_API_WINDOW_KEY = 'analytics';
  static readonly SEGMENT_READY_KEY = 'SegmentReady';

  constructor(private _config: SegmentApiServiceConfig, @Inject(PRELOAD_SEGMENT_TOKEN) preload: boolean = true) {
    super(SegmentApiService.SEGMENT_API_WINDOW_KEY, undefined, 'Segment', preload);
  }

  get config(): SegmentApiServiceConfig {
    return this._config;
  }

  protected override _prepareCompleteLoadingService(): Promise<void> {
    return poll({
      // poll until analytics.invoked is true.
      check: () => Boolean((window.analytics as any)?.invoked),
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
          const segment: SegmentAnalytics.AnalyticsJS = window[SegmentApiService.SEGMENT_API_WINDOW_KEY];
          resolve(segment);
        });
      } catch (e) {
        console.log('Failed to init segment: ' + e);
        reject(e);
      }
    });

  }

}
