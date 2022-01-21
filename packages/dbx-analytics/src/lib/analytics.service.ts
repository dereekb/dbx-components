import { Observable, Subject, BehaviorSubject, of } from 'rxjs';
import { filter, first, shareReplay, switchMap } from 'rxjs/operators';
import { Inject, Injectable, Optional } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { AnalyticsEvent, AnalyticsEventData, AnalyticsEventName, AnalyticsUser, NewUserAnalyticsEventData, UserAnalyticsEvent } from './analytics';
import { AnalyticsStreamEvent, AnalyticsStreamEventType } from './analytics.stream';
import { Maybe, Destroyable } from '@dereekb/util';

export abstract class DbNgxAnalyticsEventEmitterService {
  abstract sendNewUserEvent(user: AnalyticsUser, data: NewUserAnalyticsEventData): void;
  abstract sendUserLoginEvent(user: AnalyticsUser, data?: AnalyticsEventData): void;
  abstract sendUserLogoutEvent(data?: AnalyticsEventData): void;
  abstract sendUserPropertiesEvent(user: AnalyticsUser, data?: AnalyticsEventData): void;
  abstract sendEventData(name: AnalyticsEventName, data?: AnalyticsEventData): void;
  abstract sendEvent(event: AnalyticsEvent): void;
  abstract sendPageView(page?: string): void;
}

export abstract class DbNgxAnalyticsEventStreamService {
  abstract readonly events$: Observable<AnalyticsStreamEvent>;
}

export abstract class DbNgxAnalyticsUserSource {
  abstract readonly analyticsUser$: Observable<Maybe<AnalyticsUser>>;
}

export abstract class DbNgxAnalyticsServiceListener {
  public abstract listenToService(service: DbNgxAnalyticsService): void;
}

export abstract class AbstractAnalyticsServiceListener implements DbNgxAnalyticsServiceListener {

  protected _service?: DbNgxAnalyticsService;
  protected _sub = new SubscriptionObject();

  public listenToService(service: DbNgxAnalyticsService): void {
    this._service = service;
    this._sub.subscription = service.events$.pipe(filter((e) => this.filterEvent(e)))
      .subscribe((event) => this.updateOnStreamEvent(event));
  }

  protected filterEvent(streamEvent: AnalyticsStreamEvent): boolean {
    return true;
  }

  protected abstract updateOnStreamEvent(event: AnalyticsStreamEvent): void;

}

export abstract class DbNgxAnalyticsServiceConfiguration {
  listeners: DbNgxAnalyticsServiceListener[] = [];
  isProduction?: boolean;
  logEvents?: boolean;
  userSource?: DbNgxAnalyticsUserSource;
}

export class AnalyticsStreamEventAnalyticsEventWrapper implements AnalyticsStreamEvent {

  constructor(public readonly event: UserAnalyticsEvent, public readonly type: AnalyticsStreamEventType = AnalyticsStreamEventType.Event) { }

  public get user(): Maybe<AnalyticsUser> {
    return this.event.user;
  }

  public get userId(): string | undefined {
    return (this.user) ? this.user.user : undefined;
  }

}

/**
 * Primary analytics service that emits analytics events that components can listen to.
 */
@Injectable()
export class DbNgxAnalyticsService implements DbNgxAnalyticsEventStreamService, DbNgxAnalyticsEventEmitterService, Destroyable {

  // TODO: Make these configurable.

  static readonly USER_REGISTRATION_EVENT_NAME = 'User Registered';
  static readonly USER_LOGIN_EVENT_NAME = 'User Login';
  static readonly USER_LOGOUT_EVENT_NAME = 'User Logout';
  static readonly USER_PROPERTIES_EVENT_NAME = 'User Properties';

  private _subject = new Subject<AnalyticsStreamEvent>();
  readonly events$ = this._subject.asObservable();

  private _userSource = new BehaviorSubject<Maybe<DbNgxAnalyticsUserSource>>(undefined);
  readonly user$ = this._userSource.pipe(switchMap(x => (x) ? x.analyticsUser$ : of(undefined)), shareReplay(1));

  private _userSourceSub = new SubscriptionObject();
  private _loggerSub = new SubscriptionObject();

