import { type AnalyticsEvent, type AnalyticsEventData, type AnalyticsEventName, type AnalyticsUser } from '@dereekb/analytics';
import { type Maybe } from '@dereekb/util';
import { type OnCallModelAnalyticsEvent } from '../model/analytics.handler';

/**
 * Listener for {@link FirebaseServerAnalyticsService}.
 * Events are forwarded from FirebaseServerAnalyticsService to this listener
 * for processing by an analytics provider (e.g., Segment).
 */
export abstract class FirebaseServerAnalyticsServiceListener {
  /**
   * Handles a structured analytics event from the onCall CRUD dispatch chain.
   *
   * @param event - the lifecycle event containing call context, model type, and properties
   */
  abstract handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void;
  /**
   * Sends a named analytics event with a data payload.
   *
   * @param userId - the user to associate with the event, or nullish to skip
   * @param name - the event name (e.g., `'Item Purchased'`)
   * @param data - key-value data attached to the event
   */
  abstract sendEventData(userId: Maybe<string>, name: AnalyticsEventName, data: AnalyticsEventData): void;
  /**
   * Sends a named analytics event with no additional data.
   *
   * @param userId - the user to associate with the event, or nullish to skip
   * @param eventType - the event name to track
   */
  abstract sendEventType(userId: Maybe<string>, eventType: AnalyticsEventName): void;
  /**
   * Sends a fully constructed {@link AnalyticsEvent} object.
   *
   * @param userId - the user to associate with the event, or nullish to skip
   * @param event - the event containing name, optional value, and data
   */
  abstract sendEvent(userId: Maybe<string>, event: AnalyticsEvent): void;
  /**
   * Sends a user properties/traits update to the analytics provider (e.g., Segment `identify()`).
   *
   * @param user - the user whose properties are being synced
   */
  abstract sendUserPropertiesEvent(user: AnalyticsUser): void;
}

/**
 * Creates a default no-op {@link FirebaseServerAnalyticsServiceListener}.
 *
 * Used when no analytics provider is configured. All methods are no-ops.
 *
 * @returns A no-op listener that silently discards all analytics events.
 */
export function noopFirebaseServerAnalyticsServiceListener(): FirebaseServerAnalyticsServiceListener {
  const noop = () => {};

  return {
    handleOnCallAnalyticsEvent: noop,
    sendEventData: noop,
    sendEventType: noop,
    sendEvent: noop,
    sendUserPropertiesEvent: noop
  } as FirebaseServerAnalyticsServiceListener;
}
