import { type Maybe } from '@dereekb/util';
import { type AuthUserIdentifier } from '../auth.user';

/**
 * Discriminator for an {@link DbxAuthImpersonationEvent}.
 *
 * - `'start'` - a (new) user is now being impersonated, including switching directly from one target to another.
 * - `'end'` - impersonation was cleared and the app reverts to the real authenticated user.
 */
export type DbxAuthImpersonationEventType = 'start' | 'end';

/**
 * Reason an impersonation lifecycle event occurred.
 *
 * - `'manual'` - triggered by an explicit `startImpersonating()`/`stopImpersonating()` call (e.g. an admin action).
 * - `'auth'` - triggered automatically by an auth identity change or logout, which always clears impersonation.
 */
export type DbxAuthImpersonationEventReason = 'manual' | 'auth';

/**
 * Edge-triggered event emitted by {@link DbxAuthImpersonationService.events$} whenever impersonation
 * starts, ends, or switches to a different target user.
 *
 * A switch from user A to user B emits a single `'start'` event with `previousImpersonatedUserId = A`
 * and `impersonatedUserId = B`.
 */
export interface DbxAuthImpersonationEvent {
  /**
   * The type of lifecycle event.
   */
  readonly type: DbxAuthImpersonationEventType;
  /**
   * The user now being impersonated. Defined for `'start'` events, null/undefined for `'end'` events.
   */
  readonly impersonatedUserId: Maybe<AuthUserIdentifier>;
  /**
   * The user that was being impersonated immediately before this event, if any.
   */
  readonly previousImpersonatedUserId: Maybe<AuthUserIdentifier>;
  /**
   * Why the event occurred.
   */
  readonly reason: DbxAuthImpersonationEventReason;
}
