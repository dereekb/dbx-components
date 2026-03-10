import { Directive, inject } from '@angular/core';
import { DbxRouteModelIdDirectiveDelegate } from './model.router';
import { DbxAuthService } from '../../auth';
import { cleanSubscription } from '../../rxjs';

/**
 * Directive that retrieves the currently authenticated user's identifier from {@link DbxAuthService}
 * and passes it directly to a {@link DbxRouteModelIdDirectiveDelegate}.
 *
 * This is useful for routes that should always use the current user's ID, bypassing route parameter reading entirely.
 *
 * @example
 * ```html
 * <!-- Automatically provides the authenticated user's ID to the delegate -->
 * <div dbxRouteModelIdFromAuthUserId></div>
 * ```
 *
 * @see {@link DbxRouteModelIdDirectiveDelegate} for the delegate that receives the id observables
 * @see {@link DbxAuthService} for the authentication service providing the user identifier
 */
@Directive({
  selector: '[dbxRouteModelIdFromAuthUserId]',
  standalone: true
})
export class DbxRouteModelIdFromAuthUserIdDirective {
  readonly dbxAuthService = inject(DbxAuthService);
  readonly dbxRouteModelIdDelegate = inject(DbxRouteModelIdDirectiveDelegate, { host: true });

  constructor() {
    cleanSubscription(this.dbxRouteModelIdDelegate.useRouteModelIdParamsObservable(this.dbxAuthService.userIdentifier$, this.dbxAuthService.userIdentifier$));
  }
}
