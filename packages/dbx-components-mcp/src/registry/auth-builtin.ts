/**
 * Curated baseline auth entries shipped with dbx-components-mcp.
 *
 * The auth catalog has three layers:
 *
 *   1. **Built-in (this file)** — `@dereekb/util` role consts, the
 *      `@dereekb/firebase` storage-upload claim, and the five `model.*`
 *      OIDC scopes from `@dereekb/firebase-server`. These are catalog
 *      entries every dbx-components workspace inherits regardless of
 *      which apps it ships.
 *
 *   2. **Workspace built-ins (this file, demo)** — entries for apps that
 *      live in this workspace's `components/`. Listed here so the registry
 *      ships with a working dataset; downstream apps maintained outside
 *      this monorepo will replace these with their own entries via the
 *      planned scan-driven loader.
 *
 *   3. **Downstream-loaded (TODO)** — entries extracted from a downstream
 *      app's `claims.ts` file at server-startup time. Tagged with
 *      `@dbxAuthClaim`, `@dbxAuthRoleTag`, `@dbxAuthClaimsApp`, and
 *      `@dbxAuthClaimsService` JSDoc tags so the extractor can locate them.
 */

import { AUTH_ADMIN_ROLE, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE, AUTH_USER_ROLE } from '@dereekb/util';
import { STORAGE_FILE_UPLOAD_USER_ROLE } from '@dereekb/firebase';
import type { AuthAppInfo, AuthClaimInfo, AuthRoleInfo, AuthScopeInfo } from './auth-runtime.js';

// Inlined to avoid pulling `@dereekb/firebase-server/oidc` (heavy NestJS
// peer deps) into the MCP runtime. Keep in sync with
// `packages/firebase-server/oidc/src/lib/scope.ts`.
const CALL_MODEL_OIDC_SCOPE_PREFIX = 'model.';
const CALL_MODEL_OIDC_SCOPES = ['model.create', 'model.read', 'model.update', 'model.delete', 'model.query'] as const;
const CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE: Readonly<Record<'create' | 'read' | 'update' | 'delete' | 'query', (typeof CALL_MODEL_OIDC_SCOPES)[number]>> = {
  create: 'model.create',
  read: 'model.read',
  update: 'model.update',
  delete: 'model.delete',
  query: 'model.query'
};
const CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE = 'CALL_MODEL_MISSING_OIDC_SCOPE';

const UTIL_ROLE_PATH = 'packages/util/src/lib/auth/auth.role.ts';
const STORAGE_CLAIM_PATH = 'packages/firebase/src/lib/model/storagefile/storagefile.upload.claims.ts';
const OIDC_SCOPE_PATH = 'packages/firebase-server/oidc/src/lib/scope.ts';
const DEMO_CLAIMS_PATH = 'components/demo-firebase/src/lib/auth/claims.ts';

// MARK: Built-in roles
/**
 * Roles defined by `@dereekb/util` plus the `uploads` role contributed by
 * `@dereekb/firebase`. Tags reflect the catalog convention used by
 * downstream apps:
 *
 *   - `system`     — built-in role from a `@dereekb/*` package
 *   - `auth`       — fundamental auth-state role
 *   - `privileged` — admin / staff-level role
 *   - `verified-user` — applies to vetted onboarded users
 *   - `uploads`    — role gating storage uploads
 */
export const BUILTIN_AUTH_ROLES: readonly AuthRoleInfo[] = [
  {
    role: AUTH_TOS_SIGNED_ROLE,
    constName: 'AUTH_TOS_SIGNED_ROLE',
    source: 'system',
    sourcePath: UTIL_ROLE_PATH,
    sourceLine: 26,
    description: 'Auth role for an account that has signed the terms of service.',
    tags: ['system', 'auth', 'verified-user']
  },
  {
    role: AUTH_ONBOARDED_ROLE,
    constName: 'AUTH_ONBOARDED_ROLE',
    source: 'system',
    sourcePath: UTIL_ROLE_PATH,
    sourceLine: 31,
    description: 'Auth role for an account that has been onboarded.',
    tags: ['system', 'auth', 'verified-user']
  },
  {
    role: AUTH_ADMIN_ROLE,
    constName: 'AUTH_ADMIN_ROLE',
    source: 'system',
    sourcePath: UTIL_ROLE_PATH,
    sourceLine: 36,
    description: 'Auth role for a full admin. Allowed into all sections of the app.',
    tags: ['system', 'auth', 'privileged', 'staff']
  },
  {
    role: AUTH_USER_ROLE,
    constName: 'AUTH_USER_ROLE',
    source: 'system',
    sourcePath: UTIL_ROLE_PATH,
    sourceLine: 41,
    description: 'Auth role for a general logged-in user.',
    tags: ['system', 'auth']
  },
  {
    role: STORAGE_FILE_UPLOAD_USER_ROLE,
    constName: 'STORAGE_FILE_UPLOAD_USER_ROLE',
    source: 'system',
    sourcePath: STORAGE_CLAIM_PATH,
    sourceLine: 32,
    description: 'Role granting storage-file uploads. Revoked when the inverse `fr` claim is set.',
    tags: ['system', 'storage', 'uploads']
  }
];

