import { Maybe, AuthRole, ArrayOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';
import { Directive, Input, inject, signal } from '@angular/core';
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
  private readonly _targetRoles = signal<Maybe<ArrayOrValue<AuthRole>>>(undefined);
  private readonly _authService = inject(DbxAuthService);

  readonly targetRoles$ = toObservable(this._targetRoles);

  readonly show$: Observable<boolean> = this._authService.authRoles$.pipe(authRolesSetContainsNoRolesFrom(this.targetRoles$));

  @Input('dbxAuthNotAnyRole')
  set targetRoles(roles: Maybe<ArrayOrValue<AuthRole>>) {
    this._targetRoles.set(roles);
  }
}
