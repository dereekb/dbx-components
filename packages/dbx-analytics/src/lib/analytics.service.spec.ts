import {
  DbNgxAnalyticsService, DbNgxAnalyticsServiceConfiguration,
  DbNgxAnalyticsUserSource, AbstractAnalyticsServiceListener
} from './analytics.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { AnalyticsUser } from './analytics';
import { AnalyticsStreamEvent, AnalyticsStreamEventType } from './analytics.stream';

class TestAnalyticsServiceListener extends AbstractAnalyticsServiceListener {

  readonly events = new Subject<AnalyticsStreamEvent>();

  updateOnStreamEvent(event: AnalyticsStreamEvent) {
    this.events.next(event);
  }

}

describe('Analytics Service', () => {

  const userStream = new BehaviorSubject<AnalyticsUser>({ user: '0' });

  const testListener: TestAnalyticsServiceListener = new TestAnalyticsServiceListener();

  const testUserSource: DbNgxAnalyticsUserSource = {
    analyticsUser$: userStream
  };

  let analyticsService: DbNgxAnalyticsService;

  beforeEach(() => {
    const configuration: DbNgxAnalyticsServiceConfiguration = {
      listeners: [testListener],
      isProduction: true,
      userSource: testUserSource
    };

    analyticsService = new DbNgxAnalyticsService(configuration);
  });

  it('#sendPageView() should send a page view event', (done) => {

    testListener.events.subscribe((event) => {
      expect(event.type).toBe(AnalyticsStreamEventType.PageView);
      done();
    });

    analyticsService.sendPageView();
  });

});
