import { Observable, Subject, BehaviorSubject, of, Subscription, first, shareReplay, switchMap } from 'rxjs';
import { Inject, Injectable, Optional } from '@angular/core';
import { SubscriptionObject, filterMaybe, tapLog } from '@dereekb/rxjs';
import { DbxAnalyticsEvent, DbxAnalyticsEventData, DbxAnalyticsEventName, DbxAnalyticsUser, NewUserAnalyticsEventData, DbxUserAnalyticsEvent } from './analytics';
import { DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType } from './analytics.stream';
import { Maybe, Destroyable } from '@dereekb/util';

export abstract class DbxAnalyticsEventEmitterService {
  abstract sendNewUserEvent(user: DbxAnalyticsUser, data: NewUserAnalyticsEventData): void;
  abstract sendUserLoginEvent(user: DbxAnalyticsUser, data?: DbxAnalyticsEventData): void;
  abstract sendUserLogoutEvent(data?: DbxAnalyticsEventData): void;
  abstract sendUserPropertiesEvent(user: DbxAnalyticsUser, data?: DbxAnalyticsEventData): void;
  abstract sendEventData(name: DbxAnalyticsEventName, data?: DbxAnalyticsEventData): void;
  abstract sendEvent(event: DbxAnalyticsEvent): void;
  abstract sendPageView(page?: string): void;
}

export abstract class DbxAnalyticsEventStreamService {
  abstract readonly events$: Observable<DbxAnalyticsStreamEvent>;
}

export abstract class DbxAnalyticsUserSource {
  abstract readonly analyticsUser$: Observable<Maybe<DbxAnalyticsUser>>;
}

export abstract class DbxAnalyticsServiceListener {
  public abstract listenToService(service: DbxAnalyticsService): void;
}

/**
 * Abstract AnalyticsServiceListener implementation.
 */
export abstract class AbstractDbxAnalyticsServiceListener implements DbxAnalyticsServiceListener, Destroyable {
  private _sub = new SubscriptionObject();
  protected _analytics = new BehaviorSubject<Maybe<DbxAnalyticsService>>(undefined);

  readonly analytics$ = this._analytics.pipe(filterMaybe(), shareReplay(1));
  readonly analyticsEvents$ = this.analytics$.pipe(
    switchMap((x) => x.events$),
    shareReplay(1)
  );

  // MARK: AnalyticsServiceListener
  listenToService(service: DbxAnalyticsService): void {
    this._analytics.next(service);
    const sub = this._initializeServiceSubscription();

    if (sub !== false) {
      this._sub.subscription = sub;
    }
  }

  protected abstract _initializeServiceSubscription(): Subscription | false;

  // MARK: Destroy
  destroy(): void {
    this._analytics.complete();
    this._sub.destroy();
  }
}

export abstract class DbxAnalyticsServiceConfiguration {
  listeners: DbxAnalyticsServiceListener[] = [];
  isProduction?: boolean;
  logEvents?: boolean;
  userSource?: DbxAnalyticsUserSource;
}

export class DbxAnalyticsStreamEventAnalyticsEventWrapper implements DbxAnalyticsStreamEvent {
  constructor(public readonly event: DbxUserAnalyticsEvent, public readonly type: DbxAnalyticsStreamEventType = DbxAnalyticsStreamEventType.Event) {}

  public get user(): Maybe<DbxAnalyticsUser> {
    return this.event.user;
  }

  public get userId(): string | undefined {
    return this.user ? this.user.user : undefined;
  }
}

/**
 * Primary analytics service that emits analytics events that components can listen to.
 */
@Injectable()
export class DbxAnalyticsService implements DbxAnalyticsEventStreamService, DbxAnalyticsEventEmitterService, Destroyable {
  // TODO: Make these configurable.

  static readonly USER_REGISTRATION_EVENT_NAME = 'User Registered';
  static readonly USER_LOGIN_EVENT_NAME = 'User Login';
  static readonly USER_LOGOUT_EVENT_NAME = 'User Logout';
  static readonly USER_PROPERTIES_EVENT_NAME = 'User Properties';

  private _subject = new Subject<DbxAnalyticsStreamEvent>();
  readonly events$ = this._subject.asObservable();

