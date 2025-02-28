import { ArrayOrValue, DecisionFunction, Maybe, asArray, invertDecision } from '@dereekb/util';
import { FirestoreModelIdentity } from '@dereekb/firebase';
import { map, Observable, switchMap, shareReplay, startWith, of, catchError } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { allDbxModelViewTrackerEventModelKeys, DbxModelTrackerService } from '@dereekb/dbx-web';
import { DbxFirebaseModelTypesService, DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';
import { filterItemsWithObservableDecision, filterMaybeArray, invertObservableDecision, mapEachAsync, ObservableDecisionFunction } from '@dereekb/rxjs';

export interface DbxFirebaseModelTrackerFilterItem {
  instancePair: DbxFirebaseModelTypesServiceInstancePair;
  identity: FirestoreModelIdentity;
}

export interface DbxFirebaseModelTrackerHistoryFilter {
  /**
   * Whether or not to exclude the values instead of include them.
   */
  invertFilter?: boolean;
  /**
   * Identity types to filter on.
   */
  identity?: Maybe<ArrayOrValue<FirestoreModelIdentity>>;
  /**
   * Arbitrary filter function to filter individual items.
   */
  filterItem?: ObservableDecisionFunction<DbxFirebaseModelTrackerFilterItem>;
}

@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseModelTrackerService {
  readonly dbxModelTrackerService = inject(DbxModelTrackerService);
  readonly dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService);

  readonly historyKeys$ = this.dbxModelTrackerService.newEvent$.pipe(
    startWith(null),
    switchMap(() => this.loadHistoryKeys()),
    shareReplay(1)
  );

  readonly historyPairs$ = this.dbxModelTrackerService.newEvent$.pipe(
    startWith(null),
    switchMap(() => this.loadHistoryPairs()), // TODO: Improve efficiency of this to only load/remove items for new keys
    shareReplay(1)
  );

  readonly filterItemHistoryPairs$: Observable<DbxFirebaseModelTrackerFilterItem[]> = this.historyPairs$.pipe(
    mapEachAsync(
      (instancePair) =>
        instancePair.instance.identity$.pipe(
          map((identity) => ({ instancePair, identity })),
          catchError(() => of(undefined))
        ),
      { onlyFirst: true }
    ),
    filterMaybeArray<DbxFirebaseModelTrackerFilterItem>(),
    shareReplay(1)
  );

  /**
   * Filters from historyPairs$ using the input filter configuration, if it is provided.
   *
   * @param filter
   * @returns
   */
  filterHistoryPairs(filter?: Maybe<DbxFirebaseModelTrackerHistoryFilter>): Observable<DbxFirebaseModelTypesServiceInstancePair[]> {
    if (filter && (filter?.identity || filter?.filterItem)) {
      const { invertFilter = false, identity, filterItem } = filter;
      const allowedIdentities = new Set(asArray(identity));
      const baseIsAllowedIdentityFn: DecisionFunction<FirestoreModelIdentity> = identity ? (x) => allowedIdentities.has(x) : () => true;
      const isAllowedIdentityFn = invertDecision(baseIsAllowedIdentityFn, invertFilter);

      const baseFilterItemFn: ObservableDecisionFunction<DbxFirebaseModelTrackerFilterItem> = filterItem ? invertObservableDecision(filterItem, invertFilter) : () => of(true);

      const filterItemFn: ObservableDecisionFunction<DbxFirebaseModelTrackerFilterItem> = (x) => {
        if (isAllowedIdentityFn(x.identity)) {
          return baseFilterItemFn(x);
        } else {
          return of(false);
        }
      };

      return this.filterItemHistoryPairs$.pipe(
        filterItemsWithObservableDecision(filterItemFn),
        map((x) => x.map((y) => y.instancePair)),
        shareReplay(1)
      );
    } else {
      return this.historyPairs$;
    }
  }

  loadHistoryKeys() {
    return this.dbxModelTrackerService.getAllViewEvents().pipe(map(allDbxModelViewTrackerEventModelKeys));
  }

  loadHistoryPairs(): Observable<DbxFirebaseModelTypesServiceInstancePair[]> {
    const historyKeys$ = this.loadHistoryKeys();
    return historyKeys$.pipe(switchMap((x) => this.dbxFirebaseModelTypesService.instancePairsForKeys(x)));
  }
}
