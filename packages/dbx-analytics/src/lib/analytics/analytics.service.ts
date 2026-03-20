import { type Observable, Subject, BehaviorSubject, of, type Subscription, first, shareReplay, switchMap, distinctUntilChanged } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { SubscriptionObject, filterMaybe } from '@dereekb/rxjs';
import { type AnalyticsEvent, type AnalyticsEventData, type AnalyticsEventName, type AnalyticsUser, type NewUserAnalyticsEventData, type UserAnalyticsEvent } from './analytics';
import { type DbxAnalyticsStreamEvent, DbxAnalyticsStreamEventType } from './analytics.stream';
import { type Maybe, type Destroyable, safeCompareEquality } from '@dereekb/util';

/**
 * Abstract emitter interface for sending analytics events.
 *
 * Implemented by {@link DbxAnalyticsService} as the primary concrete implementation.
 * Components and services use this to fire analytics events without coupling to a specific provider.
 *
 * @example
 * ```ts
 * // Inject and send a custom event
 * const emitter = inject(DbxAnalyticsEventEmitterService);
 * emitter.sendEventData('Button Clicked', { buttonId: 'save' });
 * ```
 */
export abstract class DbxAnalyticsEventEmitterService {
  abstract sendNewUserEvent(user: AnalyticsUser, data: NewUserAnalyticsEventData): void;
  abstract sendUserLoginEvent(user: AnalyticsUser, data?: AnalyticsEventData): void;
  abstract sendUserLogoutEvent(data?: AnalyticsEventData): void;
  abstract sendUserPropertiesEvent(user: AnalyticsUser, data?: AnalyticsEventData): void;
  /**
   * @deprecated When sending an event with no data, use {@link sendEventType} instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  abstract sendEventData(name: AnalyticsEventName): void;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  abstract sendEventData(name: AnalyticsEventName, data: AnalyticsEventData): void;
  abstract sendEvent(event: AnalyticsEvent): void;
  abstract sendPageView(page?: string): void;
}

/**
 * Abstract interface exposing the analytics event stream as an observable.
 *
 * Implemented by {@link DbxAnalyticsService}. Listeners subscribe to `events$` to forward events to external providers.
 */
export abstract class DbxAnalyticsEventStreamService {
  abstract readonly events$: Observable<DbxAnalyticsStreamEvent>;
}

/**
 * Abstract source for the current analytics user identity.
 *
 * Provide an implementation to automatically associate a user with all emitted analytics events.
 * Typically backed by the auth system (e.g., {@link DbxFirebaseAnalyticsUserSource}).
 *
 * @example
 * ```ts
 * // Provide a static user source
 * const userSource: DbxAnalyticsUserSource = {
 *   analyticsUser$: of({ user: 'uid_abc123', properties: { role: 'admin' } })
 * };
 * ```
 */
export abstract class DbxAnalyticsUserSource {
  abstract readonly analyticsUser$: Observable<Maybe<AnalyticsUser>>;
}

/**
 * Abstract listener that receives analytics events from {@link DbxAnalyticsService}.
 *
 * Implement this to forward events to an external analytics provider (e.g., Segment, Mixpanel).
 * Register listeners via {@link DbxAnalyticsServiceConfiguration.listeners}.
 */
export abstract class DbxAnalyticsServiceListener {
  public abstract listenToService(service: DbxAnalyticsService): void;
}

/**
 * Base class for analytics service listeners that manages subscription lifecycle and provides
 * reactive access to the analytics service and its event stream.
 *
 * Subclasses implement {@link _initializeServiceSubscription} to subscribe to events and forward them
 * to an external analytics provider.
 *
 * @example
 * ```ts
 * class MyAnalyticsListener extends AbstractDbxAnalyticsServiceListener {
 *   protected _initializeServiceSubscription(): Subscription | false {
 *     return this.analyticsEvents$.subscribe((event) => {
 *       console.log('Event:', event.type, event.event?.name);
 *     });
 *   }
 * }
 * ```
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

/**
 * Configuration for {@link DbxAnalyticsService}, controlling which listeners receive events,
 * whether analytics runs in production mode, and optionally providing a user source.
 *
 * In non-production mode, listeners are not initialized and all events are logged to the console instead.
 * Provide via {@link provideDbxAnalyticsService} using a factory function.
 *
 * @example
 * ```ts
 * const config: DbxAnalyticsServiceConfiguration = {
 *   isProduction: environment.production,
 *   logEvents: !environment.production,
 *   listeners: [segmentListener],
 *   userSource: firebaseAnalyticsUserSource
 * };
 * ```
 */
export abstract class DbxAnalyticsServiceConfiguration {
  readonly listeners: DbxAnalyticsServiceListener[] = [];
  readonly isProduction?: boolean;
  readonly logEvents?: boolean;
  readonly userSource?: DbxAnalyticsUserSource;
}

/**
 * A fully resolved analytics stream event that includes the event payload, type, user context, and extracted user ID.
 *
 * Created by {@link dbxAnalyticsStreamEventAnalyticsEventWrapper} and emitted through the analytics event stream.
 */
export interface DbxAnalyticsStreamEventAnalyticsEventWrapper extends DbxAnalyticsStreamEvent {
  readonly event: UserAnalyticsEvent;
  readonly type: DbxAnalyticsStreamEventType;
  readonly user: Maybe<AnalyticsUser>;
  readonly userId: string | undefined;
}

/**
 * Wraps a {@link UserAnalyticsEvent} into a {@link DbxAnalyticsStreamEventAnalyticsEventWrapper},
 * extracting the user ID for convenient access by listeners.
 *
 * @param event - the analytics event with optional user context
 * @param type - the stream event type classification; defaults to `Event`
 * @returns a wrapper combining the event, type, user, and extracted userId
 *
 * @example
 * ```ts
 * const wrapper = dbxAnalyticsStreamEventAnalyticsEventWrapper(
 *   { name: 'Button Clicked', user: { user: 'uid_123' } },
 *   DbxAnalyticsStreamEventType.Event
 * );
 * // wrapper.userId === 'uid_123'
 * ```
 */
export function dbxAnalyticsStreamEventAnalyticsEventWrapper(event: UserAnalyticsEvent, type: DbxAnalyticsStreamEventType = DbxAnalyticsStreamEventType.Event) {
  const { user } = event;
  const userId = user ? user.user : undefined;

  return {
    event,
    type,
    user,
    userId
  };
}

/**
 * Central analytics service that emits typed analytics events for consumption by registered listeners.
 *
 * Acts as both the event emitter (components call methods like {@link sendEventData}, {@link sendPageView})
 * and the event stream source (listeners subscribe to {@link events$}).
 *
 * In production mode, registered {@link DbxAnalyticsServiceListener} instances (e.g., Segment) receive all events.
 * In non-production mode, events are logged to the console for debugging.
 *
 * Provided via {@link provideDbxAnalyticsService} with a {@link DbxAnalyticsServiceConfiguration} factory.
 *
 * @example
 * ```ts
 * // Send a custom event from a component
 * const analytics = inject(DbxAnalyticsService);
 * analytics.sendEventData('Interview Started', { candidateId: 'abc123' });
 *
 * // Send a page view on route transitions
 * transitionService.onSuccess({}, () => {
 *   analytics.sendPageView();
 * });
 * ```
 */
@Injectable()
export class DbxAnalyticsService implements DbxAnalyticsEventStreamService, DbxAnalyticsEventEmitterService, Destroyable {
  private readonly _config = inject(DbxAnalyticsServiceConfiguration);

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
  private _userIdEventSub = new SubscriptionObject();
  private _loggerSub = new SubscriptionObject();

