import { type AnalyticsEvent, type AnalyticsEventData, type AnalyticsEventName, type AnalyticsUser } from '@dereekb/analytics';
import { type Maybe } from '@dereekb/util';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { type OnCallModelAnalyticsEvent, OnCallModelAnalyticsService } from '../model/analytics.handler';
import { noopFirebaseServerAnalyticsServiceListener, FirebaseServerAnalyticsServiceListener } from './analytics.service.listener';

/**
 * Reference interface for injecting {@link FirebaseServerAnalyticsService}.
 */
export interface FirebaseServerAnalyticsServiceRef {
  readonly analyticsService: FirebaseServerAnalyticsService;
}

/**
 * Central server-side analytics service that delegates events to a registered {@link FirebaseServerAnalyticsServiceListener}.
 *
 * Extends {@link OnCallModelAnalyticsService} for CRUD lifecycle events and adds general-purpose
 * methods (`sendEventData`, `sendEventType`, `sendEvent`, `sendUserPropertiesEvent`) mirroring the
 * Angular {@link DbxAnalyticsService}.
 *
 * If no listener is provided via DI, a no-op listener is used and a warning is logged.
 *
 * Provided via {@link appAnalyticsModuleMetadata} with an optional dependency module
 * (e.g., {@link FirebaseServerAnalyticsSegmentModule}).
 *
 * @example
 * ```ts
 * // Send a custom event from a NestJS service
 * analyticsService.sendEventData(uid, 'Report Generated', { reportId: 'rpt_123' });
 *
 * // Send user properties update
 * analyticsService.sendUserPropertiesEvent({ user: uid, properties: { plan: 'premium' } });
 * ```
 */
@Injectable()
export class FirebaseServerAnalyticsService extends OnCallModelAnalyticsService {
  private readonly _listener: FirebaseServerAnalyticsServiceListener;

  constructor(@Optional() @Inject(FirebaseServerAnalyticsServiceListener) listener: FirebaseServerAnalyticsServiceListener) {
    super();

    if (listener) {
      // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- @Optional() makes listener undefined at runtime despite the type
      this._listener = listener;
    } else {
      console.warn('FirebaseServerAnalyticsService: No analytics listener configured. All analytics events will be ignored.');
      this._listener = noopFirebaseServerAnalyticsServiceListener();
    }
  }

  handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void {
    this._listener.handleOnCallAnalyticsEvent(event);
  }

  sendEventData(userId: Maybe<string>, name: AnalyticsEventName, data: AnalyticsEventData): void {
    this._listener.sendEventData(userId, name, data);
  }

  sendEventType(userId: Maybe<string>, eventType: AnalyticsEventName): void {
    this._listener.sendEventType(userId, eventType);
  }

  sendEvent(userId: Maybe<string>, event: AnalyticsEvent): void {
    this._listener.sendEvent(userId, event);
  }

  sendUserPropertiesEvent(user: AnalyticsUser): void {
    this._listener.sendUserPropertiesEvent(user);
  }
}
