import { Maybe, AuthRole, ArrayOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';
import { Directive, Input, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { authRolesSetContainsNoRolesFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural decorator directive similar to ngIf that embeds content if the current auth user has none of the target role(s).
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
