import { FirestoreDocument, FirebasePermissionErrorContext, InModelContextFirebaseModelService, FirestoreDocumentData, DocumentSnapshot, FirestoreAccessorStreamMode, SnapshotOptions, InContextFirebaseModelsService, FirebaseModelsService } from '@dereekb/firebase';
import { GrantedRole, GrantedRoleTruthMap, GrantedRoleTruthMapObject } from '@dereekb/model';
import { asObservable, ObservableOrValue } from '@dereekb/rxjs';
import { SetIncludesMode, IterableOrValue, ModelKey } from '@dereekb/util';
import { map, Observable, switchMap, shareReplay, distinctUntilChanged } from 'rxjs';
import { DbxFirebaseInContextFirebaseModelInfoServiceInstance } from './model.context';

export type DbxFirebaseInContextFirebaseModelServiceInstanceFactory<S extends InContextFirebaseModelsService<any>, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext> = <D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole>(type: S extends InContextFirebaseModelsService<infer Y> ? (Y extends FirebaseModelsService<infer X, infer C> ? keyof X : never) : never, keyObs: ObservableOrValue<ModelKey>) => DbxFirebaseInContextFirebaseModelServiceInstance<D, R, C>;

export function dbxFirebaseInContextFirebaseModelServiceInstanceFactory<S extends InContextFirebaseModelsService<any>, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext>(context$: Observable<S>): DbxFirebaseInContextFirebaseModelServiceInstanceFactory<S, C> {
  return <D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole>(type: S extends InContextFirebaseModelsService<infer Y> ? (Y extends FirebaseModelsService<infer X, infer C> ? keyof X : never) : never, keyObs: ObservableOrValue<ModelKey>) => {
    const key$ = asObservable(keyObs);
    const modelServiceObs = context$.pipe(
      map((x) => x(type)),
      switchMap((service) => key$.pipe(map((key) => service(key))))
    ) as unknown as Observable<InModelContextFirebaseModelService<C, FirestoreDocumentData<D>, D, R>>;

    return dbxFirebaseInContextFirebaseModelServiceInstance<D, R, C>(modelServiceObs);
  };
}

export interface DbxFirebaseInContextFirebaseModelServiceInstance<D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext> extends DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R> {
  readonly modelService$: Observable<InModelContextFirebaseModelService<C, FirestoreDocumentData<D>, D, R>>;
}

/**
 * Creates a new DbxFirebaseInContextFirebaseModelServiceInstance.
 *
 * Wraps an InModelContextFirebaseModelService observable and provides different piped observables.
 */
export function dbxFirebaseInContextFirebaseModelServiceInstance<D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext>(modelService$: Observable<InModelContextFirebaseModelService<C, FirestoreDocumentData<D>, D, R>>) {
  const key$ = modelService$.pipe(map((x) => x.model.key));

  // MARK: Model
  const modelType$ = modelService$.pipe(
    map((x) => x.model.modelType),
    distinctUntilChanged()
  );

  const model$ = modelService$.pipe(
    map((x) => x.model),
    distinctUntilChanged((a, b) => a.key === b.key),
    shareReplay(1)
  );

  const snapshotData$ = model$.pipe(
    switchMap((x) => x.snapshotData()),
    shareReplay(1)
  );

  function snapshotStream(mode: FirestoreAccessorStreamMode): Observable<DocumentSnapshot<FirestoreDocumentData<D>>> {
    return model$.pipe(
      switchMap((x) => x.snapshotStream(mode)),
      shareReplay(1)
    );
  }

  function snapshotDataStream(mode: FirestoreAccessorStreamMode, options?: SnapshotOptions): Observable<FirestoreDocumentData<D>> {
    return model$.pipe(
      switchMap((x) => x.snapshotDataStream(mode)),
      shareReplay(1)
    );
  }

  // MARK: Roles
  const roleReader$ = modelService$.pipe(
    switchMap((x) => x.roleReader()),
    shareReplay(1)
  );

  const roleMap$ = roleReader$.pipe(
    map((x) => x.roleMap),
    shareReplay(1)
  );

  const hasNoAccess$ = roleReader$.pipe(
    map((x) => x.hasNoAccess()),
    shareReplay(1)
  );

  function truthMap<M extends GrantedRoleTruthMapObject<any, R>>(input: M): Observable<GrantedRoleTruthMap<M>> {
    return roleReader$.pipe(
      map((x) => x.truthMap(input)),
      shareReplay(1)
    );
  }

  function hasAnyRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return hasRoles('any', roles);
  }

  function hasAllRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return hasRoles('all', roles);
  }

  function hasRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): Observable<boolean> {
    return roleReader$.pipe(
      map((x) => x.hasRoles(setIncludes, roles)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  function containsAnyRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return containsRoles('any', roles);
  }

  function containsAllRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return containsRoles('all', roles);
  }

  function containsRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): Observable<boolean> {
    return roleReader$.pipe(
      map((x) => x.containsRoles(setIncludes, roles)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  const result: DbxFirebaseInContextFirebaseModelServiceInstance<D, R, C> = {
    modelService$,
    key$,
    modelType$,
    model$,
    snapshotData$,
    snapshotStream,
    snapshotDataStream,
    roleReader$,
    roleMap$,
    hasNoAccess$,
    truthMap,
    hasAnyRoles,
    hasAllRoles,
    hasRoles,
    containsAnyRoles,
    containsAllRoles,
    containsRoles
  };

  return result;
}
