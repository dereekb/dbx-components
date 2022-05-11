import { AuthRole, AuthRoleSet } from "./auth.role";
import { forEachKeyValue, objectHasKey } from "../object/object";
import { objectToTuples } from '../object/object.map';
import { ArrayOrValue, asArray } from '../array/array';
import { setContainsAllValues } from '../set';

/**
 * Key in the claims.
 */
export type AuthClaimKey = string;

/**
 * Value in claims.
 */
export type AuthClaimValue = string | number | object;

/**
 * An object that contains "claims" in the context of a JSON Web Token (JWT).
 * 
 * It is keyed by the claims key.
 */
export type AuthClaims = {
  [key: string]: AuthClaimValue;
};

export type AuthRoleClaimsFactoryConfigEntry = AuthRoleClaimsFactoryConfigEntrySimpleOptions | AuthRoleClaimsFactoryConfigEntryEncodeOptions;

export interface AuthRoleClaimsFactoryConfigEntrySimpleOptions {

  /**
   * The roles to add when this claims is encountered.
   */
  role: ArrayOrValue<AuthRole>;

  /**
   * (Optional) claim value. Overrides the default claim value.
   */
  value?: AuthClaimValue;

}

export interface AuthRoleClaimsFactoryConfigEntryEncodeOptions {

  /**
   * (Optional) function of retrieving the value associated with this entry given the input claims.
   * 
   * If not defined, will defer to role for finding matches and pull from value.
   */
  encodeValueFromRoles: (roles: AuthRoleSet) => AuthClaimValue;

  /**
   * (Optional) Auth roles associated with this claims. If not defined, the claims key is used.
   */
  decodeRolesFromValue: (value: AuthClaimValue) => AuthRole[];

}

export type AuthRoleClaimsFactoryConfig = {
  [key: string]: AuthRoleClaimsFactoryConfigEntry;
}

export interface AuthRoleClaimsFactoryDefaults {

  /**
   * Default value to use for claims that have no value present.
   */
  claimValue?: any;

  /**
   * Default value for claims that are not defined.
   */
  emptyValue?: any;

}

export type AuthRoleClaimsFactory = (roles: AuthRoleSet) => AuthClaims;
export type AuthRoleClaimsRoleSetFactory = (claims: AuthClaims) => AuthRoleSet;

export interface AuthRoleClaimsService {
  readonly toClaims: AuthRoleClaimsFactory;
  readonly toRoles: AuthRoleClaimsRoleSetFactory;
  readonly defaultClaimValue: any;
  readonly defaultEmptyValue: any;
}

export const AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE = null;
export const AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE = 1;

interface AuthRoleClaimsFactoryConfigMapEntry {
  claimKey: AuthClaimKey;
  entry: AuthRoleClaimsFactoryConfigEntry;
}

export function authRoleClaimsService(config: AuthRoleClaimsFactoryConfig, defaults: AuthRoleClaimsFactoryDefaults = {}): AuthRoleClaimsService {
  const tuples: [AuthClaimKey, AuthRoleClaimsFactoryConfigEntry][] = objectToTuples<AuthRoleClaimsFactoryConfigEntry>(config);  // do not inject the default value if it is presented.
  const authRolesMap = new Map<AuthClaimKey, AuthRoleClaimsFactoryConfigMapEntry>(tuples.map(x => [(x[0]).toLowerCase(), { entry: x[1], claimKey: x[0] }]));

  const defaultClaimValue = objectHasKey(defaults, 'claimValue') ? defaults?.claimValue : AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE;
  const defaultEmptyValue = objectHasKey(defaults, 'emptyValue') ? defaults?.emptyValue : AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE;

  const toClaims = (roles: AuthRoleSet) => {
    const claims: AuthClaims = {};

    // iterate by each claim value to build the claims.
    tuples.forEach(([claimsKey, entry]) => {
      let claimsValue = defaultEmptyValue;  // start empty

      if ((entry as AuthRoleClaimsFactoryConfigEntrySimpleOptions).role != null) {
        const claimRoles = asArray((entry as AuthRoleClaimsFactoryConfigEntrySimpleOptions).role);

        // only set the claims value if all values are present in the claims.
        if (setContainsAllValues(roles, claimRoles)) {
          claimsValue = (entry as AuthRoleClaimsFactoryConfigEntrySimpleOptions).value ?? defaultClaimValue;
        }
      } else if ((entry as AuthRoleClaimsFactoryConfigEntryEncodeOptions).encodeValueFromRoles) {
        claimsValue = (entry as AuthRoleClaimsFactoryConfigEntryEncodeOptions).encodeValueFromRoles(roles);
      }

      claims[claimsKey] = claimsValue;
    });

    return claims;
  };

  const toRoles = (claims: AuthClaims) => {
    const roles = new Set<string>();

    forEachKeyValue(claims, {
      forEach: ([claimsKey, value]: [string, any]) => {
        const entry = authRolesMap.get(claimsKey);

        /*
        if (entry != null && entry.value === value) {
          roles.add(entry.role ?? claimsKey);
        }
        */
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
