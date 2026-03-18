import { type InjectionToken } from '@nestjs/common';
import { type AuthData } from '../../type';

/**
 * Structured analytics event emitted by the onCall CRUD dispatch chain.
 *
 * Each event captures the full context of a handler invocation — the operation being performed,
 * the model type, the lifecycle stage, the authenticated user, and any custom properties.
 *
 * Consumed by {@link OnCallModelAnalyticsService} and forwarded to provider-specific listeners.
 */
export interface OnCallModelAnalyticsEvent {
  /** The event name describing what happened (e.g., `'Guestbook Created'`). */
  readonly event: string;
  /** The lifecycle stage at which this event was emitted. */
  readonly lifecycle: 'triggered' | 'success' | 'error' | 'complete';
  /** The CRUD operation type (e.g., `'create'`, `'update'`, `'delete'`). */
  readonly call: string;
  /** The model type being operated on (e.g., `'guestbook'`, `'profile'`). */
  readonly modelType: string;
  /** Optional operation specifier for variant handlers (e.g., `'subscribeToNotifications'`). */
  readonly specifier?: string;
  /** The Firebase Auth UID of the calling user, if authenticated. */
  readonly uid?: string;
  /** The full Firebase Auth context, if available. */
  readonly auth?: AuthData;
  /** The raw request object passed to the handler. */
  readonly request?: any;
  /** Custom key-value properties attached by lifecycle callbacks. */
  readonly properties?: Record<string, any>;
  /** The error object, if this event was emitted during the `'error'` lifecycle stage. */
  readonly error?: unknown;
}

/**
 * Abstract analytics service that apps implement to process analytics events.
 *
 * Analogous to {@link DbxAnalyticsService} on the frontend.
 * Apps extend this class and provide it via {@link ON_CALL_MODEL_ANALYTICS_SERVICE}.
 */
export abstract class OnCallModelAnalyticsService {
  abstract handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void;
}

/**
 * Default injection token for the analytics service.
 * Apps provide this in their NestJS module to enable analytics in the onCall dispatch chain.
 */
export const ON_CALL_MODEL_ANALYTICS_SERVICE = 'ON_CALL_MODEL_ANALYTICS_SERVICE' as InjectionToken<OnCallModelAnalyticsService>;

// MARK: Compat
/**
 * @deprecated Use {@link OnCallModelAnalyticsService} instead.
 */
export type OnCallModelAnalyticsHandler = OnCallModelAnalyticsService;

/**
 * @deprecated Use {@link ON_CALL_MODEL_ANALYTICS_SERVICE} instead.
 */
export const ON_CALL_MODEL_ANALYTICS_HANDLER = ON_CALL_MODEL_ANALYTICS_SERVICE;
