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

    return new DbxFirebaseInContextFirebaseModelServiceInstance<D, R, C>(modelServiceObs);
  };
}

/**
 * Wraps an InModelContextFirebaseModelService observable and provides different piped observables.
 */
export class DbxFirebaseInContextFirebaseModelServiceInstance<D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext> implements DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R> {
  constructor(readonly modelService$: Observable<InModelContextFirebaseModelService<C, FirestoreDocumentData<D>, D, R>>) {}

  readonly key$ = this.modelService$.pipe(map((x) => x.model.key));

  // MARK: Model
  readonly modelType$ = this.modelService$.pipe(
    map((x) => x.model.modelType),
    distinctUntilChanged()
  );

  readonly model$ = this.modelService$.pipe(
    map((x) => x.model),
    distinctUntilChanged((a, b) => a.key === b.key),
    shareReplay(1)
  );

  readonly snapshotData$ = this.model$.pipe(
    switchMap((x) => x.snapshotData()),
    shareReplay(1)
  );

  snapshotStream(mode: FirestoreAccessorStreamMode): Observable<DocumentSnapshot<FirestoreDocumentData<D>>> {
    return this.model$.pipe(
      switchMap((x) => x.snapshotStream(mode)),
      shareReplay(1)
    );
  }

  snapshotDataStream(mode: FirestoreAccessorStreamMode, options?: SnapshotOptions): Observable<FirestoreDocumentData<D>> {
    return this.model$.pipe(
      switchMap((x) => x.snapshotDataStream(mode)),
      shareReplay(1)
    );
  }

  // MARK: Roles
  readonly roleReader$ = this.modelService$.pipe(
    switchMap((x) => x.roleReader()),
    shareReplay(1)
  );

  readonly roleMap$ = this.roleReader$.pipe(
    map((x) => x.roleMap),
    shareReplay(1)
  );

  readonly hasNoAccess$ = this.roleReader$.pipe(
    map((x) => x.hasNoAccess()),
    shareReplay(1)
  );

  truthMap<M extends GrantedRoleTruthMapObject<any, R>>(input: M): Observable<GrantedRoleTruthMap<M>> {
    return this.roleReader$.pipe(
      map((x) => x.truthMap(input)),
      shareReplay(1)
    );
  }

  hasAnyRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return this.hasRoles('any', roles);
  }

  hasAllRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return this.hasRoles('all', roles);
  }

  hasRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): Observable<boolean> {
    return this.roleReader$.pipe(
      map((x) => x.hasRoles(setIncludes, roles)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  containsAnyRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return this.containsRoles('any', roles);
  }

  containsAllRoles(roles: IterableOrValue<R>): Observable<boolean> {
    return this.containsRoles('all', roles);
  }

  containsRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): Observable<boolean> {
    return this.roleReader$.pipe(
      map((x) => x.containsRoles(setIncludes, roles)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }
}
