import { Injectable } from '@angular/core';
import { DbxAnalyticsUser, DbxAnalyticsUserProperties, DbxAnalyticsUserSource } from '@dereekb/dbx-analytics';
import { FactoryWithRequiredInput, Maybe } from '@dereekb/util';
import { BehaviorSubject, map, Observable, of, switchMap, shareReplay, combineLatest } from 'rxjs';
import { AuthUserInfo } from '../auth/auth';
import { DbxFirebaseAuthService } from '../auth/service/firebase.auth.service';

export type DbxFirebaseAnalyticsUserPropertiesFactory = FactoryWithRequiredInput<Observable<DbxAnalyticsUserProperties>, AuthUserInfo>;

export function readDbxAnalyticsUserPropertiesFromAuthUserInfo(user: AuthUserInfo): DbxAnalyticsUserProperties {
  const properties: DbxAnalyticsUserProperties = {
    name: user.displayName ?? '',
    email: user.email ?? ''
  };

  return properties;
}

export const DEFAULT_DBX_FIREBASE_ANALYTICS_USER_PROPERTIES_FACTORY: DbxFirebaseAnalyticsUserPropertiesFactory = (authUserInfo: AuthUserInfo) => of(readDbxAnalyticsUserPropertiesFromAuthUserInfo(authUserInfo));

/**
 * DbxAnalyticsUserSource implementation that uses the DbxFirebaseAuthService.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseAnalyticsUserSource implements DbxAnalyticsUserSource {
  private _userPropertiesFactory = new BehaviorSubject<DbxFirebaseAnalyticsUserPropertiesFactory>(DEFAULT_DBX_FIREBASE_ANALYTICS_USER_PROPERTIES_FACTORY);

  readonly analyticsUser$: Observable<Maybe<DbxAnalyticsUser>> = combineLatest([this._userPropertiesFactory, this.dbxFirebaseAuthService.currentAuthUserInfo$]).pipe(
    switchMap(([userPropertiesFactory, x]) => {
      let analyticsUser: Observable<Maybe<DbxAnalyticsUser>>;

      if (x != null) {
        analyticsUser = userPropertiesFactory(x).pipe(
          map((properties) => ({
            user: x.uid,
            properties
          }))
        );
      } else {
        analyticsUser = of(null);
      }

      return analyticsUser;
    }),
    shareReplay(1)
  );

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService) {}

  get userPropertiesFactory() {
    return this._userPropertiesFactory.value;
  }

  set userPropertiesFactory(userPropertiesFactory: DbxFirebaseAnalyticsUserPropertiesFactory) {
    this._userPropertiesFactory.next(userPropertiesFactory);
  }
}
