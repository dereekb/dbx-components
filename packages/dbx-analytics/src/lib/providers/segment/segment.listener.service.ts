import { Injectable } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { combineLatest } from 'rxjs';
import { AbstractDbxAnalyticsServiceListener, DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType, DbxAnalyticsUser } from '../../analytics';
import { DbxAnalyticsSegmentApiService } from './segment.service';

/**
 * DbxAnalyticsServiceListener adapter for Segment.
 */
@Injectable()
export class DbxAnalyticsSegmentServiceListener extends AbstractDbxAnalyticsServiceListener {

  constructor(private _segmentApi: DbxAnalyticsSegmentApiService) {
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
      ([segment, streamEvent]: [SegmentAnalytics.AnalyticsJS, DbxAnalyticsStreamEvent]) => {
        if (this._segmentApi.config.logging) {
          console.log('Segment Listener Logging Event: ', streamEvent);
        }

        if (this._segmentApi.config.active) {
          this.handleStreamEvent(segment, streamEvent);
        }
      });
  }

  protected handleStreamEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: DbxAnalyticsStreamEvent): void {
    switch (streamEvent.type) {
      case DbxAnalyticsStreamEventType.NewUserEvent:
        this.updateWithNewUserEvent(api, streamEvent);
        break;
      case DbxAnalyticsStreamEventType.UserLoginEvent:
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

  protected updateWithNewUserEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: DbxAnalyticsStreamEvent): void {
    this.changeUser(api, streamEvent.user);
  }

  protected updateWithEvent(api: SegmentAnalytics.AnalyticsJS, streamEvent: DbxAnalyticsStreamEvent, name?: string): void {
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

  private changeUser(api: SegmentAnalytics.AnalyticsJS, user: Maybe<DbxAnalyticsUser>): void {
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
