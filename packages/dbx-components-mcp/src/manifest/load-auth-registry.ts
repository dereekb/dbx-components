/**
 * Loader for the auth catalog.
 *
 * Walks the workspace looking for `claims.ts`-style downstream files
 * (those tagged with `@dbxAuthClaimsApp`), parses them via the auth
 * extractor, and merges the extracted entries with the bundled built-ins
 * (`@dereekb/util` roles, the `fr` upload claim from `@dereekb/firebase`,
 * the five `model.*` OIDC scopes from `@dereekb/firebase-server/oidc`).
 *
 * Discovery is intentionally cheap:
 *   - Glob `components/&#42;-{firebase,shared,web,core}/&#42;&#42;/auth/&#42;claims&#42;.ts`
 *   - Glob `apps/&#42;/&#42;&#42;/auth/&#42;claims&#42;.ts`
 *   - Anything else is opt-in via `extraFiles` (used by tests).
 *
 * Files are read with the package's standard reader and pushed into an
 * in-memory ts-morph project. Loader and extractor warnings are returned
 * as structured objects so the server bootstrap can echo them on stderr.
 */

import { glob as fsGlob } from 'node:fs/promises';
import { join, relative, resolve as resolvePath, sep } from 'node:path';
import { Project } from 'ts-morph';
import { createAuthRegistryFromEntries, type AuthAppInfo, type AuthClaimInfo, type AuthRegistry, type AuthRoleInfo, type AuthScopeInfo } from '../registry/auth-runtime.js';
import { BUILTIN_AUTH_CLAIMS, BUILTIN_AUTH_ROLES, BUILTIN_AUTH_SCOPES } from '../registry/auth-builtin.js';
import { extractAuthEntries, type AuthExtractKnownRoles, type AuthExtractWarning, type ExtractAuthEntriesResult, type ExtractedAuthApp, type ExtractedAuthClaim } from '../scan/auth-extract.js';
import { defaultReadFile, type ScanReadFile } from '../scan/scan-io.js';

// MARK: Public types
/**
 * Discriminated union surfacing per-file failures the loader can't recover
 * from. Forwarded to the server bootstrap so operators can spot mis-tagged
 * downstream files at startup.
 */
export type AuthLoaderFileWarning = { readonly kind: 'read-failed'; readonly relPath: string; readonly error: string } | { readonly kind: 'parse-failed'; readonly relPath: string; readonly error: string };

/**
 * Result of {@link loadAuthRegistry}. The registry is always populated —
 * it includes the bundled built-ins plus whatever extracted entries
 * succeeded. Warnings are returned alongside so callers can decide
 * whether to fail loudly or merely log.
 */
export interface LoadAuthRegistryResult {
  readonly registry: AuthRegistry;
  readonly extractWarnings: readonly AuthExtractWarning[];
  readonly fileWarnings: readonly AuthLoaderFileWarning[];
  readonly scannedFiles: readonly string[];
  readonly extractedAppCount: number;
  readonly extractedClaimCount: number;
}

/**
 * Input to {@link loadAuthRegistry}. `extraFiles` is reserved for tests
 * that want to inject in-memory claims modules instead of touching disk.
 */
export interface LoadAuthRegistryInput {
  readonly cwd: string;
  readonly readFile?: ScanReadFile;
  readonly extraFiles?: readonly string[];
}

// MARK: Defaults
const DEFAULT_GLOB_PATTERNS: readonly string[] = ['components/*-firebase/src/**/auth/**/*claims*.ts', 'components/*-shared/src/**/auth/**/*claims*.ts', 'components/*-web/src/**/auth/**/*claims*.ts', 'components/*-core/src/**/auth/**/*claims*.ts', 'apps/*/src/**/auth/**/*claims*.ts'];

const APP_TAG_MARKER = '@dbxAuthClaimsApp';
const SERVICE_TAG_MARKER = '@dbxAuthClaimsService';

// MARK: Entry point
/**
 * Discovers downstream `claims.ts` files, runs the auth extractor, and
 * returns a fully composed {@link AuthRegistry} merged with the package's
 * built-in roles/claims/scopes. Always returns a valid registry — when
 * no downstream files are found, the registry contains only the
 * built-ins.
 *
 * @param input - workspace cwd plus optional injected reader / extra files
 * @returns the merged registry plus loader/extractor diagnostics
 */
