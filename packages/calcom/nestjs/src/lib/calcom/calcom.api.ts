import { Inject, Injectable } from '@nestjs/common';
import { CalcomServiceConfig } from './calcom.config';
import { type Calcom, type CalcomContext, type CalcomServerContext, type CalcomUserContext, type CalcomUserContextFactoryInput, calcomFactory, getMe, getSchedules, getAvailableSlots, createBooking, getBooking, cancelBooking, getEventTypes, createEventType, updateEventType, deleteEventType, getCalendars, getBusyTimes, createWebhook, getWebhooks, getWebhook, updateWebhook, deleteWebhook } from '@dereekb/calcom';
import { cachedGetter } from '@dereekb/util';
import { CalcomOAuthApi } from '../oauth';

/**
 * Injectable NestJS service that provides access to the Cal.com API.
 *
 * Use {@link serverContextInstance} to access API functions via the server context,
 * or {@link makeUserContextInstance} to create per-mentor API instances.
 *
 * @example
 * ```ts
 * // Server context (API key or server OAuth)
 * const instance = calcomApi.serverContextInstance;
 * const me = await instance.getMe();
 *
 * // Per-mentor context
 * const mentorInstance = calcomApi.makeUserContextInstance({ refreshToken: mentor.calcomRefreshToken });
 * const eventTypes = await mentorInstance.getEventTypes();
 *
 * // Public slot query (no auth)
 * const slots = await calcomApi.getAvailableSlots({ start: '...', end: '...', eventTypeId: 123 });
 * ```
 */
@Injectable()
export class CalcomApi {
  readonly calcom: Calcom;

  private readonly _serverInstance = cachedGetter(() => new CalcomApiContextInstance(this, this.calcomServerContext));
  private readonly _publicContext = cachedGetter(() => this.calcom.calcomServerContext.makePublicContext());

  get calcomServerContext(): CalcomServerContext {
    return this.calcom.calcomServerContext;
  }

  constructor(
    @Inject(CalcomServiceConfig) readonly config: CalcomServiceConfig,
    @Inject(CalcomOAuthApi) readonly calcomOAuthApi: CalcomOAuthApi
  ) {
    this.calcom = calcomFactory({
      ...config.factoryConfig,
      oauthContext: calcomOAuthApi.oauthContext
    })(config.calcom);
  }

  /**
   * Returns the cached {@link CalcomApiContextInstance} for the server context.
   * All API functions are available through this instance.
   */
  get serverContextInstance(): CalcomApiContextInstance {
    return this._serverInstance();
  }

  // MARK: Public Context
  /** Configured pass-through for {@link getAvailableSlots} using the public (unauthenticated) context. */
  get getAvailableSlots() {
    return getAvailableSlots(this._publicContext());
  }

  // MARK: Context Creation
  /**
   * Creates a {@link CalcomApiContextInstance} for a specific user (mentor) using their OAuth refresh token.
   * The returned instance has all API functions scoped to that mentor's account.
   *
   * @example
   * ```ts
   * const mentorInstance = calcomApi.makeUserContextInstance({
   *   refreshToken: mentor.calcomRefreshToken,
   *   accessTokenCache: mentorTokenCache
   * });
   * await mentorInstance.createEventType({ title: 'Mentoring', slug: 'mentoring', lengthInMinutes: 30 });
   * ```
   */
  makeUserContextInstance(input: CalcomUserContextFactoryInput): CalcomApiContextInstance {
    const userContext: CalcomUserContext = this.calcom.calcomServerContext.makeUserContext(input);
    return this.makeContextInstance(userContext);
  }

  /**
   * Creates a {@link CalcomApiContextInstance} from any {@link CalcomContext}.
   */
  makeContextInstance(context: CalcomContext): CalcomApiContextInstance {
    return new CalcomApiContextInstance(this, context);
  }

  /**
   * Creates a raw {@link CalcomUserContext} from a refresh token, without wrapping in a {@link CalcomApiContextInstance}.
   * Prefer {@link makeUserContextInstance} unless you need direct context access.
   */
  makeUserContext(input: CalcomUserContextFactoryInput) {
    return this.calcom.calcomServerContext.makeUserContext(input);
  }
}

/**
 * Wraps a {@link CalcomContext} (server or user) and exposes all authenticated Cal.com API
 * functions bound to that context. Each getter delegates to the corresponding function
 * from `@dereekb/calcom`.
 *
 * Access the parent {@link CalcomApi} via {@link calcomApi} for public endpoints
 * (e.g., `calcomApi.getAvailableSlots`) or to create additional context instances.
 *
 * @example
 * ```ts
 * const instance = calcomApi.serverContextInstance;
 *
 * // Authenticated API calls
 * const me = await instance.getMe();
 * const schedules = await instance.getSchedules();
 *
 * // Access public endpoints via parent
 * const slots = await instance.calcomApi.getAvailableSlots({ start: '...', end: '...', eventTypeId: 123 });
 * ```
 */
export class CalcomApiContextInstance {
  constructor(
    readonly calcomApi: CalcomApi,
    readonly context: CalcomContext
  ) {}

  // MARK: User
  /**
   * Configured pass-through for {@link getMe}.
   */
  get getMe() {
    return getMe(this.context);
  }

  // MARK: Schedules
  /**
   * Configured pass-through for {@link getSchedules}.
   */
  get getSchedules() {
    return getSchedules(this.context);
  }

  // MARK: Bookings
  /**
   * Configured pass-through for {@link createBooking}.
   */
  get createBooking() {
    return createBooking(this.context);
  }

  /**
   * Configured pass-through for {@link getBooking}.
   */
  get getBooking() {
    return getBooking(this.context);
  }

  /**
   * Configured pass-through for {@link cancelBooking}.
   */
  get cancelBooking() {
    return cancelBooking(this.context);
  }

  // MARK: Event Types
  /**
   * Configured pass-through for {@link getEventTypes}.
   */
  get getEventTypes() {
    return getEventTypes(this.context);
  }

  /**
   * Configured pass-through for {@link createEventType}.
   */
  get createEventType() {
    return createEventType(this.context);
  }

  /**
   * Configured pass-through for {@link updateEventType}.
   */
  get updateEventType() {
    return updateEventType(this.context);
  }

  /**
   * Configured pass-through for {@link deleteEventType}.
   */
  get deleteEventType() {
    return deleteEventType(this.context);
  }

  // MARK: Calendars
  /**
   * Configured pass-through for {@link getCalendars}.
   */
  get getCalendars() {
    return getCalendars(this.context);
  }

  /**
   * Configured pass-through for {@link getBusyTimes}.
   */
  get getBusyTimes() {
    return getBusyTimes(this.context);
  }

  // MARK: Webhooks
  /**
   * Configured pass-through for {@link createWebhook}.
   */
  get createWebhook() {
    return createWebhook(this.context);
  }

  /**
   * Configured pass-through for {@link getWebhooks}.
   */
  get getWebhooks() {
    return getWebhooks(this.context);
  }

  /**
   * Configured pass-through for {@link getWebhook}.
   */
  get getWebhook() {
    return getWebhook(this.context);
  }

  /**
   * Configured pass-through for {@link updateWebhook}.
   */
  get updateWebhook() {
    return updateWebhook(this.context);
  }

  /**
   * Configured pass-through for {@link deleteWebhook}.
   */
  get deleteWebhook() {
    return deleteWebhook(this.context);
  }
}
