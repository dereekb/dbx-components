import { Maybe, AuthRole, ArrayOrValue } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy, inject } from '@angular/core';
import { authRolesSetContainsNoRolesFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural decorator directive similar to ngIf that embeds content if the current auth user has none of the target role(s).
 */
@Directive({
  selector: '[dbxAuthNotAnyRole]'
})
export class DbxAuthNotAnyRoleDirective extends AbstractIfDirective implements OnDestroy {
  private _targetRoles = new BehaviorSubject<Maybe<ArrayOrValue<AuthRole>>>(undefined);

  readonly targetRoles$ = this._targetRoles.asObservable();

  readonly show$ = inject(DbxAuthService).authRoles$.pipe(authRolesSetContainsNoRolesFrom(this.targetRoles$));

  override ngOnDestroy(): void {
    this._targetRoles.complete();
  }

  @Input('dbxAuthNotAnyRole')
  set targetRoles(roles: Maybe<ArrayOrValue<AuthRole>>) {
    this._targetRoles.next(roles);
  }
}