export async function loadAuthRegistry(input: LoadAuthRegistryInput): Promise<LoadAuthRegistryResult> {
  const { cwd, readFile = defaultReadFile, extraFiles = [] } = input;

  const discovered = await discoverClaimsFiles(cwd);
  const candidatePaths = mergeAndNormalisePaths(discovered, extraFiles);

  const fileWarnings: AuthLoaderFileWarning[] = [];
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const scannedFiles: string[] = [];

  for (const relPath of candidatePaths) {
    const absolute = resolvePath(cwd, relPath);
    let text: string | undefined;
    try {
      text = await readFile(absolute);
    } catch (error) {
      fileWarnings.push({ kind: 'read-failed', relPath, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (!hasAuthMarker(text)) continue;
    try {
      project.createSourceFile(absolute, text, { overwrite: true });
      scannedFiles.push(relPath);
    } catch (error) {
      fileWarnings.push({ kind: 'parse-failed', relPath, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const knownRoles = buildKnownRolesMap(BUILTIN_AUTH_ROLES);
  const extractResult: ExtractAuthEntriesResult = scannedFiles.length === 0 ? { apps: [], claims: [], warnings: [] } : extractAuthEntries({ project, knownRoles });

  const registry = composeRegistry({
    cwd,
    extractResult,
    scannedRelFiles: scannedFiles,
    builtinRoles: BUILTIN_AUTH_ROLES,
    builtinClaims: BUILTIN_AUTH_CLAIMS,
    builtinScopes: BUILTIN_AUTH_SCOPES
  });

  return {
    registry,
    extractWarnings: extractResult.warnings,
    fileWarnings,
    scannedFiles,
    extractedAppCount: extractResult.apps.length,
    extractedClaimCount: extractResult.claims.length
  };
}

// MARK: Discovery
async function discoverClaimsFiles(cwd: string): Promise<readonly string[]> {
  const found = new Set<string>();
  for (const pattern of DEFAULT_GLOB_PATTERNS) {
    try {
      for await (const match of fsGlob(pattern, { cwd })) {
        found.add(toPosix(match));
      }
    } catch {
      // Glob root missing (e.g. running outside a workspace) — ignore.
    }
  }
  return [...found].sort();
}

function mergeAndNormalisePaths(discovered: readonly string[], extra: readonly string[]): readonly string[] {
  const out = new Set<string>();
  for (const p of discovered) out.add(p);
  for (const p of extra) out.add(toPosix(p));
  return [...out].sort();
}

function toPosix(value: string): string {
  return value.split(sep).join('/');
}

/**
 * Cheap pre-filter: only feed files into ts-morph when they actually
 * contain one of the auth JSDoc markers. Avoids paying parse cost on
 * unrelated `*claims*.ts` files (e.g. `claims.test.ts`, fixture files).
 *
 * @param text - the raw file contents to inspect
 * @returns `true` when the file contains either marker tag
 */
function hasAuthMarker(text: string): boolean {
  return text.includes(APP_TAG_MARKER) || text.includes(SERVICE_TAG_MARKER);
}

// MARK: Known-roles map
function buildKnownRolesMap(roles: readonly AuthRoleInfo[]): AuthExtractKnownRoles {
  const out = new Map<string, string>();
  for (const role of roles) {
    if (role.constName !== undefined) {
      out.set(role.constName, role.role);
    }
  }
  return out;
}

// MARK: Registry composition
interface ComposeRegistryInput {
  readonly cwd: string;
  readonly extractResult: ExtractAuthEntriesResult;
  readonly scannedRelFiles: readonly string[];
  readonly builtinRoles: readonly AuthRoleInfo[];
  readonly builtinClaims: readonly AuthClaimInfo[];
  readonly builtinScopes: readonly AuthScopeInfo[];
}

function composeRegistry(input: ComposeRegistryInput): AuthRegistry {
  const { cwd, extractResult, scannedRelFiles, builtinRoles, builtinClaims, builtinScopes } = input;

  const inheritedClaimsByInterface = indexBuiltinClaimsByInterface(builtinClaims);
  const claims: AuthClaimInfo[] = [...builtinClaims];
  const apps: AuthAppInfo[] = [];

  for (const claim of extractResult.claims) {
    claims.push(toAuthClaimInfo({ extracted: claim, cwd }));
  }

  for (const app of extractResult.apps) {
    apps.push(toAuthAppInfo({ extracted: app, cwd, inheritedClaimsByInterface, allBuiltinScopes: builtinScopes }));
  }

  const loadedSources = ['builtin:@dereekb/util', 'builtin:@dereekb/firebase', 'builtin:@dereekb/firebase-server/oidc', ...scannedRelFiles.map((rel) => `workspace:${rel}`)];

  return createAuthRegistryFromEntries({
    roles: builtinRoles,
    claims,
    scopes: builtinScopes,
    apps,
    loadedSources
  });
}

function indexBuiltinClaimsByInterface(builtinClaims: readonly AuthClaimInfo[]): ReadonlyMap<string, readonly AuthClaimInfo[]> {
  const out = new Map<string, AuthClaimInfo[]>();
  for (const claim of builtinClaims) {
    if (claim.interfaceName === undefined) continue;
    const list = out.get(claim.interfaceName);
    if (list === undefined) out.set(claim.interfaceName, [claim]);
    else list.push(claim);
  }
  return out;
}

interface ToAuthClaimInfoInput {
  readonly extracted: ExtractedAuthClaim;
  readonly cwd: string;
}

function toAuthClaimInfo(input: ToAuthClaimInfoInput): AuthClaimInfo {
  const { extracted, cwd } = input;
  return {
    key: extracted.key,
    type: extracted.type,
    description: extracted.description,
    app: extracted.app,
    interfaceName: extracted.interfaceName,
    sourcePath: toRelative(extracted.filePath, cwd),
    sourceLine: extracted.line,
    source: 'app',
    mapping: extracted.mapping,
    tags: extracted.tags
  };
}

interface ToAuthAppInfoInput {
  readonly extracted: ExtractedAuthApp;
  readonly cwd: string;
  readonly inheritedClaimsByInterface: ReadonlyMap<string, readonly AuthClaimInfo[]>;
  readonly allBuiltinScopes: readonly AuthScopeInfo[];
}

function toAuthAppInfo(input: ToAuthAppInfoInput): AuthAppInfo {
  const { extracted, cwd, inheritedClaimsByInterface, allBuiltinScopes } = input;

  const inheritedKeys: string[] = [];
  for (const interfaceName of extracted.inheritedInterfaceNames) {
    const inherited = inheritedClaimsByInterface.get(interfaceName) ?? [];
    for (const claim of inherited) {
      if (!inheritedKeys.includes(claim.key)) inheritedKeys.push(claim.key);
    }
  }

  const claimKeys: string[] = [];
  for (const key of extracted.ownClaimKeys) {
    if (!claimKeys.includes(key)) claimKeys.push(key);
  }
  for (const key of inheritedKeys) {
    if (!claimKeys.includes(key)) claimKeys.push(key);
  }

  return {
    app: extracted.app,
    claimsInterfaceName: extracted.claimsInterfaceName,
    serviceConstName: extracted.serviceConstName,
    sourcePath: toRelative(extracted.filePath, cwd),
    claimKeys,
    scopes: allBuiltinScopes.map((s) => s.scope)
  };
}

function toRelative(absolutePath: string, cwd: string): string {
  const isAbsolute = absolutePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(absolutePath);
  const target = isAbsolute ? absolutePath : resolvePath(cwd, absolutePath);
  const rel = relative(cwd, target);
  return toPosix(rel.length > 0 ? rel : absolutePath);
}

// MARK: Test-only helpers
/**
 * Resolves the workspace-relative path of the demo claims module without
 * leaking the constant into the public surface of {@link loadAuthRegistry}.
 *
 * @param workspaceRoot - absolute workspace root
 * @returns the absolute path of `components/demo-firebase/src/lib/auth/claims.ts`
 */
export function resolveDemoClaimsPath(workspaceRoot: string): string {
  return resolvePath(workspaceRoot, join('components', 'demo-firebase', 'src', 'lib', 'auth', 'claims.ts'));
}
