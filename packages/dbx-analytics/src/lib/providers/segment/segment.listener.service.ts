import { Injectable } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { combineLatest } from 'rxjs';
import { AbstractAnalyticsServiceListener, AnalyticsStreamEvent, AnalyticsStreamEventType, AnalyticsUser } from '../../analytics';
import { SegmentApiService } from './segment.service';

/**
 * AnalyticsServiceListener adapter for Segment.
 */
@Injectable()
export class SegmentAnalyticsListenerService extends AbstractAnalyticsServiceListener {

  constructor(private _segmentApi: SegmentApiService) {
    super();

    if (this._segmentApi.config.logging) {
      console.log('SegmentAnalyticsListenerService: Segment is logging events.');
    }

    if (this._segmentApi.config.active) {
      console.log('SegmentAnalyticsListenerService: Segment is disabled from sending events to the server.');
    }
  }

  protected _initializeServiceSubscription() {
    return combineLatest([this._segmentApi.service$, this.analyticsEvents$]).subscribe(
      ([segment, streamEvent]: [SegmentAnalytics.AnalyticsJS, AnalyticsStreamEvent]) => {
        if (this._segmentApi.config.logging) {
          console.log('Segment Listener Logging Event: ', streamEvent);
        }

        if (this._segmentApi.config.active) {
          this.handleStreamEvent(segment, streamEvent);
        }
      });
  }

  protected handleStreamEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: AnalyticsStreamEvent): void {
    switch (streamEvent.type) {
      case AnalyticsStreamEventType.NewUserEvent:
        this.updateWithNewUserEvent(api, streamEvent);
        break;
      case AnalyticsStreamEventType.UserLoginEvent:
      case AnalyticsStreamEventType.Event:
        this.updateWithEvent(api, streamEvent);
        break;
      case AnalyticsStreamEventType.UserLogoutEvent:
        this.changeUser(api, undefined);
        break;
      case AnalyticsStreamEventType.PageView:
        api.page();
        break;
      case AnalyticsStreamEventType.UserChange:
        this.changeUser(api, streamEvent.user);
        break;
    }
  }

  protected updateWithNewUserEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: AnalyticsStreamEvent): void {
    this.changeUser(api, streamEvent.user);
  }

  protected updateWithEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: AnalyticsStreamEvent, name?: string): void {
    const event = streamEvent.event;
    const eventName = name || event?.name;

    if (eventName) {
      const value = event?.value
      const data = event?.data;

      api.track(eventName, {
        ...(value != null) ? {
          value
        } : undefined,
        ...data
      }, {}, () => {
        if (this._segmentApi.config.logging) {
          console.log('Segment track success.');
        }
      });
    }
  }

  private changeUser(api: SegmentAnalytics.AnalyticsJS, user: Maybe<AnalyticsUser>): void {
    if (user) {
      api.identify(user.user, {
        ...user.properties
      }, {}, () => {
        if (this._segmentApi.config.logging) {
          console.log('Segment identify success.');
        }
      });
    } else {
      api.reset();
    }
  }

}
