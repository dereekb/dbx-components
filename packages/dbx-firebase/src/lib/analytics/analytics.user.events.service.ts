import { inject, Injectable } from '@angular/core';
import { DbxAnalyticsService } from '@dereekb/dbx-analytics';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { Destroyable, Initialized } from '@dereekb/util';
import { first } from 'rxjs';
import { DbxFirebaseAuthService } from '../auth/service/firebase.auth.service';
import { DbxFirebaseAnalyticsUserSource } from './analytics.user.source';

/**
 * Service that listens for DbxFirebaseAuthService changes and emits them a user events.
 */
@Injectable()
export class DbxFirebaseAnalyticsUserEventsListenerService implements Initialized, Destroyable {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseAnalyticsUserSource = inject(DbxFirebaseAnalyticsUserSource);
  readonly dbxAnalyticsService = inject(DbxAnalyticsService);

  private readonly _loginSub = new SubscriptionObject();
  private readonly _logoutSub = new SubscriptionObject();

  init(): void {
    this._loginSub.subscription = this.dbxFirebaseAuthService.onLogIn$.subscribe(() => {
      this.dbxFirebaseAnalyticsUserSource.analyticsUser$.pipe(filterMaybe(), first()).subscribe((analyticsUser) => {
        this.dbxAnalyticsService.sendUserLoginEvent(analyticsUser);
      });
    });

    this._logoutSub.subscription = this.dbxFirebaseAuthService.onLogOut$.subscribe(() => {
      this.dbxAnalyticsService.sendUserLogoutEvent(undefined, false); // do not clear user. Will be cleared by the analytics service
    });
  }

  destroy(): void {
    this._loginSub.destroy();
    this._logoutSub.destroy();
  }
}
