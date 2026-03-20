import { type FirestoreDocument } from '../../firestore/accessor/document';
import { type GrantedRole, type GrantedRoleMap, grantedRoleMapReader, type GrantedRoleMapReader, type GrantedRoleTruthMap, type GrantedRoleTruthMapObject } from '@dereekb/model';
import { type InModelContextFirebaseModelPermissionService } from './permission.service';
import { type SetIncludesMode, type ArrayOrValue } from '@dereekb/util';
import { type FirebasePermissionErrorContext } from './permission.context';
import { type FirebaseContextGrantedModelRoles, type FirebasePermissionServiceModel } from './permission';

/**
 * Reads and asserts granted roles for a specific model in a given context.
 *
 * Combines the computed {@link GrantedRoleMap} with the model's data and provides methods to
 * check and assert roles. Used as the primary interface for permission-guarded operations.
 *
 * Chainable assertion methods (`assertExists`, `assertHasRole`, `assertHasRoles`) return `this`
 * for fluent usage.
 */
export interface ContextGrantedModelRolesReader<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> extends GrantedRoleMapReader<R>, FirebasePermissionServiceModel<T, D> {
  readonly roleMap: GrantedRoleMap<R>;
  readonly contextGrantedModelRoles: FirebaseContextGrantedModelRoles<C, T, D, R>;
  assertExists(): this;
  assertHasRole(role: R): this;
  assertHasRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<R>): this;
  assertContainsRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<R>): this;
  throwPermissionError(role?: R): never;
}

/**
 * Default implementation of {@link ContextGrantedModelRolesReader}.
 *
 * Wraps a {@link FirebaseContextGrantedModelRoles} result and delegates role reading
 * to a {@link GrantedRoleMapReader}. Throws context-specific errors via the permission error context.
 */
export class ContextGrantedModelRolesReaderInstance<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> implements ContextGrantedModelRolesReader<C, T, D, R> {
  private readonly _contextGrantedModelRoles: FirebaseContextGrantedModelRoles<C, T, D, R>;
  private readonly _roleReader: GrantedRoleMapReader<R>;

  constructor(contextGrantedModelRoles: FirebaseContextGrantedModelRoles<C, T, D, R>) {
    this._contextGrantedModelRoles = contextGrantedModelRoles;
    this._roleReader = grantedRoleMapReader(contextGrantedModelRoles.roleMap);
  }

  get contextGrantedModelRoles(): FirebaseContextGrantedModelRoles<C, T, D, R> {
    return this._contextGrantedModelRoles;
  }

  get permissionServiceModel(): FirebasePermissionServiceModel<T, D> {
    return this.contextGrantedModelRoles.data as FirebasePermissionServiceModel<T, D>;
  }

  get data() {
    return this.permissionServiceModel.data;
  }

  get document() {
    return this.permissionServiceModel.document;
  }

  get snapshot() {
    return this.permissionServiceModel.snapshot;
  }

  get exists() {
    return this.permissionServiceModel.exists;
  }

  get roleMap() {
    return this.contextGrantedModelRoles.roleMap;
  }

  truthMap<M extends GrantedRoleTruthMapObject<unknown, R>>(input: M): GrantedRoleTruthMap<M> {
    return this._roleReader.truthMap(input);
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

  assertExists(): this {
    if (!this.exists) {
      this.throwDoesNotExistError();
    }

    return this;
  }

  assertHasRole(role: R): this {
    if (!this.hasRole(role)) {
      this.throwPermissionError(role);
    }

    return this;
  }

  assertHasRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<R>): this {
    if (!this.hasRoles(setIncludes, roles)) {
      this.throwPermissionError(roles);
    }

    return this;
  }

  assertContainsRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<R>): this {
    if (!this.containsRoles(setIncludes, roles)) {
      this.throwPermissionError(roles);
    }

    return this;
  }

  throwDoesNotExistError(): never {
    throw this.contextGrantedModelRoles.context.makeDoesNotExistError?.(this.contextGrantedModelRoles) ?? new Error(contextGrantedModelRolesReaderDoesNotExistErrorMessage(this.contextGrantedModelRoles));
  }

  throwPermissionError(role?: ArrayOrValue<R>): never {
    throw this.contextGrantedModelRoles.context.makePermissionError?.(this.contextGrantedModelRoles, role) ?? new Error(contextGrantedModelRolesReaderPermissionErrorMessage(this.contextGrantedModelRoles, role));
  }
}

/**
 * Creates a new ContextGrantedModelRolesReader for the input model.
 *
 * @param service - the in-model-context permission service to read roles from
 * @returns a promise resolving to a {@link ContextGrantedModelRolesReader} for the model
 */
export function contextGrantedModelRolesReader<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(service: InModelContextFirebaseModelPermissionService<C, T, D, R>): Promise<ContextGrantedModelRolesReader<C, T, D, R>> {
  return service.roleMap().then((x) => new ContextGrantedModelRolesReaderInstance(x));
}

/**
 * Creates the default permission error message.
 *
 * @param contextGrantedModelRoles - the granted model roles context to generate the message from
 * @param roles - the required role(s) that were not satisfied
 * @returns a human-readable permission error message string
 */
export function contextGrantedModelRolesReaderPermissionErrorMessage(contextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, roles?: ArrayOrValue<GrantedRole>) {
  let message = `Permissions Error ("${contextGrantedModelRoles.data?.document.modelType}":"${contextGrantedModelRoles.data?.document.id}")`;

  if (roles?.length) {
    message = `${message}: required role(s) "${roles}"`;
  }

  return message;
}

/**
 * Creates the default does not exist error message.
 *
 * @param contextGrantedModelRoles - the granted model roles context to generate the message from
 * @returns a human-readable does-not-exist error message string
 */
export function contextGrantedModelRolesReaderDoesNotExistErrorMessage(contextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>) {
  return `Does Not Exist ("${contextGrantedModelRoles.data?.document.modelType}":"${contextGrantedModelRoles.data?.document.id}")`;
}
