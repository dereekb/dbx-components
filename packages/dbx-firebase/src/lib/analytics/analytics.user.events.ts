import { Injectable } from '@angular/core';
import { DbxAnalyticsService, DbxAnalyticsUser, DbxAnalyticsUserProperties, DbxAnalyticsUserSource } from '@dereekb/dbx-analytics';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { Destroyable, FactoryWithRequiredInput, Initialized, Maybe } from '@dereekb/util';
import { BehaviorSubject, map, Observable, of, switchMap, shareReplay, combineLatest, first } from 'rxjs';
import { AuthUserInfo } from '../auth/auth';
import { DbxFirebaseAuthService } from '../auth/service/firebase.auth.service';
import { DbxFirebaseAnalyticsUserSource } from './analytics.user.source';

/**
 * Service that listens for DbxFirebaseAuthService changes and emits them a user events.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseAnalyticsUserEventsListener implements Initialized, Destroyable {
  private _loginSub = new SubscriptionObject();
  private _logoutSub = new SubscriptionObject();

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService, readonly dbxFirebaseAnalyticsUserSource: DbxFirebaseAnalyticsUserSource, readonly dbxAnalyticsService: DbxAnalyticsService) {}

  init(): void {
    this._loginSub.subscription = this.dbxFirebaseAuthService.onLogIn$.subscribe(() => {
      this.dbxFirebaseAnalyticsUserSource.analyticsUser$.pipe(filterMaybe(), first()).subscribe((analyticsUser) => {
        this.dbxAnalyticsService.sendUserLoginEvent(analyticsUser);
      });
    });

    this._logoutSub.subscription = this.dbxFirebaseAuthService.onLogOut$.subscribe(() => {
      this.dbxAnalyticsService.sendUserLogoutEvent();
    });
  }

  destroy(): void {
    this._loginSub.destroy();
    this._logoutSub.destroy();
  }
}
