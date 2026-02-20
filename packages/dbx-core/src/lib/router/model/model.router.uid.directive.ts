import { Directive, OnInit, inject } from '@angular/core';
import { DbxRouteModelIdDirectiveDelegate } from './model.router';
import { DbxAuthService } from '../../auth';
import { AbstractSubscriptionDirective } from '../../rxjs/rxjs.directive';

/**
 * Used for retrieving the user's current id DbxAuthService and passes it as an identifier for a DbxRouteModelIdDirectiveDelegate.
 */
@Directive({
  selector: '[dbxRouteModelIdFromAuthUserId]',
  standalone: true
})
export class DbxRouteModelIdFromAuthUserIdDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly dbxAuthService = inject(DbxAuthService);
  readonly dbxRouteModelIdDelegate = inject(DbxRouteModelIdDirectiveDelegate, { host: true });

  ngOnInit(): void {
    this.sub = this.dbxRouteModelIdDelegate.useRouteModelIdParamsObservable(this.dbxAuthService.userIdentifier$, this.dbxAuthService.userIdentifier$);
  }
}
