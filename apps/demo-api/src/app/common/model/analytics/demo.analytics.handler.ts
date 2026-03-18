import { Injectable, Logger } from '@nestjs/common';
import { OnCallModelAnalyticsService, type OnCallModelAnalyticsEvent } from '@dereekb/firebase-server';

@Injectable()
export class DemoAnalyticsHandler extends OnCallModelAnalyticsService {
  private readonly logger = new Logger('DemoAnalytics');
  readonly events: OnCallModelAnalyticsEvent[] = [];

  handleAnalyticsEvent(event: OnCallModelAnalyticsEvent): void {
    this.events.push(event);
    this.logger.log(`[${event.lifecycle}] ${event.event} - ${event.call}/${event.modelType}`, {
      specifier: event.specifier,
      uid: event.uid,
      properties: event.properties
    });
  }
}
