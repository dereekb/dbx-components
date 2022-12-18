import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { onDbxAppAuth } from '@dereekb/dbx-core';
import { DbxModelTrackerService } from '../../model.tracker.service';

/**
 * Used to pass Object Store events to the ObjectTracker.
 */
@Injectable()
export class DbxModelTrackerEffects {
  constructor(private readonly actions$: Actions, private readonly dbxModelTrackerService: DbxModelTrackerService) {}

  readonly setDefaultModelTrackerFolderFromAuth$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(onDbxAppAuth.DbxAppAuthUserActions.setUserIdentifier),
        map((x) => x.id),
        filter((x) => Boolean(x)),
        distinctUntilChanged(),
        tap((accountId) => {
          this.dbxModelTrackerService.defaultFolder = accountId;
        })
      ),
    { dispatch: false }
  );
}
