import { FirestoreDocument } from '../../firestore/accessor/document';
import { GrantedRole, GrantedRoleMap, grantedRoleMapReader, GrantedRoleMapReader } from '@dereekb/model';
import { InModelContextFirebaseModelPermissionService } from './permission.service';
import { SetIncludesMode, ArrayOrValue } from '@dereekb/util';
import { FirebasePermissionErrorContext } from './permission.context';
import { FirebaseContextGrantedModelRoles } from './permission';

export interface ContextGrantedModelRolesReader<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> extends GrantedRoleMapReader<R> {
  readonly roleMap: GrantedRoleMap<R>;
  readonly contextGrantedModelRoles: FirebaseContextGrantedModelRoles<C, T, D, R>;
  assertHasRole(role: R): void;
  throwPermissionError(role?: R): never;
}

export class ContextGrantedModelRolesReaderInstance<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> implements ContextGrantedModelRolesReader<C, T, D, R> {
  private _roleReader: GrantedRoleMapReader<R>;

  constructor(readonly contextGrantedModelRoles: FirebaseContextGrantedModelRoles<C, T, D, R>) {
    this._roleReader = grantedRoleMapReader(contextGrantedModelRoles.roleMap);
  }

  get roleMap() {
    return this.contextGrantedModelRoles.roleMap;
  }

  hasNoAccess(): boolean {
    return this._roleReader.hasNoAccess();
  }

  hasRole(role: R): boolean {
    return this._roleReader.hasRole(role);
  }

  hasRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<R>): boolean {
    return this._roleReader.hasRoles(setIncludes, roles);
  }

  containsRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<R>): boolean {
    return this._roleReader.containsRoles(setIncludes, roles);
  }

  assertHasRole(role: R): void {
    if (!this.hasRole(role)) {
      this.throwPermissionError(role);
    }
  }

  throwPermissionError(role?: R): never {
    const error = this.contextGrantedModelRoles.context.makePermissionError?.(this.contextGrantedModelRoles, role) ?? new Error(contextGrantedModelRolesReaderPermissionErrorMessage(this.contextGrantedModelRoles, role));
    throw error;
  }
}

/**
 * Creates a new ContextGrantedModelRolesReader for the input model.
 */
export function contextGrantedModelRolesReader<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(service: InModelContextFirebaseModelPermissionService<C, T, D, R>): Promise<ContextGrantedModelRolesReader<C, T, D, R>> {
  return service.roleMap().then((x) => new ContextGrantedModelRolesReaderInstance(x));
}

/**
 * Creates the default permission error message.
 *
 * @param contextGrantedModelRoles
 * @param role
 * @returns
 */
export function contextGrantedModelRolesReaderPermissionErrorMessage(contextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, role?: string) {
  let message = `Permissions Error ("${contextGrantedModelRoles.data?.document.modelType}":"${contextGrantedModelRoles.data?.document.id}")`;

  if (role) {
    message = `${message}: required role "${role}"`;
  }

  return message;
}