// MARK: Built-in claims
/**
 * Library-level custom claims. Today this is just the `fr` upload-restriction
 * claim from `@dereekb/firebase`; downstream apps mix it into their own
 * `*ApiAuthClaims` interfaces.
 */
export const BUILTIN_AUTH_CLAIMS: readonly AuthClaimInfo[] = [
  {
    key: 'fr',
    type: 'StorageFileUploadUserRestriction',
    description: 'Inverse claim — when set, revokes the `uploads` role from the user.',
    interfaceName: 'StorageFileUploadUserClaims',
    sourcePath: STORAGE_CLAIM_PATH,
    sourceLine: 26,
    source: 'system',
    mapping: {
      roles: [STORAGE_FILE_UPLOAD_USER_ROLE],
      inverse: true,
      inverseMode: 'any',
      customEncodeDecode: false
    },
    tags: ['system', 'storage', 'uploads', 'inverse']
  }
];

// MARK: Built-in scopes
/**
 * The five callModel CRUD scopes enforced by
 * {@link oidcCallModelScopePreAssert}. App-specific scopes live in the
 * downstream catalog layer.
 */
export const BUILTIN_AUTH_SCOPES: readonly AuthScopeInfo[] = CALL_MODEL_OIDC_SCOPES.map((scope) => {
  const callType = (Object.entries(CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE).find(([, s]) => s === scope) ?? [])[0];
  const result: AuthScopeInfo = {
    scope,
    prefix: CALL_MODEL_OIDC_SCOPE_PREFIX,
    callType,
    description: `Required OIDC scope for the \`callModel\` ${callType ?? 'CRUD'} verb.`,
    enforcedAt: [
      {
        path: OIDC_SCOPE_PATH,
        line: 76,
        description: '`oidcCallModelScopePreAssert` rejects requests that lack this scope.'
      }
    ],
    errorCode: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE,
    source: 'system',
    sourcePath: OIDC_SCOPE_PATH,
    sourceLine: 20,
    apps: []
  };
  return result;
});

// MARK: Demo app
/**
 * Workspace-level catalog entry for the demo-firebase / demo-api pair.
 * Mirrors the JSDoc-tagged claims in
 * `components/demo-firebase/src/lib/auth/claims.ts`.
 */
const DEMO_CLAIMS: readonly AuthClaimInfo[] = [
  {
    key: 'o',
    type: '1',
    description: 'Onboarded flag — set when the user has signed TOS and completed onboarding.',
    app: 'demo-api',
    interfaceName: 'DemoApiAuthClaims',
    sourcePath: DEMO_CLAIMS_PATH,
    sourceLine: 18,
    source: 'app',
    mapping: {
      roles: [AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE],
      inverse: false,
      claimValue: 1,
      customEncodeDecode: false
    },
    tags: ['onboarded', 'verified-user']
  },
  {
    key: 'a',
    type: '1',
    description: 'Admin role — grants full access to admin-only sections of the app.',
    app: 'demo-api',
    interfaceName: 'DemoApiAuthClaims',
    sourcePath: DEMO_CLAIMS_PATH,
    sourceLine: 25,
    source: 'app',
    mapping: {
      roles: [AUTH_ADMIN_ROLE],
      inverse: false,
      claimValue: 1,
      customEncodeDecode: false
    },
    tags: ['privileged', 'staff']
  }
];

const DEMO_APP: AuthAppInfo = {
  app: 'demo-api',
  claimsInterfaceName: 'DemoApiAuthClaims',
  serviceConstName: 'DEMO_AUTH_CLAIMS_SERVICE',
  sourcePath: DEMO_CLAIMS_PATH,
  claimKeys: ['o', 'a', 'fr'],
  scopes: [...CALL_MODEL_OIDC_SCOPES],
  description: 'Demo Firebase API. Inherits the `fr` storage-upload claim and adds the onboarded (`o`) and admin (`a`) flags.'
};

/**
 * Workspace-level claim catalog (currently just the demo). Apps that live
 * outside this workspace contribute their own entries through the
 * downstream loader.
 */
export const WORKSPACE_AUTH_CLAIMS: readonly AuthClaimInfo[] = [...DEMO_CLAIMS];

/**
 * Workspace-level app catalog (currently just demo-api).
 */
export const WORKSPACE_AUTH_APPS: readonly AuthAppInfo[] = [DEMO_APP];
