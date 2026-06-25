import { Directive, booleanAttribute, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, shareReplay, switchMap, type Observable } from 'rxjs';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { DbxRouteModelIdDirectiveDelegate } from './model.router';
import { DbxAuthService } from '../../auth';
import { DbxAuthImpersonationService } from '../../auth/impersonation/impersonation.service';
import { cleanSubscription } from '../../rxjs';

/**
 * Directive that retrieves the current user's identifier and passes it directly to a {@link DbxRouteModelIdDirectiveDelegate}.
 *
 * This is useful for routes that should always use the current user's ID, bypassing route parameter reading entirely.
 *
 * When impersonation is available ({@link provideDbxAuthImpersonation}), it uses the
 * {@link DbxAuthImpersonationService.effectiveUserId$ effective} user id — the impersonated user while impersonating,
 * otherwise the real authenticated user — so impersonation transparently re-keys these routes. Without impersonation
 * registered, it falls back to {@link DbxAuthService}'s real user identifier (the prior behavior). Set
 * `ignoreAuthImpersonation` to opt out and always use the real user id, even while impersonating.
 *
 * @example
 * ```html
 * <!-- Uses the effective (impersonated-or-real) user's ID -->
 * <div dbxRouteModelIdFromAuthUserId></div>
 *
 * <!-- Always uses the real authenticated user's ID, ignoring impersonation -->
 * <div dbxRouteModelIdFromAuthUserId [ignoreAuthImpersonation]="true"></div>
 * ```
 *
 * @see {@link DbxRouteModelIdDirectiveDelegate} for the delegate that receives the id observables
 * @see {@link DbxAuthService} for the authentication service providing the user identifier
 * @see {@link DbxAuthImpersonationService} for the impersonation-aware effective user id
 */
@Directive({
  selector: '[dbxRouteModelIdFromAuthUserId]',
  standalone: true
})
export class DbxRouteModelIdFromAuthUserIdDirective {
  readonly dbxAuthService = inject(DbxAuthService);
  readonly dbxAuthImpersonationService = inject(DbxAuthImpersonationService, { optional: true });
  readonly dbxRouteModelIdDelegate = inject(DbxRouteModelIdDirectiveDelegate, { host: true });

  /**
   * Whether to ignore impersonation and always use the real authenticated user's id. Defaults to `false`
   * (the effective — impersonated-or-real — user id is used). Set it (e.g. as a bare attribute) on routes
   * that must always target the real user even while impersonating.
   */
  readonly ignoreAuthImpersonation = input(false, { transform: booleanAttribute });

  constructor() {
    const { dbxAuthService, dbxAuthImpersonationService } = this;
    const userId$: Observable<Maybe<ModelKey>> = toObservable(this.ignoreAuthImpersonation).pipe(
      distinctUntilChanged(),
      switchMap((ignore) => (ignore || dbxAuthImpersonationService == null ? dbxAuthService.userIdentifier$ : dbxAuthImpersonationService.effectiveUserId$)),
      shareReplay(1)
    );
    cleanSubscription(this.dbxRouteModelIdDelegate.useRouteModelIdParamsObservable(userId$, userId$));
  }
}
