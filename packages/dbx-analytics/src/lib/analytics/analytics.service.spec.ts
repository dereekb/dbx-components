import { provideDbxAnalyticsService } from '@dereekb/dbx-analytics';
import { TestBed } from '@angular/core/testing';
import { DbxAnalyticsService, type DbxAnalyticsServiceConfiguration, type DbxAnalyticsUserSource, AbstractDbxAnalyticsServiceListener } from './analytics.service';
import { BehaviorSubject, Subject, type Subscription } from 'rxjs';
import { type DbxAnalyticsUser } from './analytics';
import { type DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType } from './analytics.stream';
import { type Injector } from '@angular/core';

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

  function analyticsServiceConfigurationFactory(injector: Injector): DbxAnalyticsServiceConfiguration {
    const config: DbxAnalyticsServiceConfiguration = {
      listeners: [testListener],
      isProduction: true,
      userSource: testUserSource
    };

    return config;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideDbxAnalyticsService({
          dbxAnalyticsServiceConfigurationFactory: analyticsServiceConfigurationFactory
        })
      ]
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
