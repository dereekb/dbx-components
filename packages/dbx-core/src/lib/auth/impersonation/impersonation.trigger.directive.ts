import { Directive, inject } from '@angular/core';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { combineLatest, type Observable, type Subscription } from 'rxjs';
import { NO_AUTH_USER_IDENTIFIER } from '../auth.user';
import { DbxAuthService } from '../service';
import { DbxRouteModelIdDirectiveDelegate, provideDbxRouteModelIdDirectiveDelegate } from '../../router/model/model.router';
import { DbxAuthImpersonationService } from './impersonation.service';

/**
 * Route-driven trigger that begins/ends impersonation based on the model id read from the current route.
 *
 * Pair it with the {@link DbxRouteModelIdDirective} (`dbxRouteModelId`) in a template:
 *
 * ```html
 * <div dbxRouteModelId="uid" dbxAuthImpersonationTrigger>
 *   <ui-view></ui-view>
 * </div>
 * ```
 *
 * When the route id is a non-sentinel user different from the logged-in user, impersonation starts;
 * otherwise it stops. Requires {@link provideDbxAuthImpersonation} to have registered the service.
 */
@Directive({
  selector: '[dbxAuthImpersonationTrigger]',
  standalone: true,
  providers: provideDbxRouteModelIdDirectiveDelegate(DbxAuthImpersonationTriggerDirective)
})
export class DbxAuthImpersonationTriggerDirective extends DbxRouteModelIdDirectiveDelegate {
  private readonly _impersonationService = inject(DbxAuthImpersonationService);
  private readonly _dbxAuthService = inject(DbxAuthService);

  useRouteModelIdParamsObservable(_idFromParamsObs: Observable<Maybe<ModelKey>>, computedIdObs: Observable<Maybe<ModelKey>>): Subscription {
    return combineLatest([computedIdObs, this._dbxAuthService.userIdentifier$]).subscribe(([routeUid, currentUid]) => {
      if (routeUid != null && routeUid !== NO_AUTH_USER_IDENTIFIER && routeUid !== currentUid) {
        this._impersonationService.startImpersonating(routeUid);
      } else {
        this._impersonationService.stopImpersonating();
      }
    });
  }
}