  constructor() {
    this._init();
    let userSource: Maybe<DbxAnalyticsUserSource> = inject(DbxAnalyticsUserSource, { optional: true });
    userSource = userSource || this._config.userSource;

    if (userSource) {
      this.setUserSource(userSource);
    }
  }

  // MARK: Source
  /**
   * Sets the analytics user directly, overriding any configured {@link DbxAnalyticsUserSource}.
   *
   * Pass `undefined` to clear the current user (e.g., on logout).
   *
   * @param user - the user to identify, or undefined to clear
   */
  public setUser(user: Maybe<AnalyticsUser>): void {
    let source: Maybe<DbxAnalyticsUserSource>;

    if (user) {
      source = { analyticsUser$: of(user) };
    }

    this._userSource.next(source);

    if (this._userSource.value) {
      console.warn('DbxAnalyticsService has a userSource that is set. Source is now overridden by setUser() value.');
    }
  }

  /**
   * Sets the reactive user source that automatically updates the analytics user as auth state changes.
   *
   * @param source - the user source providing an observable of the current analytics user
   */
  public setUserSource(source: DbxAnalyticsUserSource): void {
    this._userSource.next(source);
  }

  // MARK: DbxAnalyticsEventEmitterService
  /**
   * Emits a new user registration event, typically sent once after account creation.
   *
   * @param user - the newly registered user
   * @param data - registration-specific data including the signup method
   */
  public sendNewUserEvent(user: AnalyticsUser, data: NewUserAnalyticsEventData): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_REGISTRATION_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.NewUserEvent,
      user
    );
  }

  /**
   * Emits a user login event, identifying the user in analytics providers.
   *
   * @param user - the user who logged in
   * @param data - optional additional event data
   */
  public sendUserLoginEvent(user: AnalyticsUser, data?: AnalyticsEventData): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_LOGIN_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.UserLoginEvent,
      user
    );
  }

  /**
   * Emits a user logout event and optionally clears the current analytics user.
   *
   * @param data - optional additional event data
   * @param clearUser - whether to reset the analytics user identity; defaults to `true`
   */
  public sendUserLogoutEvent(data?: AnalyticsEventData, clearUser = true): void {
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

  /**
   * Emits a user properties update event, used to sync user traits to analytics providers.
   *
   * @param user - the user whose properties are being updated
   * @param data - optional additional event data
   */
  public sendUserPropertiesEvent(user: AnalyticsUser, data?: AnalyticsEventData): void {
    this.sendNextEvent(
      {
        name: DbxAnalyticsService.USER_PROPERTIES_EVENT_NAME,
        data
      },
      DbxAnalyticsStreamEventType.UserPropertiesEvent,
      user
    );
  }

  /**
   * @deprecated When sending an event with no data, use {@link sendEventType} instead.
   */
  public sendEventData(name: AnalyticsEventName): void;
  /**
   * Sends a named analytics event with a data payload.
   *
   * This is the primary method for tracking custom events with associated properties.
   *
   * @param name - the event name (e.g., `'Interview Ended'`)
   * @param data - key-value data attached to the event
   *
   * @example
   * ```ts
   * analytics.sendEventData('Interview Ended', {
   *   seconds: 120,
   *   endedDueToTime: 'true'
   * });
   * ```
   */
  public sendEventData(name: AnalyticsEventName, data: AnalyticsEventData): void;
  public sendEventData(name: AnalyticsEventName, data?: AnalyticsEventData): void {
    return this.sendEvent({
      name,
      data
    });
  }

  /**
   * Sends a named event with no additional data, useful for simple occurrence tracking.
   *
   * @param eventType - the event name to track
   *
   * @example
   * ```ts
   * analytics.sendEventType('Finish Account Setup');
   * ```
   */
  public sendEventType(eventType: AnalyticsEventName): void {
    this.sendNextEvent(
      {
        name: eventType
      },
      DbxAnalyticsStreamEventType.Event
    );
  }

  /**
   * Sends a fully constructed analytics event object.
   *
   * @param event - the event containing name, optional value, and data
   */
  public sendEvent(event: AnalyticsEvent): void {
    this.sendNextEvent(event, DbxAnalyticsStreamEventType.Event);
  }

  /**
   * Sends a page view event, typically called on successful route transitions.
   *
   * @param page - optional page name/path override; if omitted, the provider determines the current page
   *
   * @example
   * ```ts
   * // In a router config function
   * transitionService.onSuccess({}, () => {
   *   analyticsService.sendPageView();
   * });
   * ```
   */
  public sendPageView(page?: string): void {
    this.sendNextEvent(
      {
        name: page
      },
      DbxAnalyticsStreamEventType.PageView
    );
  }

  /**
   * Sends the next event.
   *
   * @param event
   * @param type
   * @param userOverride Uses this user if set as null or an override value. If undefined the current analytics user is used.
   */
  protected sendNextEvent(event: AnalyticsEvent = {}, type: DbxAnalyticsStreamEventType, userOverride?: Maybe<AnalyticsUser>): void {
    this.user$.pipe(first()).subscribe((analyticsUser) => {
      const user: Maybe<AnalyticsUser> = userOverride !== undefined ? userOverride : analyticsUser;
      const analyticsEvent: UserAnalyticsEvent = { ...event, user };
      this.nextEvent(analyticsEvent, type);
    });
  }

  protected nextEvent(event: UserAnalyticsEvent, type: DbxAnalyticsStreamEventType): void {
    const wrapper = dbxAnalyticsStreamEventAnalyticsEventWrapper(event, type);
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

    this._userSourceSub.subscription = this.user$.subscribe((user) => {
      this.sendNextEvent({}, DbxAnalyticsStreamEventType.UserChange, user ?? null);
    });

    this._userIdEventSub.subscription = this.user$.pipe(distinctUntilChanged((a, b) => safeCompareEquality(a, b, (x, y) => x.user === y.user))).subscribe((user) => {
      this.sendNextEvent({}, DbxAnalyticsStreamEventType.UserIdChange, user ?? null);
    });
  }

  destroy() {
    this._subject.complete();
    this._userSource.complete();
    this._userSourceSub.destroy();
    this._userIdEventSub.destroy();
    this._loggerSub.destroy();
  }
}
