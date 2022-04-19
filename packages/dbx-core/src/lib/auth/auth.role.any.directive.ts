import { ArrayOrValue } from '@dereekb/util';
import { AuthRole } from './auth.role';
import { BehaviorSubject } from 'rxjs';
import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy } from '@angular/core';
import { authRolesSetContainsAnyRoleFrom, DbxAuthService } from './service';
import { Maybe } from '@dereekb/util';
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

  readonly show$ = this.dbxAuthService.authRoles$.pipe(authRolesSetContainsAnyRoleFrom(this.targetRoles$));

  constructor(
    templateRef: TemplateRef<any>,
    viewContainer: ViewContainerRef,
    private dbxAuthService: DbxAuthService
  ) {
    super(templateRef, viewContainer);
  }

  override ngOnDestroy(): void {
    this._targetRoles.complete();
  }

  @Input('dbxAuthHasAnyRole')
  set targetRoles(roles: Maybe<ArrayOrValue<AuthRole>>) {
    this._targetRoles.next(roles);
  }

}
