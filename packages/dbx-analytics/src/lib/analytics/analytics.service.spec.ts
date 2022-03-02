import {
  AnalyticsService, AnalyticsServiceConfiguration,
  AnalyticsUserSource, AbstractAnalyticsServiceListener
} from './analytics.service';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { AnalyticsUser } from './analytics';
import { AnalyticsStreamEvent, AnalyticsStreamEventType } from './analytics.stream';

class TestAnalyticsServiceListener extends AbstractAnalyticsServiceListener {

  readonly events = new Subject<AnalyticsStreamEvent>();

  protected _initializeServiceSubscription(): false | Subscription {
    return this.analyticsEvents$.subscribe((event) => this.events.next(event));
  }

}

describe('Analytics Service', () => {

  const userStream = new BehaviorSubject<AnalyticsUser>({ user: '0' });

  const testListener: TestAnalyticsServiceListener = new TestAnalyticsServiceListener();

  const testUserSource: AnalyticsUserSource = {
    analyticsUser$: userStream
  };

  let analyticsService: AnalyticsService;

  beforeEach(() => {
    const configuration: AnalyticsServiceConfiguration = {
      listeners: [testListener],
      isProduction: true,
      userSource: testUserSource
    };

    analyticsService = new AnalyticsService(configuration);
  });

  it('#sendPageView() should send a page view event', (done) => {

    testListener.events.subscribe((event) => {
      expect(event.type).toBe(AnalyticsStreamEventType.PageView);
      done();
    });

    analyticsService.sendPageView();
  });

});
