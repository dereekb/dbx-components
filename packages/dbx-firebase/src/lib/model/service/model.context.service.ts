import { FirestoreModelType, asFirestoreModelKeyCollectionType, buildFirebaseCollectionTypeModelTypeMap, FirebasePermissionErrorContext, FirestoreCollectionType, FirestoreDocument, FirestoreModelIdentityTypeMap, FirestoreModelKey, InContextFirebaseModelsService } from '@dereekb/firebase';
import { asObservable, ObservableOrValue } from '@dereekb/rxjs';
import { GrantedRole } from '@dereekb/model';
import { shareReplay, map, Observable, OperatorFunction, first, switchMap } from 'rxjs';
import { DbxFirebaseInContextFirebaseModelInfoServiceInstance } from './model.context';
import { DbxFirebaseInContextFirebaseModelServiceInstanceFactory } from './model.context.instance';

/**
 * Used for retrieving contexts for a specific model type/identity.
 */
export abstract class DbxFirebaseModelContextService {
  /**
   * Creates a new DbxFirebaseInContextFirebaseModelInfoServiceInstance for the input model key.
   *
   * @param key$
   */
  abstract modelInfoInstance<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole>(keyObs: ObservableOrValue<FirestoreModelKey>): Observable<DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>>;
}

export type DbxFirebaseModelContextServiceInfoInstanceFactory = <D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole>(keyObs: ObservableOrValue<FirestoreModelKey>) => Observable<DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>>;

export interface DbxFirebaseModelContextServiceInfoInstanceFactoryConfig<S extends InContextFirebaseModelsService<any>, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext> {
  readonly modelService: DbxFirebaseInContextFirebaseModelServiceInstanceFactory<S, C>;
  readonly entityMap$: Observable<FirestoreModelIdentityTypeMap>;
}

export function dbxFirebaseModelContextServiceInfoInstanceFactory<S extends InContextFirebaseModelsService<any>, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext>(config: DbxFirebaseModelContextServiceInfoInstanceFactoryConfig<S, C>): DbxFirebaseModelContextServiceInfoInstanceFactory {
  const { modelService, entityMap$ } = config;
  return <D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole>(keyObs: ObservableOrValue<string>) => {
    const key$ = asObservable(keyObs);

    return key$.pipe(
      asFirestoreModelKeyCollectionType(),
      switchMap((pair) => {
        return entityMap$.pipe(
          map((entityMap) => {
            const modelType = entityMap.get(pair.collectionType) as FirestoreModelType;

            if (!modelType) {
              const message = `dbxFirebaseModelContextServiceInfoInstanceFactory Error: Failed to retrieve model type for collection type "${pair.collectionType}"`;
              console.error(message);
              throw new Error(message);
            }

            return modelService(modelType as any, pair.key) as DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>;
          })
        );
      })
    );
  };
}

/**
 * Operator function that builds a FirestoreModelIdentityTypeMap from the input context and shares the replay.
 *
 * Since the output won't change with different contexts, the map is built once and then shared.
 *
 * @returns
 */
export function firebaseContextServiceEntityMap<T extends InContextFirebaseModelsService<any>>(): OperatorFunction<T, FirestoreModelIdentityTypeMap> {
  return (obs: Observable<T>) => {
    return obs.pipe(
      map((x) => buildFirebaseCollectionTypeModelTypeMap(x)),
      first(),
      shareReplay(1)
    );
  };
}
