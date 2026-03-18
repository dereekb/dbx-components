import { type AnalyticsEvent, type AnalyticsEventData, type AnalyticsEventName, type AnalyticsUser, asAnalyticsEventData } from '@dereekb/analytics';
import { type Maybe } from '@dereekb/util';
import { SegmentService } from '@dereekb/analytics/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { FirebaseServerAnalyticsServiceListener } from '../analytics.service.listener';
import { type OnCallModelAnalyticsEvent } from '../../model/analytics.handler';

/**
 * Segment implementation of {@link FirebaseServerAnalyticsServiceListener}.
 *
 * Routes analytics events to the {@link SegmentService}:
 * - CRUD lifecycle events → `tryTrack()` with call/model/lifecycle context as properties
 * - General events (`sendEventData`, `sendEventType`, `sendEvent`) → `tryTrack()`
 * - User properties (`sendUserPropertiesEvent`) → `identify()`
 *
 * Provided by {@link FirebaseServerAnalyticsSegmentModule}.
 */
@Injectable()
export class FirebaseServerAnalyticsSegmentListenerService extends FirebaseServerAnalyticsServiceListener {
  constructor(@Inject(SegmentService) private readonly _segmentService: SegmentService) {
    super();
  }

  handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void {
    const properties = {
      ...asAnalyticsEventData(event.properties),
      call: event.call,
      modelType: event.modelType,
      lifecycle: event.lifecycle,
      ...(event.specifier ? { specifier: event.specifier } : {})
    };

    this._segmentService.tryTrack(event.uid, {
      event: event.event,
      properties
    });
  }

  sendEventData(userId: Maybe<string>, name: AnalyticsEventName, data: AnalyticsEventData): void {
    this._segmentService.tryTrack(userId, {
      event: name,
      properties: asAnalyticsEventData(data)
    });
  }

  sendEventType(userId: Maybe<string>, eventType: AnalyticsEventName): void {
    this._segmentService.tryTrack(userId, {
      event: eventType
    });
  }

  sendEvent(userId: Maybe<string>, event: AnalyticsEvent): void {
    this._segmentService.tryTrack(userId, {
      event: event.name ?? 'Unknown Event',
      properties: event.data ? asAnalyticsEventData(event.data) : undefined
    });
  }

  sendUserPropertiesEvent(user: AnalyticsUser): void {
    this._segmentService.identify({
      userId: user.user,
      traits: user.properties
    });
  }
}
