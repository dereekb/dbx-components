import { AuthRole, AuthRoleSet } from './auth.role';
import { objectHasKey } from '../object/object';
import { filterFromPOJO, forEachKeyValueOnPOJOFunction } from '../object/object.filter.pojo';
import { KeyValueTypleValueFilter } from '../object/object.filter.tuple';
import { objectToTuples } from '../object/object.map';
import { ArrayOrValue, asArray } from '../array/array';
import { addToSet, setContainsAllValues } from '../set';
import { Maybe } from '../value/maybe.type';

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
export type SimpleAuthClaimValue = string | number | boolean;

/**
 * Value in claims.
 */
export type AuthClaimValue = SimpleAuthClaimValue | object;

/**
 * The template claims object. Only string values are allowed, as JSON values may only be keyed by string.
 */
export type AuthClaimsObject = {
  [key: string]: AuthClaimValue;
  // only strings are allowed in a claims object.
  [key: number | symbol]: never;
};

/**
 * An object that contains "claims" in the context of a JSON Web Token (JWT).
 *
 * It is keyed by the claims key.
 */
export type AuthClaims<T extends AuthClaimsObject = AuthClaimsObject> = {
  [K in keyof T]: T[K];
};

/**
 * A claims update. All values can be null.
 */
export type AuthClaimsUpdate<T extends AuthClaimsObject = AuthClaimsObject> = Partial<{
  [K in keyof T]: T[K] | ClearAuthClaimValue;
}>;

/**
 * Configuration for a claims key.
 */
export type AuthRoleClaimsFactoryConfigEntry<V extends AuthClaimValue = AuthClaimValue> = V extends SimpleAuthClaimValue ? AuthRoleClaimsFactoryConfigEntryEncodeOptions<V> | AuthRoleClaimsFactoryConfigEntrySimpleOptions<V> : AuthRoleClaimsFactoryConfigEntryEncodeOptions<V>;

/**
 *
 */
export interface AuthRoleClaimsFactoryConfigEntrySimpleOptions<V extends SimpleAuthClaimValue = SimpleAuthClaimValue> {
  /**
   * The roles to add when this claims is encountered.
   */
  roles: ArrayOrValue<AuthRole>;

  /**
   * (Optional) claim value. Overrides the default claim value.
   */
  value?: V;
}

/**
 * A more configurable configuration for a single claims value.
 */
export interface AuthRoleClaimsFactoryConfigEntryEncodeOptions<V extends AuthClaimValue = AuthClaimValue> {
  /**
   * (Optional) function of retrieving the value associated with this entry given the input claims.
   *
   * If not defined, will defer to role for finding matches and pull from value.
   */
  encodeValueFromRoles: (roles: AuthRoleSet) => V | undefined;

  /**
   * (Optional) Auth roles associated with this claims. If not defined, the claims key is used.
   */
  decodeRolesFromValue: (value: Maybe<V>) => AuthRole[] | undefined;
}

export type IgnoreAuthRoleClaimsEntry = null;

export type AuthRoleClaimsFactoryConfig<T extends AuthClaimsObject = AuthClaimsObject> = {
  [K in keyof T]: AuthRoleClaimsFactoryConfigEntry<T[K]> | IgnoreAuthRoleClaimsEntry;
};

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

export type AuthRoleClaimsToRolesFunction<T extends AuthClaimsObject = AuthClaimsObject> = (roles: AuthRoleSet) => AuthClaimsUpdate<T>;
export type AuthRoleRolesToClaimsFunction<T extends AuthClaimsObject = AuthClaimsObject> = (claims: AuthClaims<T> | AuthClaimsUpdate<T>) => AuthRoleSet;

/**
 * Service used for converting claims to/from a roles set.
 */
