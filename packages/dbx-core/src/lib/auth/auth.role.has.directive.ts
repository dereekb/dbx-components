import { Maybe, AuthRole, ArrayOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';
import { Directive, Input, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { authRolesSetContainsAllRolesFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural decorator directive similar to ngIf that embeds content if the current auth user has all of the target role(s).
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
