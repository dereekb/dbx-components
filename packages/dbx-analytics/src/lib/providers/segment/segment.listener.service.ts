import { Injectable, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { combineLatest } from 'rxjs';
import { AbstractDbxAnalyticsServiceListener, type DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType, type AnalyticsUser } from '../../analytics';
import { DbxAnalyticsSegmentApiService } from './segment.service';

/**
 * Analytics listener that forwards {@link DbxAnalyticsStreamEvent} events to the Segment SDK.
 *
 * Automatically maps event types to the appropriate Segment methods:
 * - {@link DbxAnalyticsStreamEventType.Event} / {@link DbxAnalyticsStreamEventType.UserLoginEvent} -> `track()`
 * - {@link DbxAnalyticsStreamEventType.UserChange} / {@link DbxAnalyticsStreamEventType.NewUserEvent} -> `identify()`
 * - {@link DbxAnalyticsStreamEventType.UserLogoutEvent} -> `reset()`
 * - {@link DbxAnalyticsStreamEventType.PageView} -> `page()`
 *
 * Events are only sent when the Segment configuration is marked as `active`.
 * Provided at root level and registered as a listener via {@link DbxAnalyticsServiceConfiguration.listeners}.
 *
 * @example
 * ```ts
 * // Register in analytics configuration factory
 * function analyticsConfigFactory(injector: Injector): DbxAnalyticsServiceConfiguration {
 *   const segmentListener = injector.get(DbxAnalyticsSegmentServiceListener);
 *   return {
 *     isProduction: true,
 *     listeners: [segmentListener]
 *   };
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAnalyticsSegmentServiceListener extends AbstractDbxAnalyticsServiceListener {
  private readonly _segmentApi = inject(DbxAnalyticsSegmentApiService);

  constructor() {
    super();

    if (this._segmentApi.config.logging) {
      console.log('SegmentAnalyticsListenerService: Segment is logging events.');
    }

    if (!this._segmentApi.config.active) {
      console.log('SegmentAnalyticsListenerService: Segment is disabled from sending events to the server.');
    }
  }

  /**
   * Subscribes to the Segment API service and analytics event stream, forwarding events to the Segment SDK.
   *
   * Events are only sent when the Segment configuration is marked as active.
   */
  protected _initializeServiceSubscription() {
    return combineLatest([this._segmentApi.service$, this.analyticsEvents$]).subscribe(([segment, streamEvent]: [SegmentAnalytics.AnalyticsJS, DbxAnalyticsStreamEvent]) => {
      if (this._segmentApi.config.logging) {
        console.log('Segment Listener Logging Event: ', streamEvent);
      }

      if (this._segmentApi.config.active) {
        this.handleStreamEvent(segment, streamEvent);
      }
    });
  }

  /**
   * Routes an analytics stream event to the appropriate Segment API method based on event type.
   *
   * @param api - The Segment analytics SDK instance
   * @param streamEvent - The analytics event to process
   */
  protected handleStreamEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: DbxAnalyticsStreamEvent): void {
    switch (streamEvent.type) {
      case DbxAnalyticsStreamEventType.NewUserEvent:
        this.updateWithNewUserEvent(api, streamEvent);
        break;
      case DbxAnalyticsStreamEventType.UserLoginEvent:
        this.changeUser(api, streamEvent.user);
        this.updateWithEvent(api, streamEvent);
        break;
      case DbxAnalyticsStreamEventType.Event:
        this.updateWithEvent(api, streamEvent);
        break;
      case DbxAnalyticsStreamEventType.UserLogoutEvent:
        this.changeUser(api, undefined);
        break;
      case DbxAnalyticsStreamEventType.PageView:
        api.page();
        break;
      case DbxAnalyticsStreamEventType.UserChange:
        this.changeUser(api, streamEvent.user);
        break;
    }
  }

  /**
   * Handles a new user registration event by identifying the user in Segment.
   *
   * @param api - The Segment analytics SDK instance
   * @param streamEvent - The event containing the new user data
   */
  protected updateWithNewUserEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: DbxAnalyticsStreamEvent): void {
    this.changeUser(api, streamEvent.user);
  }

  /**
   * Sends a track event to Segment with the event name, value, and additional data properties.
   *
   * @param api - The Segment analytics SDK instance
   * @param streamEvent - The analytics event containing name, value, and data
   * @param name - Optional override for the event name
   */
  protected updateWithEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: DbxAnalyticsStreamEvent, name?: string): void {
    const event = streamEvent.event;
    const eventName = name || event?.name;

    if (eventName) {
      const value = event?.value;
      const data = event?.data;

      api.track(
        eventName,
        {
          ...(value != null
            ? {
                value
              }
            : undefined),
          ...data
        },
        {},
        () => {
          if (this._segmentApi.config.logging) {
            console.log('Segment track success.');
          }
        }
      );
    }
  }

  private changeUser(api: SegmentAnalytics.AnalyticsJS, user: Maybe<AnalyticsUser>): void {
    if (user?.user) {
      api.identify(
        user.user,
        {
          ...user.properties
        },
        {},
        () => {
          if (this._segmentApi.config.logging) {
            console.log('Segment identify success.');
          }
        }
      );
    } else {
      api.reset();
    }
  }
}
