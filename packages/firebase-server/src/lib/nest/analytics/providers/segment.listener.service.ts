import { Inject, Injectable } from '@nestjs/common';
import { FirebaseServerAnalyticsServiceListener } from '../analytics.service.listener';
import { type OnCallModelAnalyticsEvent } from '../../model/analytics.handler';
import { SegmentService } from '@dereekb/analytics/nestjs';
import { asAnalyticsEventData } from '@dereekb/analytics';

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
}
