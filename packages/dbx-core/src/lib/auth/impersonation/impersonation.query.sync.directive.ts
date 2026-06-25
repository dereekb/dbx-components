import { Directive, Input, inject } from '@angular/core';
import { IMPERSONATION_URL_QUERY_PARAM, type Maybe } from '@dereekb/util';
import { type ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, of, switchMap, type Observable } from 'rxjs';
import { type AuthUserIdentifier, NO_AUTH_USER_IDENTIFIER } from '../auth.user';
import { DbxAuthService } from '../service';
import { DbxRouterService } from '../../router/router/service/router.service';
import { dbxRouteParamReaderInstance } from '../../router/router/util/route.reader';
import { clean, cleanSubscription, completeOnDestroy } from '../../rxjs';
import { DbxAuthImpersonationService } from './impersonation.service';

/**
 * Configuration for {@link DbxAuthImpersonationQuerySyncDirective}.
 */
export interface DbxAuthImpersonationQuerySyncConfig {
  /**
   * Query parameter key the impersonation uid is read from. Defaults to {@link IMPERSONATION_URL_QUERY_PARAM} (`imp`).
   */
  readonly paramKey?: Maybe<string>;
  /**
   * Optional authorization gate consulted before impersonation begins. When provided, impersonation only
   * starts for a target uid this resolves truthy for; a falsy result is treated the same as no `imp` param
   * (impersonation stops). Omit to leave the sync ungated (matching {@link DbxAuthImpersonationTriggerDirective}).
   */
  readonly canImpersonate?: Maybe<(uid: AuthUserIdentifier) => ObservableOrValue<boolean>>;
}

/**
 * Keeps impersonation in sync with the uid read from the current route's query parameters
 * (default `?imp=<uid>`). Unlike {@link DbxAuthImpersonationTriggerDirective} (which reads a path `:uid` via a
 * host `dbxRouteModelId`), this directive reads its own query param, so appending `?imp=<uid>` to any in-app
 * URL begins impersonation and removing it ends impersonation.
 *
 * Place it once on an app-shell element. The query param must be declared on an ancestor state
 * (e.g. the app's root state `url: '/app?imp'`, ideally `dynamic: true`) so UIRouter surfaces it in
 * the current route params. Requires {@link provideDbxAuthImpersonation} to have registered the service.
 *
 * ```html
 * <div dbxAuthImpersonationQuerySync>
 *   <ui-view></ui-view>
 * </div>
 * ```
 *
 * Avoid pairing it with {@link DbxAuthImpersonationTriggerDirective} on overlapping routes — both write the
 * impersonation state and would contend.
 */
@Directive({
  selector: '[dbxAuthImpersonationQuerySync]',
  standalone: true
})
export class DbxAuthImpersonationQuerySyncDirective {
  private readonly _dbxRouterService = inject(DbxRouterService);
  private readonly _impersonationService = inject(DbxAuthImpersonationService);
  private readonly _dbxAuthService = inject(DbxAuthService);

  private readonly _config = completeOnDestroy(new BehaviorSubject<Maybe<DbxAuthImpersonationQuerySyncConfig>>(undefined));
  private readonly _reader = clean(dbxRouteParamReaderInstance<AuthUserIdentifier>(this._dbxRouterService, IMPERSONATION_URL_QUERY_PARAM));

  constructor() {
    cleanSubscription(this._config.pipe(map((config) => config?.paramKey)).subscribe((paramKey) => this._reader.setParamKey(paramKey)));

    const canImpersonate$ = this._config.pipe(
      map((config) => config?.canImpersonate),
      distinctUntilChanged()
    );

    const impersonatedUserId$: Observable<Maybe<AuthUserIdentifier>> = combineLatest([this._reader.value$, this._dbxAuthService.userIdentifier$, canImpersonate$]).pipe(
      switchMap(([routeUid, currentUid, canImpersonate]) => {
        let result: Observable<Maybe<AuthUserIdentifier>>;

        if (routeUid != null && routeUid !== NO_AUTH_USER_IDENTIFIER && routeUid !== currentUid) {
          result = canImpersonate != null ? asObservable(canImpersonate(routeUid)).pipe(map((allowed) => (allowed ? routeUid : undefined))) : of(routeUid);
        } else {
          result = of(undefined);
        }

        return result;
      })
    );

    cleanSubscription(
      impersonatedUserId$.subscribe((impersonatedUserId) => {
        if (impersonatedUserId != null) {
          this._impersonationService.startImpersonating(impersonatedUserId);
        } else {
          this._impersonationService.stopImpersonating();
        }
      })
    );
  }

  @Input('dbxAuthImpersonationQuerySync')
  set config(config: Maybe<DbxAuthImpersonationQuerySyncConfig> | '') {
    this._config.next(config || undefined);
  }
}
