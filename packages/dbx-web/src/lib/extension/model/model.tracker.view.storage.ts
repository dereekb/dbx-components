import { unixTimeNumberForNow } from '@dereekb/date';
import { StorageAccessor } from '@dereekb/dbx-core';
import { UnixDateTimeNumber, ModelKeyTypePair, encodeModelKeyTypePair, ModelRelationUtility, Maybe } from '@dereekb/util';
import { Observable, of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { DbxModelViewTrackerEventSet, DbxModelViewTrackerEvent } from './model.tracker';

/**
 * Used for managing DbxModelViewTrackerEvent storage.
 */
export class DbxModelViewTrackerStorage {
  static readonly OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY = 'dbxModelViewTrackerEvents';
  static readonly MAX_EVENTS = 60;

  constructor(readonly storageAccessor: StorageAccessor<DbxModelViewTrackerEventSet>) {}

  protected get storageKey(): string {
    return DbxModelViewTrackerStorage.OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY;
  }

  protected get maxEventsToKeep(): number {
    return DbxModelViewTrackerStorage.MAX_EVENTS;
  }

  addEvent(event: DbxModelViewTrackerEvent): Observable<void> {
    const storageKey = this.getStorageKeyForFolder(event.folder);
    return this._getEventSetForStorageKey(storageKey).pipe(
      mergeMap((set) => {
        const nextEvent = {
          d: event.d ?? unixTimeNumberForNow(),
          m: event.m
        };

        const e = ModelRelationUtility.removeDuplicates(set.e, (x) => encodeModelKeyTypePair(x.m), [encodeModelKeyTypePair(nextEvent.m)]);
        e.push(nextEvent);
        e.sort((a, b) => (b.d ?? 0) - (a.d ?? 0));

        return this.storageAccessor.set(storageKey, {
          l: Math.max(set.l ?? 0, nextEvent.d),
          e: e.slice(0, this.maxEventsToKeep)
        });
      })
    );
  }

  getAllEvents(folder?: Maybe<string>): Observable<DbxModelViewTrackerEvent[]> {
    return this.getEventSet(folder).pipe(map((x) => x.e));
  }

  getEventSet(folder?: Maybe<string>): Observable<DbxModelViewTrackerEventSet> {
    const storageKey = this.getStorageKeyForFolder(folder);
    return this._getEventSetForStorageKey(storageKey);
  }

  private _getEventSetForStorageKey(storageKey: string): Observable<DbxModelViewTrackerEventSet> {
    return this.storageAccessor.get(storageKey).pipe(
      catchError((e) => {
        return of(undefined);
      }),
      map((result) => result ?? { e: [], l: 0 })
    );
  }

  getStorageKeyForFolder(folder?: Maybe<string>): string {
    const storageKey = `${this.storageKey}_${folder ?? 'default'}`;
    return storageKey;
  }
}
