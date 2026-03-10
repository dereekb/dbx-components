import { type AuthRole, type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { authRolesSetContainsAnyRoleFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural directive that conditionally renders its host element based on whether
 * the currently authenticated user possesses **at least one** of the specified auth roles.
 *
 * Similar to `*ngIf`, this directive shows or hides content reactively as the user's
 * roles change. It uses {@link DbxAuthService.authRoles$} to observe the current role set
 * and checks that at least one role in the target list is present.
 *
 * @example
 * ```html
 * <!-- Show if user has either 'admin' or 'moderator' role -->
 * <div *dbxAuthHasAnyRole="['admin', 'moderator']">Privileged content</div>
 *
 * <!-- Show if user has the 'viewer' role -->
 * <div *dbxAuthHasAnyRole="'viewer'">Viewer content</div>
 * ```
 *
 * @see {@link DbxAuthHasRolesDirective} for requiring **all** specified roles.
 * @see {@link DbxAuthNotAnyRoleDirective} for excluding users with specified roles.
 */
@Directive({
  selector: '[dbxAuthHasAnyRole]',
  standalone: true
})
export class DbxAuthHasAnyRoleDirective extends AbstractIfDirective {
  private readonly _authService = inject(DbxAuthService);

  readonly targetRoles = input<Maybe<ArrayOrValue<AuthRole>>>(undefined, { alias: 'dbxAuthHasAnyRole' });
  readonly targetRoles$ = toObservable(this.targetRoles);

  readonly show$: Observable<boolean> = this._authService.authRoles$.pipe(authRolesSetContainsAnyRoleFrom(this.targetRoles$));
}
