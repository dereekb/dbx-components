import { createAction, props } from '@ngrx/store';
import { type Maybe } from '@dereekb/util';
import { type AuthUserIdentifier } from '../../auth.user';

/**
 * NgRx action dispatched when impersonation of a user starts (or switches to a different target).
 *
 * Dispatched by `DbxAppAuthImpersonationEffects` in response to a `'start'`
 * {@link DbxAuthImpersonationEvent} from {@link DbxAuthImpersonationService.events$}.
 *
 * @see {@link stoppedImpersonating} for the corresponding clear event.
 */
export const startedImpersonating = createAction('[App/Auth/Impersonation] Started', props<{ userId: AuthUserIdentifier; previousUserId?: Maybe<AuthUserIdentifier> }>());

/**
 * NgRx action dispatched when impersonation is cleared and the app reverts to the real authenticated user.
 *
 * Dispatched by `DbxAppAuthImpersonationEffects` in response to an `'end'`
 * {@link DbxAuthImpersonationEvent} from {@link DbxAuthImpersonationService.events$}.
 *
 * @see {@link startedImpersonating} for the corresponding start event.
 */
export const stoppedImpersonating = createAction('[App/Auth/Impersonation] Stopped', props<{ previousUserId?: Maybe<AuthUserIdentifier> }>());
