import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { DbxFirebaseDocumentStore } from './store';
import { FirestoreModelIdentity } from '@dereekb/firebase';
import { Configurable, IndexRef, Maybe, separateValues, sortByIndexRangeAscendingCompareFunction, sortByNumberFunction } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, first, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { isSameDate } from '@dereekb/date';
import { distinctUntilKeysChange, distinctUntilMapHasDifferentKeys } from '@dereekb/rxjs';

/**
 * A unique number for a store entry.
 */
export type DbxFirebaseDocumentStoreContextStoreEntryNumber = number;

/**
 * A specifiy entry in the store.
 *
 * Used for caching information about a specific store.
 */
export interface DbxFirebaseDocumentStoreContextStoreEntry {
  /**
   * The number the entry was assigned when added to the store.
   */
  readonly entryNumber: DbxFirebaseDocumentStoreContextStoreEntryNumber;

  /**
   * The referenced document store.
   */
  readonly store: DbxFirebaseDocumentStore<unknown>;

  // Cached Values
  readonly modelIdentity?: Maybe<FirestoreModelIdentity>;
}

export interface DbxFirebaseDocumentStoreContextStoreState {
  /**
   * The next entry number to use for a new store.
   */
  readonly nextEntryNumber: DbxFirebaseDocumentStoreContextStoreEntryNumber;
  /**
   * The map of all current stores.
   *
   * The map uses the store as the key for it's corresponding entry that contains additional information about the store.
   */
  readonly stores: Map<DbxFirebaseDocumentStore<unknown>, DbxFirebaseDocumentStoreContextStoreEntry>;
  /**
   * The last time the stores map was changed.
   */
  readonly lastStoresChangeAt: Date;
}

@Injectable()
export class DbxFirebaseDocumentStoreContextStore extends ComponentStore<DbxFirebaseDocumentStoreContextStoreState> {
  constructor() {
    super({
      nextEntryNumber: 0,
      stores: new Map(),
      lastStoresChangeAt: new Date()
    });
  }

  // MARK: Accessors
  readonly stores$ = this.select((state) => state.stores).pipe(distinctUntilMapHasDifferentKeys(), shareReplay(1));
  readonly lastStoresChangeAt$ = this.select((state) => state.lastStoresChangeAt).pipe(distinctUntilChanged(isSameDate), shareReplay(1));

  readonly entriesGroupedByIdentity$ = this.select((state) => state.stores).pipe(
    switchMap((stores) => {
      let entriesObs: Observable<DbxFirebaseDocumentStoreContextStoreEntry[]>;

      const allEntries = Array.from(stores.values());

      const { included: hasIdentity, excluded: noIdentity } = separateValues(allEntries, (x) => x.modelIdentity != null);

      if (noIdentity.length > 0) {
        entriesObs = combineLatest(
          noIdentity.map((entryWithoutCachedIdentity) =>
            entryWithoutCachedIdentity.store.modelIdentity$.pipe(
              first(),
              map((z) => {
                // set the model identity on the entry
                (entryWithoutCachedIdentity as Configurable<DbxFirebaseDocumentStoreContextStoreEntry>).modelIdentity = z;
                // return the entry
                return entryWithoutCachedIdentity;
              })
            )
          )
        ).pipe(
          map(() => {
            return allEntries; // all the entries should have an identity now
          })
        );
      } else {
        entriesObs = of(hasIdentity);
      }

      return entriesObs;
    }),
    map((x) => {
      // sort in ascending order by entry number
      x.sort(sortByNumberFunction((x) => x.entryNumber));

      return x;
    }),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly addStore = this.updater(addStore);
  readonly removeStore = this.updater(removeStore);
}

function addStore(state: DbxFirebaseDocumentStoreContextStoreState, store: DbxFirebaseDocumentStore<unknown>) {
  const { stores, nextEntryNumber } = state;

  let nextState: DbxFirebaseDocumentStoreContextStoreState;

  if (stores.has(store)) {
    nextState = state;
  } else {
    // add the entry
    const entry: Configurable<DbxFirebaseDocumentStoreContextStoreEntry> = {
      store,
      entryNumber: nextEntryNumber
    };

    stores.set(store, entry);

    // update the last changed date
    nextState = { ...state, lastStoresChangeAt: new Date(), nextEntryNumber: nextEntryNumber + 1 };
  }

  return nextState;
}

function removeStore(state: DbxFirebaseDocumentStoreContextStoreState, store: DbxFirebaseDocumentStore<unknown>) {
  const { stores } = state;

  let nextState: DbxFirebaseDocumentStoreContextStoreState;

  if (!stores.has(store)) {
    nextState = state;
  } else {
    // remove the entry
    stores.delete(store);

    // update the last changed date
    nextState = { ...state, lastStoresChangeAt: new Date() };
  }

  return nextState;
}
