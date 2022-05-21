import { AuthRole, AuthRoleSet } from "./auth.role";
import { forEachKeyValue, objectHasKey } from "../object/object";
import { objectToTuples } from '../object/object.map';
import { ArrayOrValue, asArray } from '../array/array';
import { addToSet, setContainsAllValues } from '../set';

/**
 * Key in the claims.
 */
export type AuthClaimKey = string;

/**
 * Value in claims.
 */
export type ClearAuthClaimValue = null;

/**
 * Value in claims.
 */
export type SimpleAuthClaimValue = string | number;

/**
 * Value in claims.
 */
export type AuthClaimValue = SimpleAuthClaimValue | object;

/**
 * An object that contains "claims" in the context of a JSON Web Token (JWT).
 * 
 * It is keyed by the claims key.
 */
export type AuthClaims<T = object> = {
  [K in keyof T]: AuthClaimValue;
};

/**
 * A claims update.
 */
export type AuthClaimsUpdate<T = object> = {
  [K in keyof Partial<T>]: AuthClaimValue | ClearAuthClaimValue;
};

/**
 * Configuration for a claims key.
 */
export type AuthRoleClaimsFactoryConfigEntry = AuthRoleClaimsFactoryConfigEntrySimpleOptions | AuthRoleClaimsFactoryConfigEntryEncodeOptions;

/**
 * 
 */
export interface AuthRoleClaimsFactoryConfigEntrySimpleOptions {

  /**
   * The roles to add when this claims is encountered.
   */
  roles: ArrayOrValue<AuthRole>;

  /**
   * (Optional) claim value. Overrides the default claim value.
   */
  value?: SimpleAuthClaimValue;

}

/**
 * A more configurable configuration for a single claims value.
 */
export interface AuthRoleClaimsFactoryConfigEntryEncodeOptions {

  /**
   * (Optional) function of retrieving the value associated with this entry given the input claims.
   * 
   * If not defined, will defer to role for finding matches and pull from value.
   */
  encodeValueFromRoles: (roles: AuthRoleSet) => AuthClaimValue | undefined;

  /**
   * (Optional) Auth roles associated with this claims. If not defined, the claims key is used.
   */
  decodeRolesFromValue: (value: AuthClaimValue) => AuthRole[] | undefined;

}

export type AuthRoleClaimsFactoryConfig = {
  [key: string]: AuthRoleClaimsFactoryConfigEntry;
}

export interface AuthRoleClaimsFactoryDefaults {

  /**
   * Default value to use for claims that have no value present.
   * 
   * If undefined, defaults to AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE.
   */
  claimValue?: AuthClaimValue;

  /**
   * Default value for claims that are not defined.
   * 
   * If undefined, defaults to AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE.
   */
  emptyValue?: AuthClaimValue | ClearAuthClaimValue;

}

export type AuthRoleClaimsToRolesFunction<T extends AuthRoleClaimsFactoryConfig = AuthRoleClaimsFactoryConfig> = (roles: AuthRoleSet) => AuthClaimsUpdate<T>;
export type AuthRoleRolesToClaimsFunction<T extends AuthRoleClaimsFactoryConfig = AuthRoleClaimsFactoryConfig> = (claims: AuthClaims<T> | AuthClaimsUpdate<T>) => AuthRoleSet;

/**
 * Service used for converting claims to/from a roles set.
 */
export interface AuthRoleClaimsService<T extends AuthRoleClaimsFactoryConfig = any> {
  readonly toClaims: AuthRoleClaimsToRolesFunction<T>;
  readonly toRoles: AuthRoleRolesToClaimsFunction<T>;
  readonly defaultClaimValue: any;
  readonly defaultEmptyValue: any;
}

export const AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE = 1;
export const AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE = null;

interface AuthRoleClaimsServiceConfigMapEntry extends AuthRoleClaimsFactoryConfigEntryEncodeOptions {
  claimKey: AuthClaimKey;
}

/**
 * Creates a AuthRoleClaimsService using the input configuration.
 * 
 * @param config 
 * @param defaults 
 * @returns 
 */
export function authRoleClaimsService<T extends AuthRoleClaimsFactoryConfig>(config: T, defaults: AuthRoleClaimsFactoryDefaults = {}): AuthRoleClaimsService<T> {

  const defaultClaimValue: AuthClaimValue = (objectHasKey(defaults, 'claimValue') ? defaults?.claimValue : AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE) ?? AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE;
  const defaultEmptyValue: AuthClaimValue | ClearAuthClaimValue = (objectHasKey(defaults, 'emptyValue') ? defaults?.emptyValue : AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE) ?? null;

  function isSimpleOptions(entry: AuthRoleClaimsFactoryConfigEntry): entry is AuthRoleClaimsFactoryConfigEntrySimpleOptions {
    return (entry as AuthRoleClaimsFactoryConfigEntrySimpleOptions).roles != null;
  }

  const tuples: [AuthClaimKey, AuthRoleClaimsServiceConfigMapEntry][] = objectToTuples<AuthRoleClaimsFactoryConfigEntry>(config).map((x) => {
    const inputEntry = x[1];
    let entry: AuthRoleClaimsFactoryConfigEntryEncodeOptions;

    if (isSimpleOptions(inputEntry)) {
      const expectedValue = inputEntry.value ?? defaultClaimValue;
      const claimRoles = asArray(inputEntry.roles);

      // since checking uses equivalence, the objects will never match equivalence via the === properly.
      // AuthRoleClaimsFactoryConfigEntryEncodeOptions is likely to be used for these cases anyways, but this will help avoid unexpected errors.
      if (typeof expectedValue === 'object') {
        throw new Error(`failed decoding claims. Expected value to be a string or number. Object isn't supported with simple claims.`);
      }

      entry = {
        encodeValueFromRoles: (roles: AuthRoleSet) => {
          let claimsValue;

          // only set the claims value if all values are present in the claims.
          if (setContainsAllValues(roles, claimRoles)) {
            claimsValue = inputEntry.value ?? defaultClaimValue;
          }

          return claimsValue;
        },
        decodeRolesFromValue: (value: AuthClaimValue) => {
          if (value === expectedValue) {
            return claimRoles;
          } else {
            return [];
          }
        }
      };
    } else {
      entry = inputEntry;
    }

    (entry as AuthRoleClaimsServiceConfigMapEntry).claimKey = x[0];
    return [x[0], entry as AuthRoleClaimsServiceConfigMapEntry];
  });

  const authRolesMap = new Map<AuthClaimKey, AuthRoleClaimsServiceConfigMapEntry>(tuples.map(x => [(x[0]).toLowerCase(), x[1]]));

  const toClaims = (roles: AuthRoleSet) => {
    const claims = {} as AuthClaimsUpdate<T>;

    // iterate by each claim value to build the claims.
    tuples.forEach(([claimsKey, entry]) => {
      const claimsValue = entry.encodeValueFromRoles(roles) ?? defaultEmptyValue;
      claims[claimsKey as keyof T] = claimsValue;
    });

    return claims;
  };

  const toRoles = (claims: AuthClaims) => {
    const roles = new Set<string>();

    forEachKeyValue(claims, {
      forEach: ([claimsKey, value]: [string, any]) => {
        const entry = authRolesMap.get(claimsKey);

        if (entry != null) {
          const decodedRoles = entry.decodeRolesFromValue(value);
          addToSet(roles, decodedRoles);
        }
      }
    });

    return roles;
  };

  return {
    toClaims,
    toRoles,
    defaultClaimValue,
    defaultEmptyValue
  }
}
