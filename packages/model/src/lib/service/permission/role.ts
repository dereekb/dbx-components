import { ArrayOrValue, arrayToObject, IterableOrValue, iterableToArray, Maybe, SetIncludesMode } from '@dereekb/util';

/**
 * A granted role for a model.
 */
export type GrantedRole = string;

/**
 * Communicates that the current context is a system admin.
 */
export type GrantedSysAdminRole = typeof GRANTED_SYS_ADMIN_ROLE_KEY;
export const GRANTED_SYS_ADMIN_ROLE_KEY = 'sysadmin';

/**
 * Communicates that the current context is an admin/owner.
 */
export type GrantedOwnerRole = typeof GRANTED_OWNER_ROLE_KEY;
export const GRANTED_OWNER_ROLE_KEY = 'owner';

/**
 * Communicates that the current context is an admin.
 */
export type GrantedAdminRole = typeof GRANTED_ADMIN_ROLE_KEY;
export const GRANTED_ADMIN_ROLE_KEY = 'admin';

/**
 * Returns true if the input role is a GrantedAdminRole or a GrantedOwnerRole.
 *
 * @param role
 * @returns
 */
export function isGrantedAdminLevelRole(role: GrantedRole): boolean {
  return role === GRANTED_ADMIN_ROLE_KEY || role === GRANTED_OWNER_ROLE_KEY;
}

/**
 * Communicates that the current context has read access to a model.
 */
export type GrantedReadRole = typeof GRANTED_READ_ROLE_KEY;
export const GRANTED_READ_ROLE_KEY = 'read';

/**
 * Communicates that the current context has update access to a model.
 */
export type GrantedUpdateRole = typeof GRANTED_UPDATE_ROLE_KEY;
export const GRANTED_UPDATE_ROLE_KEY = 'update';

/**
 * Communicates that the current context has delete access to a model.
 */
export type GrantedDeleteRole = typeof GRANTED_DELETE_ROLE_KEY;
export const GRANTED_DELETE_ROLE_KEY = 'delete';

export type GrantedCrudRoles = GrantedReadRole | GrantedUpdateRole | GrantedDeleteRole;

export const FULL_ACCESS_ROLE_KEY = '__FULL__';

/**
 * Communicates that the current context has full access to a model.
 */
export type GrantedFullAccessGrantedRole = typeof FULL_ACCESS_ROLE_KEY;

export const NO_ACCESS_ROLE_KEY = '__EMPTY__';
export type NoAccessGrantedRole = typeof NO_ACCESS_ROLE_KEY;

export type NoAccessRoleMap = {
  [NO_ACCESS_ROLE_KEY]: true;
};

export function noAccessRoleMap<R extends string = string>(): GrantedRoleMap<R> {
  return {
    [NO_ACCESS_ROLE_KEY]: true
  };
}

export function isNoAccessRoleMap<R extends string = string>(input: GrantedRoleMap<R> | NoAccessRoleMap): input is NoAccessRoleMap {
  return (input as NoAccessRoleMap)[NO_ACCESS_ROLE_KEY] === true;
}

export type FullAccessRoleMap = {
  [FULL_ACCESS_ROLE_KEY]: true;
};

export function fullAccessRoleMap<R extends string = string>(): GrantedRoleMap<R> {
  return {
    [FULL_ACCESS_ROLE_KEY]: true
  };
}

export function isFullAccessRoleMap<R extends string = string>(input: GrantedRoleMap<R> | FullAccessRoleMap): input is FullAccessRoleMap {
  return (input as FullAccessRoleMap)[FULL_ACCESS_ROLE_KEY] === true;
}

export type GrantedRoleMap<R extends GrantedRole = string> = NoAccessRoleMap | FullAccessRoleMap | GrantedRoleKeysMap<R>;

export type GrantedRoleKeysMap<R extends GrantedRole = string> = {
  [key in R]?: Maybe<boolean>;
};

/**
 * Reader used for parsing/reading role values from a given context.
 */
export interface GrantedRoleMapReader<R extends GrantedRole = GrantedRole> {
  /**
   * Returns true if no access has been given.
   */
  hasNoAccess(): boolean;

  /**
   * Returns true if the role is granted.
   */
  hasRole(role: R): boolean;

  /**
   * Returns true if the roles are granted.
   */
  hasRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): boolean;

  /**
   * Returns true if the map explicitly contains the role.
   */
  containsRoles(setIncludes: SetIncludesMode, roles: IterableOrValue<R>): boolean;
}

/**
 * Creates a GrantedRoleMapReader.
 *
 * @param map
 * @returns
 */
export function grantedRoleMapReader<R extends GrantedRole = string>(map: GrantedRoleMap<R>): GrantedRoleMapReader<R> {
  return new GrantedRoleMapReaderInstance(map);
}

export class GrantedRoleMapReaderInstance<R extends GrantedRole = string> implements GrantedRoleMapReader<R> {
  constructor(private readonly _map: GrantedRoleMap<R>) {}

  hasNoAccess(): boolean {
    return (this._map as NoAccessRoleMap)[NO_ACCESS_ROLE_KEY];
  }

  hasRole(role: R): boolean {
    return this.hasRoles('any', role);
  }

  hasRoles(setIncludes: SetIncludesMode, inputRoles: IterableOrValue<R>): boolean {
    if ((this._map as FullAccessRoleMap)[FULL_ACCESS_ROLE_KEY]) {
      return true;
    } else {
      return this.containsRoles(setIncludes, inputRoles);
    }
  }

  containsRoles(setIncludes: SetIncludesMode, inputRoles: IterableOrValue<R>): boolean {
    const roles = iterableToArray(inputRoles);

    if (setIncludes === 'any') {
      return this.containsAnyRole(roles);
    } else {
      return this.containsEachRole(roles);
    }
  }

  containsAnyRole(roles: ArrayOrValue<R>): boolean {
    for (const role of roles) {
      if ((this._map as GrantedRoleKeysMap)[role]) {
        return true;
      }
    }

    return false;
  }

  containsEachRole(roles: ArrayOrValue<R>): boolean {
    for (const role of roles) {
      if (!(this._map as GrantedRoleKeysMap)[role]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Converts the input array of roles to a GrantedRoleKeysMap.
 *
 * @param roles
 * @returns
 */
export function grantedRoleKeysMapFromArray<R extends GrantedRole = string>(roles: R[], value = true): GrantedRoleKeysMap<R> {
  return arrayToObject(
    roles,
    (x) => x,
    () => value
  );
}
