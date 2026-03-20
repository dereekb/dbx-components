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
   *
   * @returns the server context instance
   */
  get serverContextInstance(): CalcomApiContextInstance {
    return this._serverInstance();
  }

  // MARK: Public Context
  /**
   * Configured pass-through for {@link getAvailableSlots} using the public (unauthenticated) context.
   *
   * @returns function to query available slots without authentication
   */
  get getAvailableSlots() {
    return getAvailableSlots(this._publicContext());
  }

  // MARK: Context Creation
  /**
   * Creates a {@link CalcomApiContextInstance} for a specific user using their OAuth refresh token.
   * The returned instance has all API functions scoped to that user's account.
   *
   * When no explicit `accessTokenCache` is provided, a per-user cache is automatically
   * resolved from the cache service using an md5 hash of the refresh token as the key.
   * This ensures tokens persist across requests and server restarts without collisions.
   *
   * @param input - the user context factory input containing the refresh token and optional cache
   * @returns a new CalcomApiContextInstance scoped to the user
   *
   * @example
   * ```ts
   * // Automatic per-user caching (recommended):
   * const userInstance = calcomApi.makeUserContextInstance({
   *   refreshToken: user.calcomRefreshToken
   * });
   *
   * // With explicit cache override:
   * const userInstance = calcomApi.makeUserContextInstance({
   *   refreshToken: user.calcomRefreshToken,
   *   accessTokenCache: customCache
   * });
   * ```
   */
  makeUserContextInstance(input: CalcomUserContextFactoryInput): CalcomApiContextInstance {
    const contextInput = { ...input };

    // Auto-resolve per-user cache from the refresh token if no explicit cache was given
    if (!contextInput.accessTokenCache && contextInput.refreshToken) {
      const userCache = this.calcomOAuthApi.cacheForRefreshToken(contextInput.refreshToken);

      if (userCache) {
        contextInput.accessTokenCache = userCache;
      }
    }

    const userContext: CalcomUserContext = this.calcom.calcomServerContext.makeUserContext(contextInput);
    return this.makeContextInstance(userContext);
  }

  /**
   * Creates a {@link CalcomApiContextInstance} from any {@link CalcomContext}.
   *
   * @param context - the CalcomContext (server or user) to wrap
   * @returns a new CalcomApiContextInstance bound to the given context
   */
  makeContextInstance(context: CalcomContext): CalcomApiContextInstance {
    return new CalcomApiContextInstance(this, context);
  }

  /**
   * Creates a raw {@link CalcomUserContext} from a refresh token, without wrapping in a {@link CalcomApiContextInstance}.
   * Prefer {@link makeUserContextInstance} unless you need direct context access.
   *
   * @param input - the user context factory input containing the refresh token and optional cache
   * @returns a CalcomUserContext for the given user
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
   *
   * @returns function to retrieve the authenticated user's profile
   */
  get getMe() {
    return getMe(this.context);
  }

  // MARK: Schedules
  /**
   * Configured pass-through for {@link getSchedules}.
   *
   * @returns function to retrieve all schedules for the authenticated user
   */
  get getSchedules() {
    return getSchedules(this.context);
  }

  // MARK: Bookings
  /**
   * Configured pass-through for {@link createBooking}.
   *
   * @returns function to create a new booking
   */
  get createBooking() {
    return createBooking(this.context);
  }

  /**
   * Configured pass-through for {@link getBooking}.
   *
   * @returns function to retrieve a booking by UID
   */
  get getBooking() {
    return getBooking(this.context);
  }

  /**
   * Configured pass-through for {@link cancelBooking}.
   *
   * @returns function to cancel a booking by UID
   */
  get cancelBooking() {
    return cancelBooking(this.context);
  }

  // MARK: Event Types
  /**
   * Configured pass-through for {@link getEventTypes}.
   *
   * @returns function to retrieve all event types for the authenticated user
   */
  get getEventTypes() {
    return getEventTypes(this.context);
  }

  /**
   * Configured pass-through for {@link createEventType}.
   *
   * @returns function to create a new event type
   */
  get createEventType() {
    return createEventType(this.context);
  }

  /**
   * Configured pass-through for {@link updateEventType}.
   *
   * @returns function to update an existing event type by ID
   */
  get updateEventType() {
    return updateEventType(this.context);
  }

  /**
   * Configured pass-through for {@link deleteEventType}.
   *
   * @returns function to delete an event type by ID
   */
  get deleteEventType() {
    return deleteEventType(this.context);
  }

  // MARK: Calendars
  /**
   * Configured pass-through for {@link getCalendars}.
   *
   * @returns function to retrieve all connected calendars
   */
  get getCalendars() {
    return getCalendars(this.context);
  }

  /**
   * Configured pass-through for {@link getBusyTimes}.
   *
   * @returns function to retrieve busy time ranges across connected calendars
   */
  get getBusyTimes() {
    return getBusyTimes(this.context);
  }

  // MARK: Webhooks
  /**
   * Configured pass-through for {@link createWebhook}.
   *
   * @returns function to create a webhook subscription
   */
  get createWebhook() {
    return createWebhook(this.context);
  }

  /**
   * Configured pass-through for {@link getWebhooks}.
   *
   * @returns function to retrieve all webhooks
   */
  get getWebhooks() {
    return getWebhooks(this.context);
  }

  /**
   * Configured pass-through for {@link getWebhook}.
   *
   * @returns function to retrieve a specific webhook by ID
   */
  get getWebhook() {
    return getWebhook(this.context);
  }

  /**
   * Configured pass-through for {@link updateWebhook}.
   *
   * @returns function to update an existing webhook by ID
   */
  get updateWebhook() {
    return updateWebhook(this.context);
  }

  /**
   * Configured pass-through for {@link deleteWebhook}.
   *
   * @returns function to delete a webhook by ID
   */
  get deleteWebhook() {
    return deleteWebhook(this.context);
  }
}
