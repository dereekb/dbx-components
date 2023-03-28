import { FirestoreDocument, FirestoreModelIdentity } from '@dereekb/firebase';
import { SourceSelectLoadSource } from '@dereekb/dbx-form';
import { LoadingState, loadingStateFromObs, mapEachAsync } from '@dereekb/rxjs';
import { Observable } from 'rxjs';
import { GrantedRole } from '@dereekb/model';
import { MapFunction } from '@dereekb/util';
import { DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';
import { DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService } from './model.tracker.service';

export interface DbxFirebaseSourceSelectLoadSourceConfig<M, D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole> extends Pick<DbxFirebaseModelTrackerHistoryFilter, 'filterItem'> {
  /**
   * Source label. Defaults to "History".
   */
  label?: string;
  /**
   * Type of model to pull from the history.
   */
  identity: FirestoreModelIdentity;
  /**
   * Maps a result instance to the target meta type
   */
  mapToMeta: MapFunction<DbxFirebaseModelTypesServiceInstancePair<D, R>, Observable<M>>;
  /**
   * Tracker service to load history values from.
   */
  dbxFirebaseModelTrackerService: DbxFirebaseModelTrackerService;
}

/**
 * Configures a SourceSelectLoadSource using the DbxFirebaseModelTrackerService to load models of a specific identity.
 *
 * @param config
 * @returns
 */
export function dbxFirebaseSourceSelectLoadSource<M>(config: DbxFirebaseSourceSelectLoadSourceConfig<M>): SourceSelectLoadSource<M> {
  const { label = 'History', identity, mapToMeta, filterItem, dbxFirebaseModelTrackerService } = config;
  const historyValuesObs = dbxFirebaseModelTrackerService.filterHistoryPairs({ identity, filterItem });
  const metaObs = historyValuesObs.pipe(mapEachAsync(mapToMeta));
  const meta: Observable<LoadingState<M[]>> = loadingStateFromObs(metaObs);

  return {
    label,
    meta
  };
}
