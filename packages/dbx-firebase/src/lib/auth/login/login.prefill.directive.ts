import { Directive, effect, inject, input } from '@angular/core';
import { DbxRouterService, clean, cleanSubscription, dbxRouteParamReaderInstance } from '@dereekb/dbx-core';
import { type EmailAddress, type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, map, type Observable } from 'rxjs';
import { DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_EMAIL_PARAM, DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_PASSWORD_PARAM, type DbxFirebaseLoginPrefill } from './login.prefill';
import { DbxFirebaseLoginPrefillStore, provideDbxFirebaseLoginPrefill } from './login.prefill.store';

/**
 * Configuration for {@link DbxFirebaseLoginPrefillDirective}.
 */
export interface DbxFirebaseLoginPrefillConfig {
  /**
   * Query parameter key the email address is read from. Defaults to {@link DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_EMAIL_PARAM} (`email`).
   */
  readonly emailParam?: Maybe<string>;
  /**
   * Query parameter key the password is read from. Defaults to {@link DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_PASSWORD_PARAM} (`password`).
   */
  readonly passwordParam?: Maybe<string>;
  /**
   * Whether the matching provider opens its login view on its own to present the prefill. True by default. Set false
   * to seed the form but still make the user pick the provider out of the login list.
   */
  readonly autoOpen?: Maybe<boolean>;
}

/**
 * Provides a {@link DbxFirebaseLoginPrefillStore} to descendant login providers, filled from the current route's
 * query parameters (default `?email=<address>&password=<password>`).
 *
 * Place it around a `dbx-firebase-login`. The parameters must be declared on the login state (e.g.
 * `url: '/login?email&password'`) so UIRouter surfaces them rather than dropping them off the url.
 *
 * ```html
 * <div dbxFirebaseLoginPrefill>
 *   <dbx-firebase-login></dbx-firebase-login>
 * </div>
 * ```
 *
 * Only the email login provider reads the prefill today.
 */
@Directive({
  selector: '[dbxFirebaseLoginPrefill]',
  providers: provideDbxFirebaseLoginPrefill(),
  exportAs: 'loginPrefill'
})
export class DbxFirebaseLoginPrefillDirective {
  private readonly _dbxRouterService = inject(DbxRouterService);

  readonly dbxFirebaseLoginPrefillStore = inject(DbxFirebaseLoginPrefillStore);

  private readonly _emailReader = clean(dbxRouteParamReaderInstance<EmailAddress>(this._dbxRouterService, DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_EMAIL_PARAM));
  private readonly _passwordReader = clean(dbxRouteParamReaderInstance<string>(this._dbxRouterService, DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_PASSWORD_PARAM));

  readonly config = input<Maybe<DbxFirebaseLoginPrefillConfig> | ''>(undefined, { alias: 'dbxFirebaseLoginPrefill' });

  readonly prefill$: Observable<Maybe<DbxFirebaseLoginPrefill>> = combineLatest([this._emailReader.value$, this._passwordReader.value$]).pipe(
    map(([email, password]) => (email || password ? { email, password } : undefined)),
    distinctUntilChanged((a, b) => a?.email === b?.email && a?.password === b?.password)
  );

  protected readonly _configEffect = effect(() => {
    const config = this.config() || undefined;

    this._emailReader.setParamKey(config?.emailParam);
    this._passwordReader.setParamKey(config?.passwordParam);
    this.dbxFirebaseLoginPrefillStore.setAutoOpen(config?.autoOpen !== false); // true by default
  });

  constructor() {
    cleanSubscription(this.prefill$.subscribe((prefill) => this.dbxFirebaseLoginPrefillStore.setPrefill(prefill)));
  }
}
