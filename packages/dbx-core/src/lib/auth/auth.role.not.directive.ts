import { type Maybe, type AuthRole, type ArrayOrValue } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { authRolesSetContainsNoRolesFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural directive that conditionally renders its host element based on whether
 * the currently authenticated user possesses **none** of the specified auth roles.
 *
 * This is the inverse of {@link DbxAuthHasAnyRoleDirective}. Content is shown only when
 * the user does not have any of the listed roles. Useful for hiding content from
 * privileged users or showing fallback UI for unprivileged users.
 *
 * @example
 * ```html
 * <!-- Show only if user does NOT have the 'admin' role -->
 * <div *dbxAuthNotAnyRole="'admin'">Non-admin content</div>
 *
 * <!-- Show only if user has NEITHER 'banned' nor 'suspended' role -->
 * <div *dbxAuthNotAnyRole="['banned', 'suspended']">Active user content</div>
 * ```
 *
 * @see {@link DbxAuthHasRolesDirective} for requiring **all** specified roles.
 * @see {@link DbxAuthHasAnyRoleDirective} for requiring **any** of the specified roles.
 */
@Directive({
  selector: '[dbxAuthNotAnyRole]',
  standalone: true
})
export class DbxAuthNotAnyRoleDirective extends AbstractIfDirective {
  private readonly _authService = inject(DbxAuthService);

  readonly targetRoles = input<Maybe<ArrayOrValue<AuthRole>>>(undefined, { alias: 'dbxAuthNotAnyRole' });
  readonly targetRoles$ = toObservable(this.targetRoles);

  readonly show$: Observable<boolean> = this._authService.authRoles$.pipe(authRolesSetContainsNoRolesFrom(this.targetRoles$));
}
