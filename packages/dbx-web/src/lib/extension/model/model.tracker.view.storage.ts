import { tapLog } from '@dereekb/rxjs';
import { Injectable } from '@angular/core';
import { unixTimeNumberForNow } from '@dereekb/date';
import { StorageAccessor } from '@dereekb/dbx-core';
import { encodeModelKeyTypePair, ModelRelationUtility, Maybe } from '@dereekb/util';
import { map, mergeMap, catchError, Observable, of, Subject, tap } from 'rxjs';
import { DbxModelViewTrackerEventSet, DbxModelViewTrackerEvent } from './model.tracker';

/**
 * Used for managing DbxModelViewTrackerEvent storage.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxModelViewTrackerStorage {
  static readonly OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY = 'dbxModelViewTrackerEvents';
  static readonly MAX_EVENTS = 60;

  private _newEvent = new Subject<DbxModelViewTrackerEvent>();

  readonly newEvent$ = this._newEvent.asObservable();

  constructor(readonly storageAccessor: StorageAccessor<DbxModelViewTrackerEventSet>) {}

  protected get storageKey(): string {
    return DbxModelViewTrackerStorage.OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY;
  }

  protected get maxEventsToKeep(): number {
    return DbxModelViewTrackerStorage.MAX_EVENTS;
  }

  addTrackerEvent(event: DbxModelViewTrackerEvent): Observable<void> {
    const storageKey = this.getStorageKeyForFolder(event.folder);
    return this._getEventSetForStorageKey(storageKey).pipe(
      mergeMap((set) => {
        const nextEvent: DbxModelViewTrackerEvent = {
          d: event.d ?? unixTimeNumberForNow(),
          c: event.c,
          m: event.m
        };

        const e = ModelRelationUtility.removeDuplicates(set.e, (x) => encodeModelKeyTypePair(x.m), [encodeModelKeyTypePair(nextEvent.m)]);
        e.push(nextEvent);
        e.sort((a, b) => (b.d ?? 0) - (a.d ?? 0));

        return this.storageAccessor
          .set(storageKey, {
            l: Math.max(set.l ?? 0, nextEvent.d as number),
            e: e.slice(0, this.maxEventsToKeep)
          })
          .pipe(tap(() => this._newEvent.next(nextEvent)));
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

  // MARK: Compat
  /**
   * @deprecated use addTrackerEvent() instead.
   */
  addEvent(event: DbxModelViewTrackerEvent): Observable<void> {
    return this.addTrackerEvent(event);
  }
}
