import { Injectable, InjectionToken, OnDestroy, inject } from '@angular/core';
import { unixDateTimeSecondsNumberForNow, encodeModelKeyTypePair, ModelRelationUtility, type Maybe } from '@dereekb/util';
import { StorageAccessor } from '@dereekb/dbx-core';
import { map, mergeMap, catchError, Observable, of, Subject, tap } from 'rxjs';
import { DbxModelViewTrackerEventSet, DbxModelViewTrackerEvent } from './model.tracker';

/**
 * Token that corresponds to a StorageAccessor<DbxModelViewTrackerEventSet> that is used by DbxModelViewTrackerStorage.
 */
export const DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN = new InjectionToken('DbxModelViewTrackerStorageAccessor');

/**
 * Used for managing DbxModelViewTrackerEvent storage.
 */
@Injectable()
export class DbxModelViewTrackerStorage implements OnDestroy {
  static readonly OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY = 'dbxModelViewTrackerEvents';
  static readonly DEFAULT_MAX_EVENTS = 100;

  readonly storageAccessor = inject<StorageAccessor<DbxModelViewTrackerEventSet>>(DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN);

  private readonly _newEvent = new Subject<DbxModelViewTrackerEvent>();

  readonly newEvent$ = this._newEvent.asObservable();

  ngOnDestroy(): void {
    this._newEvent.complete();
  }

  protected get storageKey(): string {
    return DbxModelViewTrackerStorage.OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY;
  }

  protected get maxEventsToKeep(): number {
    return DbxModelViewTrackerStorage.DEFAULT_MAX_EVENTS;
  }

  addTrackerEvent(event: DbxModelViewTrackerEvent): Observable<void> {
    const storageKey = this.getStorageKeyForFolder(event.folder);
    return this._getEventSetForStorageKey(storageKey).pipe(
      mergeMap((set) => {
        const nextEvent: DbxModelViewTrackerEvent = {
          d: event.d ?? unixDateTimeSecondsNumberForNow(),
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
}
