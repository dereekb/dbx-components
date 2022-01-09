import { Observable, Subscription, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Injectable, Optional } from '@angular/core';
import { SubscriptionObject } from '@dereekb/ngx-core';

export type AnalyticsEventName = string;
export type AnalyticsUserId = string;

export interface AnalyticsUser {
  readonly user: AnalyticsUserId;
  readonly properties?: {
    readonly [key: string]: string | number | boolean;
  };
}

export interface AnalyticsEventData {
  readonly [key: string]: string | number | boolean;
}

export type NewUserRegistrationMethod = 'facebook' | 'google' | 'email' | string;

export interface NewUserAnalyticsEventData extends AnalyticsEventData {
  method: NewUserRegistrationMethod;
}

export interface AnalyticsEvent {
  readonly name?: AnalyticsEventName;
  readonly value?: number;
  readonly data?: AnalyticsEventData;
}

export interface UserAnalyticsEvent extends AnalyticsEvent {
  readonly user?: AnalyticsUser;
}

export abstract class AnalyticsSender {

  abstract sendNewUserEvent(user: AnalyticsUser, data: NewUserAnalyticsEventData): void;

  abstract sendUserLoginEvent(user: AnalyticsUser, data?: AnalyticsEventData): void;

  abstract sendUserLogoutEvent(data?: AnalyticsEventData): void;

  abstract sendUserPropertiesEvent(user: AnalyticsUser, data?: AnalyticsEventData): void;

  abstract sendEventData(name: AnalyticsEventName, data?: AnalyticsEventData): void;

  abstract sendEvent(event: AnalyticsEvent): void;

  abstract sendPageView(page?: string): void;

}

export enum AnalyticsStreamEventType {

  PageView,
  UserChange,

  // Events
  NewUserEvent,
  UserLoginEvent,
  UserLogoutEvent,
  UserPropertiesEvent,
  Event

}

export interface AnalyticsStreamEvent {
  readonly type: AnalyticsStreamEventType;
  readonly user?: AnalyticsUser;
  readonly event?: UserAnalyticsEvent;
  readonly userId?: AnalyticsUserId;
}

export abstract class AnalyticsUserSource {
  abstract readonly userStream: Observable<AnalyticsUser | undefined>;
  abstract getAnalyticsUser(): Observable<AnalyticsUser>;
}


export abstract class AnalyticsServiceListener {
  public abstract listenToService(service: DbNgxAnalyticsService): void;
}

export abstract class AbstractAnalyticsServiceListener implements AnalyticsServiceListener {

  protected _service?: DbNgxAnalyticsService;
  protected _sub = new SubscriptionObject();

  public listenToService(service: DbNgxAnalyticsService): void {
    this._service = service;
    this._sub.subscription = service.events.pipe(filter((e) => this.filterEvent(e)))
      .subscribe((event) => this.updateOnStreamEvent(event));
  }

  protected filterEvent(streamEvent: AnalyticsStreamEvent): boolean {
    return true;
  }

  protected abstract updateOnStreamEvent(event: AnalyticsStreamEvent): void;

}

export class AnalyticsServiceConfiguration {
  listeners: AnalyticsServiceListener[] = [];
  isProduction?: boolean;
  logEvents?: boolean;
  userSource?: AnalyticsUserSource;
}

export class AnalyticsStreamEventAnalyticsEventWrapper implements AnalyticsStreamEvent {

  constructor(public readonly event: UserAnalyticsEvent, public readonly type: AnalyticsStreamEventType = AnalyticsStreamEventType.Event) { }

  public get user(): AnalyticsUser | undefined {
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
export class DbNgxAnalyticsService implements AnalyticsSender {

  static readonly USER_REGISTRATION_EVENT_NAME = 'User Registered';
  static readonly USER_LOGIN_EVENT_NAME = 'User Login';
  static readonly USER_LOGOUT_EVENT_NAME = 'User Logout';
  static readonly USER_PROPERTIES_EVENT_NAME = 'User Properties';

  private _subject = new Subject<AnalyticsStreamEvent>();

  private _user?: AnalyticsUser;
  private _userSub = new SubscriptionObject();

  constructor(private _config: AnalyticsServiceConfiguration, @Optional() userSource: AnalyticsUserSource | undefined = _config.userSource) {
    this._init();

    if (userSource) {
      this.setUserSource(userSource);
    }
  }

  // MARK: Source
  public setUserSource(source: AnalyticsUserSource): void {
    this._userSub.subscription = source.userStream.subscribe((user) => {
      this.setUser(user);
    });
  }

  // MARK: Events
  public get events(): Observable<AnalyticsStreamEvent> {
    return this._subject.asObservable();
  }

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
    const user = (userOverride === undefined) ? this._user : userOverride;
    const analyticsEvent: UserAnalyticsEvent = { ...event, user };
    this.nextEvent(analyticsEvent, type);
  }

  protected nextEvent(event: UserAnalyticsEvent, type: AnalyticsStreamEventType): void {
    const wrapper = new AnalyticsStreamEventAnalyticsEventWrapper(event, type);
    this._subject.next(wrapper);
  }

  /**
   * Sets the user directly.
   */
  public setUser(user: AnalyticsUser | undefined): void {
    this._user = user;
    this.sendNextEvent({}, AnalyticsStreamEventType.UserChange);
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
      this._subject.subscribe((x) => {
        console.log(`DbNgxAnalyticsService: Analytics Event - ${AnalyticsStreamEventType[x.type]} User: ${x.userId} Data: ${JSON.stringify(x.event)}.`);
      });
    }
  }

}
