import { type FirestoreDocument, type FirestoreModelIdentity } from '@dereekb/firebase';
import { type SourceSelectLoadSource } from '@dereekb/dbx-form';
import { type LoadingState, loadingStateFromObs, mapEachAsync } from '@dereekb/rxjs';
import { type Observable } from 'rxjs';
import { type GrantedRole } from '@dereekb/model';
import { type MapFunction } from '@dereekb/util';
import { type DbxFirebaseModelTypesServiceInstancePair } from '../model.types.service';
import { type DbxFirebaseModelTrackerHistoryFilter, type DbxFirebaseModelTrackerService } from './model.tracker.service';

export interface DbxFirebaseSourceSelectLoadSourceConfig<M, D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole> extends Pick<DbxFirebaseModelTrackerHistoryFilter, 'filterItem'> {
  /**
   * Source label. Defaults to "History".
   */
  readonly label?: string;
  /**
   * Type of model to pull from the history.
   */
  readonly identity: FirestoreModelIdentity;
  /**
   * Maps a result instance to the target meta type
   */
  readonly mapToMeta: MapFunction<DbxFirebaseModelTypesServiceInstancePair<D, R>, Observable<M>>;
  /**
   * Tracker service to load history values from.
   */
  readonly dbxFirebaseModelTrackerService: DbxFirebaseModelTrackerService;
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
