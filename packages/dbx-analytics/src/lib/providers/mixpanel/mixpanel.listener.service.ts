import { Injectable, inject } from '@angular/core';
import { combineLatest } from 'rxjs';
import { AbstractDbxAnalyticsServiceListener, type DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType } from '../../analytics';
import { DbxAnalyticsMixpanelApiService, type MixpanelLike } from './mixpanel.service';

/**
 * Analytics listener that forwards session-replay control events to the Mixpanel SDK.
 *
 * Handles only the four session-replay event types — track/identify/page events are intentionally
 * not forwarded here because Segment's Mixpanel (Actions) device-mode destination already routes
 * them to Mixpanel. Forwarding them again would produce duplicate events.
 *
 * - {@link DbxAnalyticsStreamEventType.StartSessionRecording} -> `mixpanel.start_session_recording()`
 * - {@link DbxAnalyticsStreamEventType.StopSessionRecording} -> `mixpanel.stop_session_recording()`
 * - {@link DbxAnalyticsStreamEventType.PauseSessionRecording} -> `mixpanel.pause_session_recording()`
 * - {@link DbxAnalyticsStreamEventType.ResumeSessionRecording} -> `mixpanel.resume_session_recording()`
 *
 * Events are only sent when the Mixpanel configuration is marked as `active`.
 * Provided at root level and registered as a listener via {@link DbxAnalyticsServiceConfiguration.listeners}.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAnalyticsMixpanelServiceListener extends AbstractDbxAnalyticsServiceListener {
  private readonly _mixpanelApi = inject(DbxAnalyticsMixpanelApiService);

  constructor() {
    super();

    if (this._mixpanelApi.config.logging) {
      console.log('MixpanelAnalyticsListenerService: Mixpanel is logging events.');
    }

    if (!this._mixpanelApi.config.active) {
      console.log('MixpanelAnalyticsListenerService: Mixpanel is disabled from sending events to the server.');
    }
  }

  protected _initializeServiceSubscription() {
    return combineLatest([this._mixpanelApi.service$, this.analyticsEvents$]).subscribe(([mixpanel, streamEvent]: [MixpanelLike, DbxAnalyticsStreamEvent]) => {
      if (this._mixpanelApi.config.logging) {
        console.log('Mixpanel Listener Logging Event: ', streamEvent);
      }

      if (this._mixpanelApi.config.active) {
        this.handleStreamEvent(mixpanel, streamEvent);
      }
    });
  }

  /**
   * Routes a session-replay control event to the corresponding Mixpanel SDK method.
   *
   * Non-session-replay events are intentionally ignored — Segment's device-mode integration
   * already forwards track/identify/page to Mixpanel.
   *
   * @param api - The loaded Mixpanel SDK instance
   * @param streamEvent - The analytics event to process
   */
  protected handleStreamEvent(api: MixpanelLike, streamEvent: DbxAnalyticsStreamEvent): void {
    switch (streamEvent.type) {
      case DbxAnalyticsStreamEventType.StartSessionRecording:
        api.start_session_recording();
        break;
      case DbxAnalyticsStreamEventType.StopSessionRecording:
        api.stop_session_recording();
        break;
      case DbxAnalyticsStreamEventType.PauseSessionRecording:
        api.pause_session_recording();
        break;
      case DbxAnalyticsStreamEventType.ResumeSessionRecording:
        api.resume_session_recording();
        break;
      default:
        // All other event types are routed to Mixpanel by Segment's device-mode destination.
        break;
    }
  }
}
