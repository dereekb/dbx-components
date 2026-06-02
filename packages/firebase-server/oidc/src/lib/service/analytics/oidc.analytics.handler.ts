import { type InjectionToken, type Logger } from '@nestjs/common';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * The high-level OIDC/OAuth interaction-flow event types captured as analytics.
 *
 * Each value maps to a distinct downstream analytics event name (see
 * {@link DEFAULT_OIDC_ANALYTICS_EVENT_NAMES}). Scoped to the OIDC interaction flow
 * (`POST /interaction/:uid/login` and `/consent`) — the events that have no callModel
 * representation. Client/grant lifecycle operations run through callModel functions and
 * are captured by the callModel analytics layer (`OnCallModelAnalyticsService`) instead.
 */
export type OidcAnalyticsEventType = 'login' | 'consent';

/**
 * Structured analytics event emitted once per high-level OIDC/OAuth moment.
 *
 * A single flat shape (mirroring the MCP `McpAnalyticsEvent`) keyed by {@link type};
 * only the fields relevant to a given event type are populated. The {@link FirebaseServerOidcAnalyticsService}
 * resolves a distinct downstream event name from {@link type} and forwards the populated
 * fields as properties.
 *
 * Consumed by {@link OidcAnalyticsService} implementations registered under {@link OIDC_ANALYTICS_SERVICE}.
 */
export interface OidcAnalyticsEvent {
  /**
   * The high-level event identity.
   */
  readonly type: OidcAnalyticsEventType;
  /**
   * Whether the underlying operation completed successfully. `false` for failed logins,
   * the admin-only service-token rejection, and any other denied/errored outcome.
   */
  readonly isSuccessful: boolean;
  /**
   * The Firebase Auth UID of the acting/owning user, when known. Always present for
   * login/consent (the verified account id); best-effort for grant revocation (the grant
   * owner) and typically absent for clientId-keyed client lifecycle events.
   */
  readonly uid?: Maybe<FirebaseAuthUserId>;
  /**
   * The OAuth client id the user is authenticating against / consenting to, when known.
   */
  readonly clientId?: Maybe<string>;
  /**
   * The OIDC scopes granted on a successful consent.
   */
  readonly scopes?: Maybe<string[]>;
  /**
   * Whether the event involved an admin-only service-token scope.
   */
  readonly serviceToken?: Maybe<boolean>;
  /**
   * Whether the acting user is an admin, when resolved (consent flow).
   */
  readonly isAdmin?: Maybe<boolean>;
  /**
   * Whether the user denied the consent prompt.
   */
  readonly denied?: Maybe<boolean>;
  /**
   * A short machine-readable reason for a failed/denied outcome (e.g. `'service_token_non_admin'`,
   * `'invalid_id_token'`).
   */
  readonly reason?: Maybe<string>;
  /**
   * The thrown error, when the operation failed ({@link isSuccessful} is `false`).
   */
  readonly error?: Maybe<unknown>;
  /**
   * Wall-clock duration in milliseconds, when a handler boundary is available (controller handlers).
   */
  readonly durationMs?: Maybe<number>;
  /**
   * Custom key-value properties. Reserved for future use.
   */
  readonly properties?: Maybe<Record<string, any>>;
}

/**
 * Abstract analytics service that apps implement to process OIDC analytics events.
 *
 * Analogous to the MCP `McpAnalyticsService` but scoped to the OIDC/OAuth transport.
 * Apps extend this class and provide it via {@link OIDC_ANALYTICS_SERVICE}.
 */
export abstract class OidcAnalyticsService {
  abstract handleOidcAnalyticsEvent(event: OidcAnalyticsEvent): void;
}

/**
 * Injection token for the OIDC analytics service.
 *
 * Apps provide this (typically via {@link appOidcAnalyticsModuleMetadata} on a `@Global()`
 * module) to enable analytics in the OIDC dispatch chain. When absent, the OIDC emitters
 * fall back to {@link noopOidcAnalyticsService}.
 */
export const OIDC_ANALYTICS_SERVICE = 'OIDC_ANALYTICS_SERVICE' as InjectionToken<OidcAnalyticsService>;

/**
 * Creates a no-op {@link OidcAnalyticsService} that silently discards all events.
 *
 * Used as the default fallback by the OIDC emitters when no analytics service is registered.
 *
 * @returns An {@link OidcAnalyticsService} that discards all analytics events.
 * @__NO_SIDE_EFFECTS__
 */
export function noopOidcAnalyticsService(): OidcAnalyticsService {
  return { handleOidcAnalyticsEvent: () => undefined };
}

/**
 * Forwards an {@link OidcAnalyticsEvent} to the given service, fail-soft.
 *
 * A throwing analytics handler must never break the underlying OIDC operation, so the
 * handler invocation is wrapped — on error a warning is logged and the error is swallowed.
 * Mirrors the MCP `_emitMcpAnalytics` discipline, factored to a free function because the
 * OIDC events fire from several emitters.
 *
 * @param service - The analytics service to forward to.
 * @param event - The event to emit.
 * @param logger - The emitter's logger, used to warn when the handler throws.
 */
export function emitOidcAnalyticsEvent(service: OidcAnalyticsService, event: OidcAnalyticsEvent, logger: Logger): void {
  try {
    service.handleOidcAnalyticsEvent(event);
  } catch (error) {
    logger.warn(`OIDC analytics handler threw for event ${event.type}; ignoring: ${error}`);
  }
}
