import { AuthRole, ArrayOrValue, type Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';
import { Directive, Input, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { authRolesSetContainsAnyRoleFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural decorator directive similar to ngIf that embeds content if the current auth user has any of the target role(s).
 */
@Directive({
  selector: '[dbxAuthHasAnyRole]',
  standalone: true
})
export class DbxAuthHasAnyRoleDirective extends AbstractIfDirective {
  private readonly _targetRoles = signal<Maybe<ArrayOrValue<AuthRole>>>(undefined);
  private readonly _authService = inject(DbxAuthService);

  readonly targetRoles$ = toObservable(this._targetRoles);

  readonly show$: Observable<boolean> = this._authService.authRoles$.pipe(authRolesSetContainsAnyRoleFrom(this.targetRoles$));

  @Input('dbxAuthHasAnyRole')
  set targetRoles(roles: Maybe<ArrayOrValue<AuthRole>>) {
    this._targetRoles.set(roles);
  }
}
