import { FirestoreDocument, FirebasePermissionErrorContext, InModelContextFirebaseModelService, FirestoreDocumentData } from '@dereekb/firebase';
import { GrantedRole } from '@dereekb/model';
import { SetIncludesMode, IterableOrValue } from '@dereekb/util';
import { map, Observable, switchMap, shareReplay, distinctUntilChanged } from 'rxjs';

/**
 * Wraps an InModelContextFirebaseModelService observable and provides different piped observables.
 */
export class DbxFirebaseInContextFirebaseModelServiceInstance<D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole, C extends FirebasePermissionErrorContext = FirebasePermissionErrorContext> {
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
