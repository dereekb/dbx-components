/**
 * Auth runtime registry wrapper.
 *
 * Catalogs three related domains used to gate access in dbx-components apps:
 *
 *   - **roles**  — `AuthRole` strings used by the role-set permission model.
 *     The well-known constants in `@dereekb/util` (admin, onboarded, tos,
 *     user) are bundled by default; downstream apps can register additional
 *     roles via tagged JSDoc on their own role consts or claims interfaces.
 *
 *   - **claims** — JWT custom-claim keys (e.g. `a`, `o`, `fr`) plus the role
 *     mapping each one performs through {@link authRoleClaimsService}. Each
 *     entry knows which `*ApiAuthClaims` interface declares it and which
 *     app it belongs to.
 *
 *   - **scopes** — OAuth/OIDC scope names (`model.read`, `model.write`, …)
 *     surfaced through the OIDC bridge, plus the source location where each
 *     scope is enforced (e.g. `oidcCallModelScopePreAssert`).
 *
 *   - **apps**   — one entry per downstream app (demo-api, hellosubs-api).
 *     Bundles the claims interface name, the claims-service constant name,
 *     and the set of claim keys / scopes the app accepts.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any entry array via
 * {@link createAuthRegistryFromEntries} to drive the tools without touching
 * disk.
 */

// MARK: Public types

/**
 * Whether an entry is a built-in `@dereekb/*` definition (`'system'`) or
 * was contributed by a downstream app's catalog (`'app'`). Used by the
 * lookup tools to label provenance and by the catalog to filter.
 */
export type AuthEntrySource = 'system' | 'app';

/**
 * One AuthRole entry.
 */
export interface AuthRoleInfo {
  /**
   * The string value of the role as it appears in an `AuthRoleSet`
   * (`'admin'`, `'onboarded'`, `'uploads'`).
   */
  readonly role: string;
  /**
   * TypeScript constant name when the role originates from an exported
   * const (e.g. `'AUTH_ADMIN_ROLE'`). Optional for app-defined roles
   * declared inline.
   */
  readonly constName?: string;
  /**
   * Origin of the entry — `'system'` for `@dereekb/*` built-ins, `'app'`
   * for catalog entries contributed by a downstream app.
   */
  readonly source: AuthEntrySource;
  /**
   * Workspace-relative path to the file that declares the role (or the
   * mapping that introduces it).
   */
  readonly sourcePath: string;
  /**
   * 1-based line number of the role declaration. Optional — included
   * when the extractor / hand-curated entry knows the line.
   */
  readonly sourceLine?: number;
  /**
   * One-line description.
   */
  readonly description: string;
  /**
   * Free-form catalog tags (e.g. `'privileged'`, `'verified-user'`).
   * Tags come from `@dbxAuthRoleTag` JSDoc on the claim that maps to the
   * role, or from the curated entry. Used by `dbx_auth_role_lookup` to
   * filter.
   */
  readonly tags: readonly string[];
}

/**
 * Role-mapping payload nested inside an {@link AuthClaimInfo}. Mirrors the
 * shape of {@link AuthRoleClaimsFactoryConfigEntry} after normalisation —
 * inverse vs forward, the resolved role list, and any non-default claim
 * value.
 */
export interface AuthClaimRoleMappingInfo {
  /**
   * Roles set (or revoked, when `inverse` is true) by the claim.
   */
  readonly roles: readonly string[];
  /**
   * Whether the mapping is an inverse claim (claim presence revokes roles
   * instead of granting them).
   */
  readonly inverse: boolean;
  /**
   * For inverse mappings, the SetIncludesMode controlling when the claim
   * value is set during encoding.
   */
  readonly inverseMode?: 'any' | 'all';
  /**
   * Override claim value when set. `undefined` means the default
   * ({@link AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE}) is used.
   */
  readonly claimValue?: string | number | boolean;
  /**
   * Custom encode/decode entry — used by claims that don't fit the
   * `roles` shape and supply functions instead. The presence of this
   * field signals callers that the role list is approximate.
   */
  readonly customEncodeDecode: boolean;
}

/**
 * One auth-claim entry.
 */
