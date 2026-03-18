import { Inject, Injectable } from '@nestjs/common';
import { type OnCallModelAnalyticsEvent, OnCallModelAnalyticsService } from '../model/analytics.handler';
import { FirebaseServerAnalyticsServiceListener } from './analytics.service.listener';

@Injectable()
export class FirebaseServerAnalyticsService extends OnCallModelAnalyticsService {

  constructor(@Inject(FirebaseServerAnalyticsServiceListener) private readonly _listener: FirebaseServerAnalyticsServiceListener) {
    super();
  }

  handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void {
    this._listener.handleOnCallAnalyticsEvent(event);
  }

}
