import { type Maybe, type AuthRole, type ArrayOrValue } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { authRolesSetContainsAllRolesFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural directive that conditionally renders its host element based on whether
 * the currently authenticated user possesses **all** of the specified auth roles.
 *
 * Similar to `*ngIf`, this directive shows or hides content reactively as the user's
 * roles change. It uses {@link DbxAuthService.authRoles$} to observe the current role set
 * and checks that every role in the target list is present.
 *
 * @example
 * ```html
 * <!-- Show only if user has the 'admin' role -->
 * <div *dbxAuthHasRoles="'admin'">Admin-only content</div>
 *
 * <!-- Show only if user has BOTH 'editor' and 'reviewer' roles -->
 * <div *dbxAuthHasRoles="['editor', 'reviewer']">Editor and reviewer content</div>
 * ```
 *
 * @see {@link DbxAuthHasAnyRoleDirective} for matching **any** of the specified roles.
 * @see {@link DbxAuthNotAnyRoleDirective} for excluding users with specified roles.
 */
@Directive({
  selector: '[dbxAuthHasRoles]',
  standalone: true
})
export class DbxAuthHasRolesDirective extends AbstractIfDirective {
  private readonly _authService = inject(DbxAuthService);

  readonly targetRoles = input<Maybe<ArrayOrValue<AuthRole>>>(undefined, { alias: 'dbxAuthHasRoles' });
  readonly targetRoles$ = toObservable(this.targetRoles);

  readonly show$: Observable<boolean> = this._authService.authRoles$.pipe(authRolesSetContainsAllRolesFrom(this.targetRoles$));
}
