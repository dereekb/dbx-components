import { Maybe, AuthRole, ArrayOrValue } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy } from '@angular/core';
import { authRolesSetContainsNoRolesFrom, DbxAuthService } from './service';
import { AbstractIfDirective } from '../view/if.directive';

/**
 * Structural decorator directive similar to ngIf that embeds content if the current auth user has none of the target role(s).
 */
@Directive({
  selector: '[dbxAuthNotAnyRoles]'
})
export class DbxAuthNotAnyRolesDirective extends AbstractIfDirective implements OnDestroy {
  private _targetRoles = new BehaviorSubject<Maybe<ArrayOrValue<AuthRole>>>(undefined);
  readonly targetRoles$ = this._targetRoles.asObservable();

  readonly show$ = this.dbxAuthService.authRoles$.pipe(authRolesSetContainsNoRolesFrom(this.targetRoles$));

  constructor(templateRef: TemplateRef<unknown>, viewContainer: ViewContainerRef, private dbxAuthService: DbxAuthService) {
    super(templateRef, viewContainer);
  }

  override ngOnDestroy(): void {
    this._targetRoles.complete();
  }

  @Input('dbxAuthNotRoles')
  set targetRoles(roles: Maybe<ArrayOrValue<AuthRole>>) {
    this._targetRoles.next(roles);
  }
}
