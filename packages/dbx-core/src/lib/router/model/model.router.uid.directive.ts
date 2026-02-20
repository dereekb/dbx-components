import { Directive, inject } from '@angular/core';
import { DbxRouteModelIdDirectiveDelegate } from './model.router';
import { DbxAuthService } from '../../auth';
import { cleanSubscription } from '../../rxjs';

/**
 * Used for retrieving the user's current id DbxAuthService and passes it as an identifier for a DbxRouteModelIdDirectiveDelegate.
 */
@Directive({
  selector: '[dbxRouteModelIdFromAuthUserId]',
  standalone: true
})
export class DbxRouteModelIdFromAuthUserIdDirective {
  readonly dbxAuthService = inject(DbxAuthService);
  readonly dbxRouteModelIdDelegate = inject(DbxRouteModelIdDirectiveDelegate, { host: true });

  constructor() {
    cleanSubscription(this.dbxRouteModelIdDelegate.useRouteModelIdParamsObservable(this.dbxAuthService.userIdentifier$, this.dbxAuthService.userIdentifier$));
  }
}