export interface AuthClaimInfo {
  /**
   * Claim key as it appears on the JWT custom-claims object (`'a'`,
   * `'o'`, `'fr'`).
   */
  readonly key: string;
  /**
   * TypeScript-ish summary of the claim value type (e.g. `'1'`,
   * `'StorageFileUploadUserRestriction'`).
   */
  readonly type: string;
  /**
   * One-line description of the claim's meaning.
   */
  readonly description: string;
  /**
   * Slug of the app that owns the claim (e.g. `'demo-api'`). `undefined`
   * for shared library claims (e.g. `fr` from `@dereekb/firebase`).
   */
  readonly app?: string;
  /**
   * Name of the TypeScript interface that declares the claim
   * (e.g. `'DemoApiAuthClaims'`, `'StorageFileUploadUserClaims'`).
   */
  readonly interfaceName?: string;
  /**
   * Workspace-relative path to the file declaring the claim.
   */
  readonly sourcePath: string;
  /**
   * 1-based line number of the claim's property declaration. Optional.
   */
  readonly sourceLine?: number;
  /**
   * Origin of the entry. App-owned claims are `'app'`; library claims
   * (e.g. `fr`) are `'system'`.
   */
  readonly source: AuthEntrySource;
  /**
   * Role-mapping payload. Always present — every catalogued claim maps
   * to at least one role (or revokes one for inverse claims).
   */
  readonly mapping: AuthClaimRoleMappingInfo;
  /**
   * Free-form catalog tags pulled from `@dbxAuthRoleTag` JSDoc on the
   * claim's property declaration.
   */
  readonly tags: readonly string[];
}

/**
 * Where a scope is enforced. Multiple entries are allowed when a scope is
 * checked in more than one place (e.g. `model.read` is enforced by the
 * callModel preAssert and by per-app middleware).
 */
export interface AuthScopeEnforcementInfo {
  readonly path: string;
  readonly line?: number;
  /**
   * One-line description of the gate (e.g. `'oidcCallModelScopePreAssert'`).
   */
  readonly description: string;
}

/**
 * One OIDC scope entry.
 */
export interface AuthScopeInfo {
  /**
   * Full scope name (`'model.read'`, `'demo'`).
   */
  readonly scope: string;
  /**
   * Conventional prefix shared by a family of scopes
   * (e.g. `'model.'` for the callModel CRUD scopes).
   */
  readonly prefix?: string;
  /**
   * Logical CRUD verb associated with the scope. `undefined` for app-
   * specific or non-CRUD scopes.
   */
  readonly callType?: string;
  /**
   * One-line description.
   */
  readonly description: string;
  /**
   * Source files that declare or enforce the scope.
   */
  readonly enforcedAt: readonly AuthScopeEnforcementInfo[];
  /**
   * Error code thrown when the gate rejects a request. Optional.
   */
  readonly errorCode?: string;
  /**
   * Origin of the entry.
   */
  readonly source: AuthEntrySource;
  /**
   * Workspace-relative path to the file that defines the scope constant
   * or scope catalog. Optional for app-defined scopes that don't have a
   * single canonical declaration.
   */
  readonly sourcePath?: string;
  /**
   * 1-based line number of the scope declaration. Optional.
   */
  readonly sourceLine?: number;
  /**
   * Apps that surface this scope to callers (subset of the claim catalog
   * apps). Empty for system scopes that aren't tied to a specific app.
   */
  readonly apps: readonly string[];
}

/**
 * One per downstream app catalogued by the registry.
 */
export interface AuthAppInfo {
  /**
   * App slug — typically the Nx project name (`'demo-api'`).
   */
  readonly app: string;
  /**
   * `*ApiAuthClaims`-style interface name declared by the app
   * (e.g. `'DemoApiAuthClaims'`).
   */
  readonly claimsInterfaceName: string;
  /**
   * Constant exported by the app's `claims.ts` for the
   * {@link authRoleClaimsService} return value (e.g. `'DEMO_AUTH_CLAIMS_SERVICE'`).
   */
  readonly serviceConstName?: string;
  /**
   * Workspace-relative path to the app's `claims.ts` (or equivalent).
   */
  readonly sourcePath: string;
  /**
   * Claim keys catalogued for the app.
   */
  readonly claimKeys: readonly string[];
  /**
   * OIDC scope names accepted by the app, in registry order.
   */
  readonly scopes: readonly string[];
  /**
   * Optional one-line summary of what the app's auth surface gates.
   */
  readonly description?: string;
}

