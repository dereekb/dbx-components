import { DbxAnalyticsModule } from '@dereekb/dbx-analytics';
import { TestBed } from '@angular/core/testing';
import { DbxAnalyticsService, DbxAnalyticsServiceConfiguration, DbxAnalyticsUserSource, AbstractDbxAnalyticsServiceListener } from './analytics.service';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { DbxAnalyticsUser } from './analytics';
import { DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType } from './analytics.stream';

class TestAnalyticsServiceListener extends AbstractDbxAnalyticsServiceListener {
  readonly events = new Subject<DbxAnalyticsStreamEvent>();

  protected _initializeServiceSubscription(): false | Subscription {
    return this.analyticsEvents$.subscribe((event) => this.events.next(event));
  }
}

describe('DbxAnalyticsService', () => {
  const userStream = new BehaviorSubject<DbxAnalyticsUser>({ user: '0' });

  const testListener: TestAnalyticsServiceListener = new TestAnalyticsServiceListener();

  const testUserSource: DbxAnalyticsUserSource = {
    analyticsUser$: userStream
  };

  let analyticsService: DbxAnalyticsService;

  function analyticsServiceConfigurationFactory(): DbxAnalyticsServiceConfiguration {
    const config: DbxAnalyticsServiceConfiguration = {
      listeners: [testListener],
      isProduction: true,
      userSource: testUserSource
    };

    return config;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        DbxAnalyticsModule.forRoot({
          analyticsConfigurationProvider: {
            provide: DbxAnalyticsServiceConfiguration,
            useFactory: analyticsServiceConfigurationFactory
          }
        })
      ],
      declarations: []
    }).compileComponents();

    analyticsService = TestBed.inject(DbxAnalyticsService);
  });

  afterEach(() => {
    userStream.complete();
    analyticsService.destroy();
  });

  it('#sendPageView() should send a page view event', (done) => {
    testListener.events.subscribe((event) => {
      expect(event.type).toBe(DbxAnalyticsStreamEventType.PageView);
      done();
    });

    analyticsService.sendPageView();
  });
});
