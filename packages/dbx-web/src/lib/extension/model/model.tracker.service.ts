import { Injectable, inject } from '@angular/core';
import { type Maybe, type ModelKeyTypeNamePair } from '@dereekb/util';
import { first, type Observable } from 'rxjs';
import { type DbxModelViewTrackerEvent, type DbxModelViewTrackerEventSet, type ModelViewContext } from './model.tracker';
import { DbxModelViewTrackerStorage } from './model.tracker.view.storage';

/**
 * Service used for tracking/logging different kinds of events on objects.
 */
@Injectable()
export class DbxModelTrackerService {
  private readonly _viewTrackerStorage = inject(DbxModelViewTrackerStorage);

  private _defaultFolder: Maybe<string>;

  /**
   * Emits whenever a new view tracker event is recorded.
   */
  readonly newEvent$ = this._viewTrackerStorage.newEvent$;

  /**
   * The default storage folder used when no folder is specified in tracking calls.
   *
   * @returns The current default folder name, or undefined if not set
   */
  get defaultFolder(): Maybe<string> {
    return this._defaultFolder;
  }

  set defaultFolder(folder: Maybe<string>) {
    this._defaultFolder = folder ?? undefined;
  }

  // MARK: View
  /**
   * Records a view event for the given model, optionally in a specific context and folder.
   *
   * @param modelKeyTypeNamePair - The model identity to track
   * @param context - Optional view context metadata
   * @param folder - Storage folder; defaults to {@link defaultFolder}
   */
  trackViewedObject(modelKeyTypeNamePair: ModelKeyTypeNamePair, context?: Maybe<ModelViewContext>, folder: Maybe<string> = this._defaultFolder): void {
    this._viewTrackerStorage
      .addTrackerEvent({
        m: modelKeyTypeNamePair,
        c: context,
        folder
      })
      .pipe(first())
      .subscribe();
  }

  /**
   * Returns all recorded view events for the given folder, sorted by most recent first.
   *
   * @param folder - Storage folder; defaults to {@link defaultFolder}
   * @returns Observable of view events sorted by most recent first
   */
  getAllViewEvents(folder: Maybe<string> = this._defaultFolder): Observable<DbxModelViewTrackerEvent[]> {
    return this._viewTrackerStorage.getAllEvents(folder);
  }

  /**
   * Returns the complete event set (events and last-update timestamp) for the given folder.
   *
   * @param folder - Storage folder; defaults to {@link defaultFolder}
   * @returns Observable of the complete event set including events and last-update timestamp
   */
  getViewEventSet(folder: Maybe<string> = this._defaultFolder): Observable<DbxModelViewTrackerEventSet> {
    return this._viewTrackerStorage.getEventSet(folder);
  }
}