/**
 * Domain-friendly read API over the merged auth catalog.
 */
export interface AuthRegistry {
  readonly roles: readonly AuthRoleInfo[];
  readonly claims: readonly AuthClaimInfo[];
  readonly scopes: readonly AuthScopeInfo[];
  readonly apps: readonly AuthAppInfo[];
  readonly loadedSources: readonly string[];
  /**
   * Returns the role entry whose `role` string or `constName` matches
   * `key` (case-insensitive). Returns `undefined` when no entry matches.
   */
  findRole(key: string): AuthRoleInfo | undefined;
  /**
   * Returns every role tagged with the given tag (case-insensitive).
   */
  findRolesByTag(tag: string): readonly AuthRoleInfo[];
  /**
   * Returns the claim entry whose `key` matches `key` exactly. When
   * `app` is supplied the lookup is scoped to that app; otherwise the
   * first match in registry order wins.
   */
  findClaim(key: string, app?: string): AuthClaimInfo | undefined;
  /**
   * Returns every claim catalogued for the given app (case-insensitive).
   */
  findClaimsByApp(app: string): readonly AuthClaimInfo[];
  /**
   * Returns every claim whose `interfaceName` matches `interfaceName`
   * (case-insensitive). Useful when callers know the type name but not
   * the app slug.
   */
  findClaimsByInterface(interfaceName: string): readonly AuthClaimInfo[];
  /**
   * Returns the scope entry whose `scope` matches exactly. Case-sensitive
   * because OIDC scope names are case-sensitive.
   */
  findScope(scope: string): AuthScopeInfo | undefined;
  /**
   * Returns the app entry whose slug matches `app` exactly
   * (case-insensitive).
   */
  findApp(app: string): AuthAppInfo | undefined;
  /**
   * Returns the app entry whose `claimsInterfaceName` matches
   * (case-insensitive).
   */
  findAppByInterface(interfaceName: string): AuthAppInfo | undefined;
  /**
   * Returns every role that is set (or revoked) by at least one claim.
   * Combined with the claim catalog this lets `dbx_auth_role_lookup`
   * answer "which claims set this role?".
   */
  findClaimsForRole(role: string): readonly AuthClaimInfo[];
}

// MARK: Construction
/**
 * Input to {@link createAuthRegistryFromEntries}. Every field is optional
 * to make registry composition easy in tests.
 */
export interface CreateAuthRegistryFromEntriesInput {
  readonly roles?: readonly AuthRoleInfo[];
  readonly claims?: readonly AuthClaimInfo[];
  readonly scopes?: readonly AuthScopeInfo[];
  readonly apps?: readonly AuthAppInfo[];
  readonly loadedSources?: readonly string[];
}

/**
 * Builds an {@link AuthRegistry} from raw entry arrays. The constructed
 * registry indexes by every accessor's primary key so all lookups are O(1)
 * after construction.
 *
 * @param input - the entry arrays plus the source labels to advertise
 * @returns a fully-indexed registry suitable for tools and resources
 * @__NO_SIDE_EFFECTS__
 */
