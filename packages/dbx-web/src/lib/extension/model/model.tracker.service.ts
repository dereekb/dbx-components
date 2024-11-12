import { Injectable, inject } from '@angular/core';
import { Maybe, ModelKeyTypeNamePair } from '@dereekb/util';
import { first, Observable } from 'rxjs';
import { DbxModelViewTrackerEvent, DbxModelViewTrackerEventSet } from './model.tracker';
import { DbxModelViewTrackerStorage } from './model.tracker.view.storage';

/**
 * Service used for tracking/logging different kinds of events on objects.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxModelTrackerService {
  private readonly _viewTrackerStorage = inject(DbxModelViewTrackerStorage);

  private _defaultFolder: Maybe<string>;

  readonly newEvent$ = this._viewTrackerStorage.newEvent$;

  get defaultFolder(): Maybe<string> {
    return this._defaultFolder;
  }

  set defaultFolder(folder: Maybe<string>) {
    this._defaultFolder = folder ?? undefined;
  }

  // MARK: View
  trackViewedObject(modelKeyTypeNamePair: ModelKeyTypeNamePair, context?: string, folder: Maybe<string> = this._defaultFolder): void {
    this._viewTrackerStorage
      .addTrackerEvent({
        m: modelKeyTypeNamePair,
        c: context,
        folder
      })
      .pipe(first())
      .subscribe();
  }

  getAllViewEvents(folder: Maybe<string> = this._defaultFolder): Observable<DbxModelViewTrackerEvent[]> {
    return this._viewTrackerStorage.getAllEvents(folder);
  }

  getViewEventSet(folder: Maybe<string> = this._defaultFolder): Observable<DbxModelViewTrackerEventSet> {
    return this._viewTrackerStorage.getEventSet(folder);
  }
}
