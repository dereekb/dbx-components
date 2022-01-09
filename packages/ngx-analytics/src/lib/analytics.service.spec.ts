import {
  DbNgxAnalyticsService, AnalyticsServiceConfiguration,
  AnalyticsUserSource, AnalyticsUser, AnalyticsStreamEvent, AnalyticsStreamEventType, AbstractAnalyticsServiceListener
} from './analytics.service';
import { BehaviorSubject, Subject } from 'rxjs';

class TestAnalyticsServiceListener extends AbstractAnalyticsServiceListener {

  readonly events = new Subject<AnalyticsStreamEvent>();

  updateOnStreamEvent(event: AnalyticsStreamEvent) {
    this.events.next(event);
  }

}

describe('Analytics Service', () => {

  const userStream = new BehaviorSubject<AnalyticsUser>(undefined);

  const testListener: TestAnalyticsServiceListener = new TestAnalyticsServiceListener();

  const testUserSource: AnalyticsUserSource = {
    userStream,
    getAnalyticsUser() {
      return userStream;
    }
  };

  let analyticsService: DbNgxAnalyticsService;

  beforeEach(() => {
    const configuration: AnalyticsServiceConfiguration = {
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
