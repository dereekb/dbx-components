import { ArrayOrValue, asArray, Maybe, SetIncludesMode } from '@dereekb/util';

/**
 * A granted role for a model.
 */
export type GrantedRole = string;

export const GRANTED_READ_ROLE_KEY = 'read';

/**
 * Communicates that the current context has read access to a model.
 */
export type GrantedReadRole = typeof GRANTED_READ_ROLE_KEY;

export type KnownGrantedRole = GrantedReadRole;

export const FULL_ACCESS_ROLE_KEY = '__FULL__';

/**
 * Communicates that the current context has full access to a model.
 */
export type GrantedFullAccessGrantedRole = typeof FULL_ACCESS_ROLE_KEY;

export const NO_ACCESS_ROLE_KEY = '__EMPTY__';
export type NoAccessGrantedRole = typeof NO_ACCESS_ROLE_KEY;

export type NoAccessRolesMap = {
  [NO_ACCESS_ROLE_KEY]: true;
};

export function noAccessRolesMap(): NoAccessRolesMap {
  return {
    [NO_ACCESS_ROLE_KEY]: true
  };
}

export function isNoAccessRolesMap<T extends string = string>(input: GrantedRoleMap<T> | NoAccessRolesMap): input is NoAccessRolesMap {
  return (input as NoAccessRolesMap)[NO_ACCESS_ROLE_KEY] === true;
}

export type FullAccessRolesMap = {
  [FULL_ACCESS_ROLE_KEY]: true;
};

export function fullAccessRolesMap(): FullAccessRolesMap {
  return {
    [FULL_ACCESS_ROLE_KEY]: true
  };
}

export function isFullAccessRolesMap<T extends string = string>(input: GrantedRoleMap<T> | FullAccessRolesMap): input is FullAccessRolesMap {
  return (input as FullAccessRolesMap)[FULL_ACCESS_ROLE_KEY] === true;
}

export type GrantedRoleMap<T extends GrantedRole = string> = NoAccessRolesMap | FullAccessRolesMap | GrantedRoleKeysMap<T>;

export type GrantedRoleKeysMap<T extends GrantedRole = string> = {
  [key in T]?: Maybe<boolean>;
};

export interface GrantedRoleMapReader<T extends GrantedRole = string> {
  /**
   * Returns true if no access has been given.
   */
  hasNoAccess(): boolean;

  /**
   * Returns true if the role is granted.
   */
  hasRole(role: T): boolean;

  /**
   * Returns true if the roles are granted.
   */
  hasRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<T>): boolean;

  /**
   * Returns true if the map explicitly contains the role.
   */
  containsRoles(setIncludes: SetIncludesMode, roles: ArrayOrValue<T>): boolean;
}

export function grantedRoleMapReader<T extends GrantedRole = string>(map: GrantedRoleMap<T>): GrantedRoleMapReader<T> {
  return new GrantedRoleMapReaderInstance(map);
}

export class GrantedRoleMapReaderInstance<T extends GrantedRole = string> implements GrantedRoleMapReader<T> {
  constructor(private readonly _map: GrantedRoleMap<T>) {}

  hasNoAccess(): boolean {
    return (this._map as NoAccessRolesMap)[NO_ACCESS_ROLE_KEY];
  }

  hasRole(role: T): boolean {
    return this.hasRoles('any', role);
  }

  hasRoles(setIncludes: SetIncludesMode, inputRoles: ArrayOrValue<T>): boolean {
    if ((this._map as FullAccessRolesMap)[FULL_ACCESS_ROLE_KEY]) {
      return true;
    } else {
      return this.containsRoles(setIncludes, inputRoles);
    }
  }

  containsRoles(setIncludes: SetIncludesMode, inputRoles: ArrayOrValue<T>): boolean {
    const roles = asArray(inputRoles);

    if (setIncludes === 'any') {
      return this.containsAnyRole(roles);
    } else {
      return this.containsEachRole(roles);
    }
  }

  containsAnyRole(roles: GrantedRole[]): boolean {
    for (const role of roles) {
      if ((this._map as GrantedRoleKeysMap)[role]) {
        return true;
      }
    }

    return false;
  }

  containsEachRole(roles: GrantedRole[]): boolean {
    for (let role of roles) {
      if (!(this._map as GrantedRoleKeysMap)[role]) {
        return false;
      }
    }

    return true;
  }
}