export interface AuthRoleClaimsService<T extends AuthClaimsObject> {
  readonly toClaims: AuthRoleClaimsToRolesFunction<T>;
  readonly toRoles: AuthRoleRolesToClaimsFunction<T>;
  readonly defaultClaimValue: unknown;
  readonly defaultEmptyValue: unknown;
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
export function authRoleClaimsService<T extends AuthClaimsObject>(config: AuthRoleClaimsFactoryConfig<T>, defaults: AuthRoleClaimsFactoryDefaults = {}): AuthRoleClaimsService<T> {
  const defaultClaimValue: AuthClaimValue = (objectHasKey(defaults, 'claimValue') ? defaults?.claimValue : AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE) ?? AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE;
  const defaultEmptyValue: AuthClaimValue | ClearAuthClaimValue = (objectHasKey(defaults, 'emptyValue') ? defaults?.emptyValue : AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isSimpleOptions(entry: AuthRoleClaimsFactoryConfigEntry<any>): entry is AuthRoleClaimsFactoryConfigEntrySimpleOptions {
    return (entry as AuthRoleClaimsFactoryConfigEntrySimpleOptions).roles != null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tuples: [AuthClaimKey, AuthRoleClaimsServiceConfigMapEntry][] = objectToTuples<AuthRoleClaimsFactoryConfigEntry>(config as any)
    .filter(([, entry]) => entry != null) // skip any ignored/null values
    .map((x) => {
      const inputEntry = x[1];
      let entry: AuthRoleClaimsFactoryConfigEntryEncodeOptions;

      if (isSimpleOptions(inputEntry)) {
        const expectedValue = inputEntry.value ?? defaultClaimValue;
        const claimRoles = asArray(inputEntry.roles);

        // since checking uses equivalence, the objects will never match equivalence via the === properly.
        // AuthRoleClaimsFactoryConfigEntryEncodeOptions is likely to be used for these cases unknownways, but this will help avoid unexpected errors.
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
          decodeRolesFromValue: (value: Maybe<AuthClaimValue>) => {
            if (value === expectedValue) {
              return claimRoles;
            } else {
              return [];
            }
          }
        };
      } else {
        entry = inputEntry as AuthRoleClaimsFactoryConfigEntryEncodeOptions;
      }

      (entry as AuthRoleClaimsServiceConfigMapEntry).claimKey = x[0];
      return [x[0], entry as AuthRoleClaimsServiceConfigMapEntry];
    });

  const authRoleMap = new Map<AuthClaimKey, AuthRoleClaimsServiceConfigMapEntry>(tuples.map((x) => [x[0].toLowerCase(), x[1]]));

  const toClaims = (roles: AuthRoleSet) => {
    const claims = {} as AuthClaimsUpdate<T>;

    // iterate by each claim value to build the claims.
    tuples.forEach(([claimsKey, entry]) => {
      const claimsValue = entry.encodeValueFromRoles(roles) ?? defaultEmptyValue;
      claims[claimsKey as keyof T] = claimsValue as unknown as T[keyof T];
    });

    return claims;
  };

  const forEachKeyValueAddToSet = forEachKeyValueOnPOJOFunction<AuthClaimsUpdate<T>, Set<string>>({
    forEach: ([claimsKey, value], i, claims, roles: Set<string>) => {
      const entry = authRoleMap.get(claimsKey as string);

      if (entry != null) {
        const decodedRoles = entry.decodeRolesFromValue(value);
        addToSet(roles, decodedRoles);
      }
    }
  });

  const toRoles: AuthRoleRolesToClaimsFunction<T> = (claims: AuthClaimsUpdate<T>) => {
    const roles = new Set<string>();
    forEachKeyValueAddToSet(claims, roles);
    return roles;
  };

  return {
    toClaims,
    toRoles,
    defaultClaimValue,
    defaultEmptyValue
  };
}

/**
 * Converts an AuthClaimsUpdate to AuthClaims by removing all null keys.
 *
 * @param authClaimsUpdate
 * @returns
 */
export function authClaims<T extends AuthClaimsObject = AuthClaimsObject>(authClaimsUpdate: AuthClaimsUpdate<T>): AuthClaims<T> {
  return filterFromPOJO(authClaimsUpdate, { filter: { valueFilter: KeyValueTypleValueFilter.NULL } }) as AuthClaims<T>;
}
