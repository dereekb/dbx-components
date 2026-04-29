import { TestBed } from '@angular/core/testing';
import { type Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { vi, type Mock } from 'vitest';
import { callbackTest } from '@dereekb/util/test';
import { DbxAnalyticsService, type DbxAnalyticsServiceConfiguration, provideDbxAnalyticsService } from '../../analytics';
import { DbxAnalyticsMixpanelApiService, DbxAnalyticsMixpanelApiServiceConfig, type MixpanelLike } from './mixpanel.service';
import { DbxAnalyticsMixpanelServiceListener } from './mixpanel.listener.service';

interface MixpanelLikeMock extends MixpanelLike {
  start_session_recording: Mock;
  stop_session_recording: Mock;
  pause_session_recording: Mock;
  resume_session_recording: Mock;
}

function makeMockMixpanel(): MixpanelLikeMock {
  return {
    start_session_recording: vi.fn(),
    stop_session_recording: vi.fn(),
    pause_session_recording: vi.fn(),
    resume_session_recording: vi.fn()
  };
}

class StubMixpanelApiService {
  readonly mock: MixpanelLikeMock = makeMockMixpanel();
  readonly service$ = new BehaviorSubject<MixpanelLike>(this.mock);
  readonly config = new DbxAnalyticsMixpanelApiServiceConfig();
}

describe('DbxAnalyticsMixpanelServiceListener', () => {
  let analyticsService: DbxAnalyticsService;
  let stubApi: StubMixpanelApiService;
  let listener: DbxAnalyticsMixpanelServiceListener;

  function analyticsServiceConfigurationFactory(injector: Injector): DbxAnalyticsServiceConfiguration {
    return {
      isProduction: true,
      listeners: [injector.get(DbxAnalyticsMixpanelServiceListener)]
    };
  }

  beforeEach(async () => {
    stubApi = new StubMixpanelApiService();
    stubApi.config.logging = false;
    stubApi.config.active = true;

    await TestBed.configureTestingModule({
      providers: [
        { provide: DbxAnalyticsMixpanelApiService, useValue: stubApi },
        provideDbxAnalyticsService({
          dbxAnalyticsServiceConfigurationFactory: analyticsServiceConfigurationFactory
        })
      ]
    }).compileComponents();

    analyticsService = TestBed.inject(DbxAnalyticsService);
    listener = TestBed.inject(DbxAnalyticsMixpanelServiceListener);
    expect(listener).toBeDefined();
  });

  afterEach(() => {
    analyticsService.destroy();
    stubApi.service$.complete();
  });

  it(
    '#startSessionRecording() should call mixpanel.start_session_recording',
    callbackTest((done) => {
      analyticsService.startSessionRecording();
      // microtask flush — sendNextEvent uses user$.pipe(first())
      queueMicrotask(() => {
        expect(stubApi.mock.start_session_recording).toHaveBeenCalledTimes(1);
        expect(stubApi.mock.stop_session_recording).not.toHaveBeenCalled();
        done();
      });
    })
  );

  it(
    '#stopSessionRecording() should call mixpanel.stop_session_recording',
    callbackTest((done) => {
      analyticsService.stopSessionRecording();
      queueMicrotask(() => {
        expect(stubApi.mock.stop_session_recording).toHaveBeenCalledTimes(1);
        done();
      });
    })
  );

  it(
    '#pauseSessionRecording() should call mixpanel.pause_session_recording',
    callbackTest((done) => {
      analyticsService.pauseSessionRecording();
      queueMicrotask(() => {
        expect(stubApi.mock.pause_session_recording).toHaveBeenCalledTimes(1);
        done();
      });
    })
  );

  it(
    '#resumeSessionRecording() should call mixpanel.resume_session_recording',
    callbackTest((done) => {
      analyticsService.resumeSessionRecording();
      queueMicrotask(() => {
        expect(stubApi.mock.resume_session_recording).toHaveBeenCalledTimes(1);
        done();
      });
    })
  );

  it(
    '#sendPageView() should not invoke any session-replay method',
    callbackTest((done) => {
      analyticsService.sendPageView();
      queueMicrotask(() => {
        expect(stubApi.mock.start_session_recording).not.toHaveBeenCalled();
        expect(stubApi.mock.stop_session_recording).not.toHaveBeenCalled();
        expect(stubApi.mock.pause_session_recording).not.toHaveBeenCalled();
        expect(stubApi.mock.resume_session_recording).not.toHaveBeenCalled();
        done();
      });
    })
  );

  it(
    '#sendEventType() should not invoke any session-replay method',
    callbackTest((done) => {
      analyticsService.sendEventType('Custom Event');
      queueMicrotask(() => {
        expect(stubApi.mock.start_session_recording).not.toHaveBeenCalled();
        expect(stubApi.mock.stop_session_recording).not.toHaveBeenCalled();
        expect(stubApi.mock.pause_session_recording).not.toHaveBeenCalled();
        expect(stubApi.mock.resume_session_recording).not.toHaveBeenCalled();
        done();
      });
    })
  );

  it(
    'should not invoke session-replay methods when config.active is false',
    callbackTest((done) => {
      stubApi.config.active = false;
      analyticsService.startSessionRecording();
      queueMicrotask(() => {
        expect(stubApi.mock.start_session_recording).not.toHaveBeenCalled();
        done();
      });
    })
  );
});
