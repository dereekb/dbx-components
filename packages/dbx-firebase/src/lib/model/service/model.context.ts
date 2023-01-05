import { FirestoreDocument, FirestoreDocumentData, DocumentSnapshot, FirestoreAccessorStreamMode, SnapshotOptions, FirestoreModelKey, FirestoreModelType } from '@dereekb/firebase';
import { GrantedRole, GrantedRoleMap, GrantedRoleMapReader, GrantedRoleTruthMap, GrantedRoleTruthMapObject } from '@dereekb/model';
import { SetIncludesMode, IterableOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';

/**
 * Service instance that exposes roles for a specific model.
 */
export interface DbxFirebaseInContextFirebaseModelRolesServiceInstance<R extends GrantedRole = GrantedRole> {
  readonly key$: Observable<FirestoreModelKey>;
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
 * DbxFirebaseInContextFirebaseModelRolesServiceInstance extension that provides access to the underlying model.
 */
export interface DbxFirebaseInContextFirebaseModelInfoServiceInstance<D extends FirestoreDocument<any>, R extends GrantedRole = GrantedRole> extends DbxFirebaseInContextFirebaseModelRolesServiceInstance<R> {
  readonly modelType$: Observable<FirestoreModelType>;
  readonly model$: Observable<D>;
  /**
   * Reads the data from the model once and returns the current state without streaming.
   */
  readonly snapshotData$: Observable<FirestoreDocumentData<D>>;
  snapshotStream(mode: FirestoreAccessorStreamMode): Observable<DocumentSnapshot<FirestoreDocumentData<D>>>;
  snapshotDataStream(mode: FirestoreAccessorStreamMode, options?: SnapshotOptions): Observable<FirestoreDocumentData<D>>;
}