export function createAuthRegistryFromEntries(input: CreateAuthRegistryFromEntriesInput = {}): AuthRegistry {
  const roles = input.roles ?? [];
  const claims = input.claims ?? [];
  const scopes = input.scopes ?? [];
  const apps = input.apps ?? [];
  const loadedSources = input.loadedSources ?? [];
  const { rolesByKey, rolesByTag } = indexRoles(roles);
  const { claimsByApp, claimsByInterface, claimsByRole } = indexClaims(claims);
  const scopesByName = indexScopes(scopes);
  const { appsBySlug, appsByInterface } = indexApps(apps);

  const registry: AuthRegistry = {
    roles,
    claims,
    scopes,
    apps,
    loadedSources: [...loadedSources],
    findRole(key) {
      return rolesByKey.get(key.toLowerCase());
    },
    findRolesByTag(tag) {
      return rolesByTag.get(tag.toLowerCase()) ?? [];
    },
    findClaim(key, app) {
      let result: AuthClaimInfo | undefined;
      if (app === undefined) {
        result = claims.find((c) => c.key === key);
      } else {
        const inApp = claimsByApp.get(app.toLowerCase()) ?? [];
        result = inApp.find((c) => c.key === key);
        // Fall back to library-level claims (no `app`) — apps inherit
        // them via type intersections like
        // `DemoApiAuthClaims = StorageFileUploadUserClaims & {…}`.
        result ??= claims.find((c) => c.key === key && c.app === undefined);
      }
      return result;
    },
    findClaimsByApp(app) {
      return claimsByApp.get(app.toLowerCase()) ?? [];
    },
    findClaimsByInterface(interfaceName) {
      return claimsByInterface.get(interfaceName.toLowerCase()) ?? [];
    },
    findScope(scope) {
      return scopesByName.get(scope);
    },
    findApp(app) {
      return appsBySlug.get(app.toLowerCase());
    },
    findAppByInterface(interfaceName) {
      return appsByInterface.get(interfaceName.toLowerCase());
    },
    findClaimsForRole(role) {
      return claimsByRole.get(role.toLowerCase()) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry used when no auth catalog has been loaded. Tools wired
 * against this registry behave as if the catalog loaded successfully with
 * zero entries.
 */
export const EMPTY_AUTH_REGISTRY: AuthRegistry = createAuthRegistryFromEntries();

// MARK: Internals
function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [value]);
  } else {
    existing.push(value);
  }
}

function indexRoles(roles: readonly AuthRoleInfo[]): { readonly rolesByKey: Map<string, AuthRoleInfo>; readonly rolesByTag: Map<string, AuthRoleInfo[]> } {
  const rolesByKey = new Map<string, AuthRoleInfo>();
  const rolesByTag = new Map<string, AuthRoleInfo[]>();
  for (const role of roles) {
    const lowered = role.role.toLowerCase();
    if (!rolesByKey.has(lowered)) rolesByKey.set(lowered, role);
    if (role.constName !== undefined) {
      const constLowered = role.constName.toLowerCase();
      if (!rolesByKey.has(constLowered)) rolesByKey.set(constLowered, role);
    }
    for (const tag of role.tags) {
      pushInto(rolesByTag, tag.toLowerCase(), role);
    }
  }
  return { rolesByKey, rolesByTag };
}

function indexClaims(claims: readonly AuthClaimInfo[]): { readonly claimsByApp: Map<string, AuthClaimInfo[]>; readonly claimsByInterface: Map<string, AuthClaimInfo[]>; readonly claimsByRole: Map<string, AuthClaimInfo[]> } {
  const claimsByApp = new Map<string, AuthClaimInfo[]>();
  const claimsByInterface = new Map<string, AuthClaimInfo[]>();
  const claimsByRole = new Map<string, AuthClaimInfo[]>();
  for (const claim of claims) {
    if (claim.app !== undefined) pushInto(claimsByApp, claim.app.toLowerCase(), claim);
    if (claim.interfaceName !== undefined) pushInto(claimsByInterface, claim.interfaceName.toLowerCase(), claim);
    for (const role of claim.mapping.roles) {
      pushInto(claimsByRole, role.toLowerCase(), claim);
    }
  }
  return { claimsByApp, claimsByInterface, claimsByRole };
}

function indexScopes(scopes: readonly AuthScopeInfo[]): Map<string, AuthScopeInfo> {
  const scopesByName = new Map<string, AuthScopeInfo>();
  for (const scope of scopes) {
    if (!scopesByName.has(scope.scope)) scopesByName.set(scope.scope, scope);
  }
  return scopesByName;
}

function indexApps(apps: readonly AuthAppInfo[]): { readonly appsBySlug: Map<string, AuthAppInfo>; readonly appsByInterface: Map<string, AuthAppInfo> } {
  const appsBySlug = new Map<string, AuthAppInfo>();
  const appsByInterface = new Map<string, AuthAppInfo>();
  for (const app of apps) {
    appsBySlug.set(app.app.toLowerCase(), app);
    appsByInterface.set(app.claimsInterfaceName.toLowerCase(), app);
  }
  return { appsBySlug, appsByInterface };
}
