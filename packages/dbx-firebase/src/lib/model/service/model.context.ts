import { FirestoreDocument, FirebasePermissionErrorContext, InModelContextFirebaseModelService, FirestoreDocumentData } from '@dereekb/firebase';
import { GrantedRole, GrantedRoleMap, GrantedRoleMapReader, GrantedRoleTruthMap, GrantedRoleTruthMapObject } from '@dereekb/model';
import { SetIncludesMode, IterableOrValue } from '@dereekb/util';
import { map, Observable, switchMap, shareReplay, distinctUntilChanged } from 'rxjs';

export interface DbxFirebaseInContextFirebaseModelRolesService<R extends GrantedRole = GrantedRole> {
  readonly roleReader$: Observable<GrantedRoleMapReader<R>>;
  readonly roleMap$: Observable<GrantedRoleMap<R>>;
  readonly hasNoAccess$: Observable<boolean>;
  truthMap<M extends GrantedRoleTruthMapObject<any, R>>(input: M): Observable<GrantedRoleTruthMap<M>>;
  hasAnyRoles(roles: IterableOrValue<R>): Observable<boolean>;
  hasAllRoles(roles: IterableOrValue<R>): Observable<boolean>;
  hasRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): Observable<boolean>;
  containsAnyRoles(roles: IterableOrValue<R>): Observable<boolean>;
  containsAllRoles(roles: IterableOrValue<R>): Observable<boolean>;
  containsRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): Observable<boolean>;
}

/**
 * Wraps an InModelContextFirebaseModelService observable and provides different piped observables.
 */
export class DbxFirebaseInContextFirebaseModelServiceInstance<D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext> implements DbxFirebaseInContextFirebaseModelRolesService<R> {
  constructor(readonly modelService$: Observable<InModelContextFirebaseModelService<C, FirestoreDocumentData<D>, D, R>>) {}

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
