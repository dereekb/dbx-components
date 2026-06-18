import { Injectable, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, Subject, combineLatest, distinctUntilChanged, map, of, shareReplay, switchMap, type Observable } from 'rxjs';
import { cleanSubscription, completeOnDestroy } from '../../rxjs';
import { type AuthUserIdentifier, authUserIdentifier, NO_AUTH_USER_IDENTIFIER } from '../auth.user';
import { DbxAuthService } from '../service';
import { type DbxAuthImpersonationEvent, type DbxAuthImpersonationEventReason, type DbxAuthImpersonationEventType } from './impersonation.event';
import { DbxAuthImpersonationDelegate, type DbxAuthImpersonationDetails } from './impersonation.details';

/**
 * Optional, opt-in auth feature that lets an app act as a different user ("view as another user" / impersonation).
 *
 * This service is the source of truth for the impersonation state and is intentionally NOT `providedIn: 'root'`:
 * it is registered by `provideDbxAuthImpersonation()` so it is tree-shaken out of apps that do not opt in.
 *
 * It depends only on the abstract {@link DbxAuthService} (so it works in any dbx app, Firebase or not) and
 * resolves the {@link DbxAuthImpersonationService.effectiveUserId$} that downstream per-user stores key off of.
 * The compounding effects of impersonation (re-keying stores, banner UI, disabling edits, loading the viewed
 * user's details for display) are the responsibility of the consuming app.
 *
 * @typeParam T - The provider-specific raw payload type carried on {@link DbxAuthImpersonationDetails.raw}.
 *
 * @see {@link DbxAuthImpersonationTriggerDirective} for the route-driven trigger.
 * @see {@link DbxAuthImpersonationDelegate} for loading the impersonated user's details.
 */
@Injectable()
export class DbxAuthImpersonationService<T = unknown> {
  private readonly _dbxAuthService = inject(DbxAuthService);
  private readonly _delegate = inject(DbxAuthImpersonationDelegate, { optional: true }) as Maybe<DbxAuthImpersonationDelegate<T>>;

  private readonly _impersonatedUserId = completeOnDestroy(new BehaviorSubject<Maybe<AuthUserIdentifier>>(undefined));
  private readonly _events = completeOnDestroy(new Subject<DbxAuthImpersonationEvent>());

  /**
   * Tracks the latest real authenticated identifier so {@link startImpersonating} can ignore self-impersonation.
   */
  private _currentRealUserId: Maybe<AuthUserIdentifier>;

  /**
   * The user currently being impersonated, or null/undefined when not impersonating.
   */
  readonly impersonatedUserId$: Observable<Maybe<AuthUserIdentifier>> = this._impersonatedUserId.pipe(distinctUntilChanged(), shareReplay(1));

  /**
   * True while a user is being impersonated.
   */
  readonly isImpersonating$: Observable<boolean> = this.impersonatedUserId$.pipe(
    map((x) => x != null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The effective user the app should act as: the impersonated user when set, otherwise the real authenticated user.
   */
  readonly effectiveUserId$: Observable<AuthUserIdentifier> = combineLatest([this.impersonatedUserId$, this._dbxAuthService.userIdentifier$]).pipe(
    map(([impersonated, real]) => authUserIdentifier(impersonated ?? real)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Edge-triggered start/end signal. Subscribe to react to the impersonation lifecycle.
   */
  readonly events$: Observable<DbxAuthImpersonationEvent> = this._events.asObservable();

  /**
   * Lazily-loaded details of the impersonated user via the optional {@link DbxAuthImpersonationDelegate}.
   * Emits `undefined` when not impersonating or when no delegate is configured.
   */
  readonly impersonationDetails$: Observable<Maybe<DbxAuthImpersonationDetails<T>>> = this.impersonatedUserId$.pipe(
    switchMap((uid) => (uid != null && this._delegate != null ? this._delegate.loadImpersonationDetails(uid) : of<Maybe<DbxAuthImpersonationDetails<T>>>(undefined))),
    shareReplay(1)
  );

  constructor() {
    // Auto-clear impersonation whenever the real authenticated identity changes or the user logs out,
    // so impersonation never leaks across sessions or account switches. The first emission only captures
    // the current identity; subsequent changes trigger the clear.
    let isFirstIdentity = true;

    cleanSubscription(
      this._dbxAuthService.userIdentifier$.pipe(distinctUntilChanged()).subscribe((realUserId) => {
        this._currentRealUserId = realUserId;

        if (isFirstIdentity) {
          isFirstIdentity = false;
        } else {
          this._clear('auth');
        }
      })
    );

    cleanSubscription(this._dbxAuthService.onLogOut$.subscribe(() => this._clear('auth')));
  }

  /**
   * Begins (or switches) impersonation of the given user.
   *
   * No-ops when `userId` is the {@link NO_AUTH_USER_IDENTIFIER} sentinel, the current real user, or already the
   * impersonated user. To revert to the real user, call {@link stopImpersonating}.
   *
   * @param userId - The identifier of the user to impersonate.
   */
  startImpersonating(userId: AuthUserIdentifier): void {
    const previous = this._impersonatedUserId.value;
    const isValidTarget = userId !== NO_AUTH_USER_IDENTIFIER && userId !== this._currentRealUserId && userId !== previous;

    if (isValidTarget) {
      this._impersonatedUserId.next(userId);
      this._emit('start', userId, previous, 'manual');
    }
  }

  /**
   * Ends impersonation, reverting the effective user to the real authenticated user. No-ops if not impersonating.
   */
  stopImpersonating(): void {
    this._clear('manual');
  }

  private _clear(reason: DbxAuthImpersonationEventReason): void {
    const previous = this._impersonatedUserId.value;

    if (previous != null) {
      this._impersonatedUserId.next(undefined);
      this._emit('end', undefined, previous, reason);
    }
  }

  private _emit(type: DbxAuthImpersonationEventType, impersonatedUserId: Maybe<AuthUserIdentifier>, previousImpersonatedUserId: Maybe<AuthUserIdentifier>, reason: DbxAuthImpersonationEventReason): void {
    this._events.next({ type, impersonatedUserId, previousImpersonatedUserId, reason });
  }
}
