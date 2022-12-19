import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { onDbxAppAuth } from '@dereekb/dbx-core';
import { DbxModelTrackerService } from '../../model.tracker.service';
import { onDbxModel } from '..';

/**
 * Used to pass Object Store events to the ObjectTracker.
 */
@Injectable()
export class DbxModelTrackerEffects {
  constructor(private readonly actions$: Actions, private readonly dbxModelTrackerService: DbxModelTrackerService) {}

  readonly trackModelViewed$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(onDbxModel.DbxModelStateModelActions.emitObjectViewEvent),
        distinctUntilChanged((a, b) => a?.modelKeyTypeNamePair.key === b?.modelKeyTypeNamePair.key && a?.type === b?.type && a?.context === b?.context),
        tap((x) => {
          this.dbxModelTrackerService.trackViewedObject(x.modelKeyTypeNamePair, x.context);
        })
      ),
    { dispatch: false }
  );

  readonly changeTrackerFolderToMatchAuth$ = createEffect(
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