  constructor(
    private _config: DbNgxAnalyticsServiceConfiguration,
    @Optional() @Inject(DbNgxAnalyticsUserSource) userSource: Maybe<DbNgxAnalyticsUserSource> = _config.userSource
  ) {
    this._init();

    if (userSource) {
      this.setUserSource(userSource);
    }
  }

  // MARK: Source
  /**
   * Sets the user directly.
   */
  public setUser(user: Maybe<AnalyticsUser>): void {
    let source: Maybe<DbNgxAnalyticsUserSource>;

    if (user) {
      source = { analyticsUser$: of(user) };
    }

    this._userSource.next(source);
  }

  public setUserSource(source: DbNgxAnalyticsUserSource): void {
    this._userSource.next(source);
  }

  // MARK: DbNgxAnalyticsEventEmitterService
  /**
   * Sends an event.
   */
  public sendNewUserEvent(user: AnalyticsUser, data: NewUserAnalyticsEventData): void {
    this.sendNextEvent({
      name: DbNgxAnalyticsService.USER_REGISTRATION_EVENT_NAME,
      data
    }, AnalyticsStreamEventType.NewUserEvent, user);
  }

  public sendUserLoginEvent(user: AnalyticsUser, data?: AnalyticsEventData): void {
    this.sendNextEvent({
      name: DbNgxAnalyticsService.USER_LOGIN_EVENT_NAME,
      data
    }, AnalyticsStreamEventType.UserLoginEvent, user);
  }

  public sendUserLogoutEvent(data?: AnalyticsEventData, clearUser = true): void {
    this.sendNextEvent({
      name: DbNgxAnalyticsService.USER_LOGOUT_EVENT_NAME,
      data
    }, AnalyticsStreamEventType.UserLogoutEvent);

    if (clearUser) {
      this.setUser(undefined);
    }
  }

  public sendUserPropertiesEvent(user: AnalyticsUser, data?: AnalyticsEventData): void {
    this.sendNextEvent({
      name: DbNgxAnalyticsService.USER_PROPERTIES_EVENT_NAME,
      data
    }, AnalyticsStreamEventType.UserPropertiesEvent, user);
  }

  public sendEventData(name: AnalyticsEventName, data?: AnalyticsEventData): void {
    return this.sendEvent({
      name,
      data
    });
  }

  public sendEventType(eventType: AnalyticsEventName): void {
    this.sendNextEvent({
      name: eventType
    }, AnalyticsStreamEventType.Event);
  }

  public sendEvent(event: AnalyticsEvent): void {
    this.sendNextEvent(event, AnalyticsStreamEventType.Event);
  }

  public sendPageView(page?: string): void {
    this.sendNextEvent({
      name: page
    }, AnalyticsStreamEventType.PageView);
  }

  protected sendNextEvent(event: AnalyticsEvent = {}, type: AnalyticsStreamEventType, userOverride?: AnalyticsUser): void {
    this.user$.pipe(first()).subscribe((analyticsUser) => {
      const user: Maybe<AnalyticsUser> = (userOverride != null) ? userOverride : analyticsUser;
      const analyticsEvent: UserAnalyticsEvent = { ...event, user };
      this.nextEvent(analyticsEvent, type);
    });
  }

  protected nextEvent(event: UserAnalyticsEvent, type: AnalyticsStreamEventType): void {
    const wrapper = new AnalyticsStreamEventAnalyticsEventWrapper(event, type);
    this._subject.next(wrapper);
  }

  // MARK: Internal
  private _init(): void {

    if (this._config.isProduction) {
      // Initialize listeners.
      this._config.listeners.forEach((listener) => {
        listener.listenToService(this);
      });
    } else {
      console.warn('DbNgxAnalyticsService: Analytics not in production mode. All analytics events are ignored.');
    }

    if (this._config.logEvents || !this._config.isProduction) {
      console.log('DbNgxAnalyticsService: Log analytics events enabled.');

      // Create a new subscription
      this._loggerSub.subscription = this._subject.subscribe((x) => {
        console.log(`DbNgxAnalyticsService: Analytics Event - ${AnalyticsStreamEventType[x.type]} User: ${x.userId} Data: ${JSON.stringify(x.event)}.`);
      });
    }

    this._userSourceSub.subscription = this.user$.subscribe(() => {
      this.sendNextEvent({}, AnalyticsStreamEventType.UserChange);
    });
  }

  destroy() {
    this._userSourceSub.destroy();
    this._loggerSub.destroy();
  }

}
