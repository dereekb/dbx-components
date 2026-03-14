import { Injectable, InjectionToken, inject } from '@angular/core';
import { unixDateTimeSecondsNumberForNow, encodeModelKeyTypePair, ModelRelationUtility, type Maybe } from '@dereekb/util';
import { completeOnDestroy, type StorageAccessor } from '@dereekb/dbx-core';
import { map, mergeMap, catchError, type Observable, of, Subject, tap } from 'rxjs';
import { type DbxModelViewTrackerEventSet, type DbxModelViewTrackerEvent } from './model.tracker';

/**
 * Injection token for a {@link StorageAccessor} used by {@link DbxModelViewTrackerStorage} to persist model view events.
 */
export const DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN = new InjectionToken('DbxModelViewTrackerStorageAccessor');

/**
 * Manages persistence of {@link DbxModelViewTrackerEvent} items in local storage. Handles deduplication, sorting by date, and folder-based partitioning of events.
 */
@Injectable()
export class DbxModelViewTrackerStorage {
  static readonly OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY = 'dbxModelViewTrackerEvents';
  static readonly DEFAULT_MAX_EVENTS = 100;

  readonly storageAccessor = inject<StorageAccessor<DbxModelViewTrackerEventSet>>(DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN);

  private readonly _newEvent = completeOnDestroy(new Subject<DbxModelViewTrackerEvent>());

  readonly newEvent$ = this._newEvent.asObservable();

  protected get storageKey(): string {
    return DbxModelViewTrackerStorage.OBJECT_VIEW_TRACKER_STORAGE_LIST_KEY;
  }

  protected get maxEventsToKeep(): number {
    return DbxModelViewTrackerStorage.DEFAULT_MAX_EVENTS;
  }

  /**
   * Persists a view tracker event to storage. Deduplicates by model key, sorts by date, and trims to the max event limit.
   *
   * @param event - The event to record
   * @returns Observable that completes when the event has been persisted
   */
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

  /**
   * Returns all stored view events for the given folder.
   *
   * @param folder - Optional folder name; defaults to `'default'`
   */
  getAllEvents(folder?: Maybe<string>): Observable<DbxModelViewTrackerEvent[]> {
    return this.getEventSet(folder).pipe(map((x) => x.e));
  }

  /**
   * Returns the complete event set for the given folder.
   *
   * @param folder - Optional folder name; defaults to `'default'`
   */
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

  /**
   * Computes the storage key for a given folder name.
   *
   * @param folder - Optional folder name; defaults to `'default'`
   */
  getStorageKeyForFolder(folder?: Maybe<string>): string {
    const storageKey = `${this.storageKey}_${folder ?? 'default'}`;
    return storageKey;
  }
}
