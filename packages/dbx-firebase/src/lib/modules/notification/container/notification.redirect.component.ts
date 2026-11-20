import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DbxRouterService, type SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { type DocumentDataWithIdAndKey, type NotificationRedirectEntry, documentDataWithIdAndKey, isNotificationRedirectEntryId } from '@dereekb/firebase';
import { filterMaybe, isLoadingStateLoading } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type Observable, combineLatest, distinctUntilChanged, filter, first, firstValueFrom, from, map, of, switchMap } from 'rxjs';
import { DbxFirebaseModelTypesService } from '../../../model/modules/model/model.types.service';
import {
  DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ROUTE_PARAM_KEY,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_SNACKBAR_DURATION,
  DbxFirebaseNotificationRedirectConfig,
  type DbxFirebaseNotificationRedirectDecision,
  type DbxFirebaseNotificationRedirectEntryLoadResult,
  dbxFirebaseNotificationRedirectDecision
} from '../service/notification.redirect';
import { NotificationRedirectEntryDocumentStore } from '../store/notificationredirectentry.document.store';

/**
 * Firestore error code returned when the signed-in user may not read the entry.
 */
const PERMISSION_DENIED_ERROR_CODE = 'permission-denied';

/**
 * The notification short link page. Reads the short link id from the route, loads its NotificationRedirectEntry, and
 * sends the person to the entry's target page, replacing the short link in the browser history.
 *
 * When the entry has expired, no longer exists, or belongs to a different account, it opens the fallback page for the
 * id's prefix instead and shows a message. See {@link DbxFirebaseNotificationRedirectConfig}, provided through the
 * `redirect` key of `provideDbxFirebaseNotifications()`.
 *
 * Put it on a route that requires a signed-in user, so a signed-out person signs in and comes back first.
 *
 * @example
 * ```ts
 * export const SHORT_LINK_STATE: Ng2StateDeclaration = {
 *   url: '/s/:key',
 *   name: 'app.shortlink',
 *   component: DbxFirebaseNotificationRedirectComponent
 * };
 * ```
 */
@Component({
  selector: 'dbx-firebase-notification-redirect',
  template: `
    <dbx-loading [loading]="true" [text]="text()"></dbx-loading>
  `,
  providers: [NotificationRedirectEntryDocumentStore],
  imports: [DbxLoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseNotificationRedirectComponent {
  private readonly _config = inject(DbxFirebaseNotificationRedirectConfig);
  private readonly _store = inject(NotificationRedirectEntryDocumentStore);
  private readonly _dbxRouterService = inject(DbxRouterService);
  private readonly _matSnackBar = inject(MatSnackBar);
  private readonly _dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService, { optional: true });

  /**
   * Text shown while the link opens.
   */
  readonly text = input<Maybe<string>>('Opening link...');

  /**
   * Short link id. Defaults to the route param named by {@link DbxFirebaseNotificationRedirectConfig.routeParamKey}.
   */
  readonly id = input<Maybe<string>>();

  constructor() {
    const routeParamKey = this._config.routeParamKey ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ROUTE_PARAM_KEY;
    const routeId$ = this._dbxRouterService.params$.pipe(map((params) => params[routeParamKey] as Maybe<string>));

    combineLatest([toObservable(this.id), routeId$])
      .pipe(
        map(([id, routeId]) => id ?? routeId),
        filterMaybe(),
        distinctUntilChanged(),
        switchMap((id) => this._loadEntry(id).pipe(map((load) => dbxFirebaseNotificationRedirectDecision({ config: this._config, id, load })))),
        first(),
        takeUntilDestroyed()
      )
      .subscribe((decision) => this._followDecision(decision));
  }

  private _loadEntry(id: string): Observable<DbxFirebaseNotificationRedirectEntryLoadResult> {
    let result: Observable<DbxFirebaseNotificationRedirectEntryLoadResult>;

    if (isNotificationRedirectEntryId(id)) {
      this._store.setId(id);

      result = this._store.snapshotLoadingState$.pipe(
        filter((state) => !isLoadingStateLoading(state)),
        first(),
        switchMap((state) => {
          let loadResult: Observable<DbxFirebaseNotificationRedirectEntryLoadResult>;
          const entry = state.value ? documentDataWithIdAndKey(state.value) : undefined;

          if (state.error) {
            const errorResult: DbxFirebaseNotificationRedirectEntryLoadResult = state.error.code === PERMISSION_DENIED_ERROR_CODE ? { type: 'not_owner' } : { type: 'error' };
            loadResult = of(errorResult);
          } else if (entry) {
            loadResult = from(this._targetSegueRef(entry)).pipe(map((targetSegueRef): DbxFirebaseNotificationRedirectEntryLoadResult => ({ type: 'found', entry, targetSegueRef })));
          } else {
            loadResult = of<DbxFirebaseNotificationRedirectEntryLoadResult>({ type: 'missing' });
          }

          return loadResult;
        })
      );
    } else {
      result = of<DbxFirebaseNotificationRedirectEntryLoadResult>({ type: 'missing' });
    }

    return result;
  }

  private async _targetSegueRef(entry: DocumentDataWithIdAndKey<NotificationRedirectEntry>): Promise<Maybe<SegueRefOrSegueRefRouterLink>> {
    let segueRef = await this._config.segueRefForEntry?.(entry);

    if (segueRef == null && entry.m != null && this._dbxFirebaseModelTypesService != null) {
      segueRef = await firstValueFrom(this._dbxFirebaseModelTypesService.segueRefForKey(entry.m));
    }

    return segueRef;
  }

  private _followDecision(decision: DbxFirebaseNotificationRedirectDecision): void {
    if (decision.message) {
      this._matSnackBar.open(decision.message, undefined, { duration: this._config.snackbarDuration ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_SNACKBAR_DURATION });
    }

    // Replace the short link in the history, so the back button does not open it and redirect again.
    void this._dbxRouterService.go(decision.segueRef, { replace: true });
  }
}
