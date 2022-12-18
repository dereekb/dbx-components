import { Injectable } from '@angular/core';
import { Maybe, ModelKeyTypeNamePair } from '@dereekb/util';
import { Observable } from 'rxjs';
import { DbxModelViewTrackerEvent, DbxModelViewTrackerEventSet } from './model.tracker';
import { DbxModelViewTrackerStorage } from './model.tracker.view.storage';

/**
 * Service used for tracking/logging different kinds of events on objects.
 */
@Injectable()
export class DbxModelTrackerService {
  private _defaultFolder: Maybe<string>;

  constructor(private readonly viewTrackerStorage: DbxModelViewTrackerStorage) {}

  get defaultFolder(): Maybe<string> {
    return this._defaultFolder;
  }

  set defaultFolder(folder: Maybe<string>) {
    this._defaultFolder = folder ?? undefined;
  }

  // MARK: View
  trackViewedDbxModel(modelKeyTypeNamePair: ModelKeyTypeNamePair, folder: Maybe<string> = this._defaultFolder): void {
    this.viewTrackerStorage
      .addEvent({
        m: modelKeyTypeNamePair,
        folder
      })
      .subscribe();
  }

  getAllViewEvents(folder: Maybe<string> = this._defaultFolder): Observable<DbxModelViewTrackerEvent[]> {
    return this.viewTrackerStorage.getAllEvents(folder);
  }

  getViewEventSet(folder: Maybe<string> = this._defaultFolder): Observable<DbxModelViewTrackerEventSet> {
    return this.viewTrackerStorage.getEventSet(folder);
  }
}
