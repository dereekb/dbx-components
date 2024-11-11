import { AuthRole, ArrayOrValue, Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy, inject } from '@angular/core';
import { authRolesSetContainsAnyRoleFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural decorator directive similar to ngIf that embeds content if the current auth user has any of the target role(s).
 */
@Directive({
  selector: '[dbxAuthHasAnyRole]'
})
export class DbxAuthHasAnyRoleDirective extends AbstractIfDirective implements OnDestroy {
  private _targetRoles = new BehaviorSubject<Maybe<ArrayOrValue<AuthRole>>>(undefined);

  readonly targetRoles$ = this._targetRoles.asObservable();

  readonly show$ = inject(DbxAuthService).authRoles$.pipe(authRolesSetContainsAnyRoleFrom(this.targetRoles$));

  override ngOnDestroy(): void {
    this._targetRoles.complete();
  }

  @Input('dbxAuthHasAnyRole')
  set targetRoles(roles: Maybe<ArrayOrValue<AuthRole>>) {
    this._targetRoles.next(roles);
  }
}