  private _userSource = new BehaviorSubject<Maybe<DbxAnalyticsUserSource>>(undefined);
  readonly user$ = this._userSource.pipe(
    switchMap((x) => (x ? x.analyticsUser$ : of(undefined))),
    shareReplay(1)
  );

  private _userSourceSub = new SubscriptionObject();
  private _loggerSub = new SubscriptionObject();

  constructor(private _config: DbxAnalyticsServiceConfiguration, @Optional() @Inject(DbxAnalyticsUserSource) userSource?: Maybe<DbxAnalyticsUserSource>) {
    this._init();

    userSource = userSource || _config.userSource;
    if (userSource) {
      this.setUserSource(userSource);
    }
  }

  // MARK: Source
  /**
   * Sets the user directly.
   */
  public setUser(user: Maybe<DbxAnalyticsUser>): void {
    let source: Maybe<DbxAnalyticsUserSource>;

    if (user) {
      source = { analyticsUser$: of(user) };
    }

    this._userSource.next(source);
  }

  public setUserSource(source: DbxAnalyticsUserSource): void {
    this._userSource.next(source);
  }

  // MARK: AnalyticsEventEmitterService
  /**
   * Sends an event.
   */
  public sendNewUserEvent(user: DbxAnalyticsUser, data: NewUserAnalyticsEventData): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_REGISTRATION_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.NewUserEvent,
      user
    );
  }

  public sendUserLoginEvent(user: DbxAnalyticsUser, data?: DbxAnalyticsEventData): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_LOGIN_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.UserLoginEvent,
      user
    );
  }

  public sendUserLogoutEvent(data?: DbxAnalyticsEventData, clearUser = true): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_LOGOUT_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.UserLogoutEvent
    );

    if (clearUser) {
      this.setUser(undefined);
    }
  }

  public sendUserPropertiesEvent(user: DbxAnalyticsUser, data?: DbxAnalyticsEventData): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_PROPERTIES_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.UserPropertiesEvent,
      user
    );
  }

  public sendEventData(name: DbxAnalyticsEventName, data?: DbxAnalyticsEventData): void {
    return this.sendEvent({
      name,
      data
    });
  }

  public sendEventType(eventType: DbxAnalyticsEventName): void {
    this.sendNextEvent(
      {
        name: eventType
      },
      DbxAnalyticsStreamEventType.Event
    );
  }

  public sendEvent(event: DbxAnalyticsEvent): void {
    this.sendNextEvent(event, DbxAnalyticsStreamEventType.Event);
  }

  public sendPageView(page?: string): void {
    this.sendNextEvent(
      {
        name: page
      },
      DbxAnalyticsStreamEventType.PageView
    );
  }

  protected sendNextEvent(event: DbxAnalyticsEvent = {}, type: DbxAnalyticsStreamEventType, userOverride?: DbxAnalyticsUser): void {
    this.user$.pipe(first()).subscribe((analyticsUser) => {
      const user: Maybe<DbxAnalyticsUser> = userOverride != null ? userOverride : analyticsUser;
      const analyticsEvent: DbxUserAnalyticsEvent = { ...event, user };
      this.nextEvent(analyticsEvent, type);
    });
  }

  protected nextEvent(event: DbxUserAnalyticsEvent, type: DbxAnalyticsStreamEventType): void {
    const wrapper = new DbxAnalyticsStreamEventAnalyticsEventWrapper(event, type);
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
      console.warn('AnalyticsService: Analytics not in production mode. All analytics events are ignored.');
    }

    if (this._config.logEvents || !this._config.isProduction) {
      console.log('AnalyticsService: Log analytics events enabled.');

      // Create a new subscription
      this._loggerSub.subscription = this._subject.subscribe((x) => {
        console.log(`AnalyticsService: Analytics Event - ${DbxAnalyticsStreamEventType[x.type]} | User: ${x.userId} | Data: ${JSON.stringify(x.event)}.`);
      });
    }

    this._userSourceSub.subscription = this.user$.subscribe(() => {
      this.sendNextEvent({}, DbxAnalyticsStreamEventType.UserChange);
    });
  }

  destroy() {
    this._subject.complete();
    this._userSourceSub.destroy();
    this._loggerSub.destroy();
  }
}
