/**
 * The `dbx.setup.json` project manifest — read by the per-integration scripts
 * and by per-module `setup` commands so a single module can be (re)run without
 * re-entering naming. Shape ported from `setup-project.sh:998-1029`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Maybe } from '@dereekb/util';
import { type SetupNaming, type SetupNamingInputs } from './naming.js';
import { type SetupCoreVersions } from './versions.js';

/**
 * A record of one installed add-on (written by `setup addon <name>`).
 */
export interface DbxSetupManifestAddon {
  readonly id: string;
  /**
   * ISO-8601 timestamp of when the add-on was installed.
   */
  readonly installedAt: string;
}

/**
 * The `dbx.setup.json` manifest shape.
 */
export interface DbxSetupManifest {
  readonly schema: number;
  readonly createdAt: string;
  readonly sourceBranch: string;
  readonly projectName: string;
  /**
   * The raw camelCase code prefix as originally supplied.
   */
  readonly appCodePrefix: string;
  readonly firebase: {
    readonly projectId: string;
    readonly stagingProjectId: string;
  };
  readonly apps: {
    readonly angular: string;
    readonly api: string;
    readonly e2e: string;
  };
  readonly components: {
    readonly angular: string;
    readonly firebase: string;
  };
  readonly ports: {
    readonly firebaseEmulatorBase: number;
    readonly angularApp: number;
  };
  readonly versions: {
    readonly dbxComponents: string;
    readonly nx: string;
    readonly angular: string;
    readonly node: string;
  };
  /**
   * Add-ons installed into this project (additive; absent on schema-1 projects
   * created before add-on support).
   */
  readonly addons?: readonly DbxSetupManifestAddon[];
}

/**
 * The manifest schema version this CLI writes.
 */
export const DBX_SETUP_MANIFEST_SCHEMA = 1;

/**
 * The manifest filename at the project root.
 */
export const DBX_SETUP_MANIFEST_FILENAME = 'dbx.setup.json';

/**
 * Inputs for {@link buildSetupManifest}.
 */
export interface BuildSetupManifestInput {
  readonly naming: SetupNaming;
  readonly versions: SetupCoreVersions;
  readonly sourceBranch: string;
  /**
   * ISO-8601 timestamp; supplied by the caller for determinism/testability.
   */
  readonly createdAt: string;
}

/**
 * Builds the manifest object from derived naming + versions. Pure.
 *
 * @param input - Naming, versions, source branch, and creation timestamp.
 * @returns The manifest record in canonical key order.
 */
export function buildSetupManifest(input: BuildSetupManifestInput): DbxSetupManifest {
  const { naming, versions, sourceBranch, createdAt } = input;
  return {
    schema: DBX_SETUP_MANIFEST_SCHEMA,
    createdAt,
    sourceBranch,
    projectName: naming.projectName,
    appCodePrefix: naming.codePrefix,
    firebase: {
      projectId: naming.firebaseProjectId,
      stagingProjectId: naming.stagingProjectId
    },
    apps: {
      angular: naming.angularAppName,
      api: naming.apiAppName,
      e2e: naming.e2eAppName
    },
    components: {
      angular: naming.angularComponentsName,
      firebase: naming.firebaseComponentsName
    },
    ports: {
      firebaseEmulatorBase: naming.emulatorBasePort,
      angularApp: naming.angularAppPort
    },
    versions: {
      dbxComponents: versions.dbxComponents,
      nx: versions.nx,
      angular: versions.angular,
      node: versions.node
    }
  };
}

/**
 * Reconstructs the {@link SetupNamingInputs} a manifest was derived from, so a
 * standalone module command can re-derive the full naming object.
 *
 * @param manifest - A parsed manifest.
 * @returns The naming inputs.
 */
export function setupNamingInputsFromManifest(manifest: DbxSetupManifest): SetupNamingInputs {
  return {
    firebaseProjectId: manifest.firebase.projectId,
    projectName: manifest.projectName,
    codePrefix: manifest.appCodePrefix,
    emulatorBasePort: manifest.ports.firebaseEmulatorBase,
    stagingProjectId: manifest.firebase.stagingProjectId
  };
}

/**
 * Serializes a manifest to its `dbx.setup.json` text form (2-space JSON +
 * trailing newline).
 *
 * @param manifest - The manifest to serialize.
 * @returns The file text.
 */
export function serializeSetupManifest(manifest: DbxSetupManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Reads + parses `dbx.setup.json` from a project directory.
 *
 * @param dir - Absolute project root directory.
 * @returns The parsed manifest, or `undefined` when absent.
 */
export function readManifest(dir: string): Maybe<DbxSetupManifest> {
  const path = join(dir, DBX_SETUP_MANIFEST_FILENAME);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as DbxSetupManifest) : undefined;
}

/**
 * Writes `dbx.setup.json` into a project directory.
 *
 * @param dir - Absolute project root directory.
 * @param manifest - The manifest to write.
 * @param options - When `dryRun` is set, computes the path without writing.
 * @returns The absolute path written (or that would be written).
 */
export function writeManifest(dir: string, manifest: DbxSetupManifest, options?: Maybe<{ readonly dryRun?: Maybe<boolean> }>): string {
  const path = join(dir, DBX_SETUP_MANIFEST_FILENAME);
  if (!options?.dryRun) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, serializeSetupManifest(manifest));
  }
  return path;
}

// MARK: Field access + validation
/**
 * Reads a dotted manifest field (e.g. `firebase.stagingProjectId`).
 *
 * @param manifest - A parsed manifest.
 * @param dottedPath - A dot-separated field path.
 * @returns The resolved value, or `undefined` when any path segment is absent.
 */
export function getManifestField(manifest: DbxSetupManifest, dottedPath: string): unknown {
  let cursor: unknown = manifest;
  for (const segment of dottedPath.split('.')) {
    cursor = cursor != null && typeof cursor === 'object' ? (cursor as Record<string, unknown>)[segment] : undefined;
  }
  return cursor;
}

/**
 * Whether a resolved manifest value counts as present (not `undefined`/`null`/empty string).
 *
 * @param value - A resolved field value.
 * @returns `true` when the value is usable.
 */
function manifestFieldPresent(value: unknown): boolean {
  return value != null && value !== '';
}

/**
 * Reports which of the required dotted fields are missing from a manifest.
 *
 * @param manifest - A parsed manifest.
 * @param requiredKeys - Dotted field paths the caller needs.
 * @returns The missing field paths, in the order supplied.
 */
export function requireManifestFields(manifest: DbxSetupManifest, requiredKeys: readonly string[]): { readonly missing: readonly string[] } {
  return { missing: requiredKeys.filter((key) => !manifestFieldPresent(getManifestField(manifest, key))) };
}

/**
 * Throws when any required field is missing, naming each one. The message is
 * prefixed with `label` so the failing command is clear.
 *
 * @param manifest - A parsed manifest.
 * @param requiredKeys - Dotted field paths the caller needs.
 * @param label - Command label used in the error message (e.g. `setup addon oidc`).
 * @throws {Error} When at least one required field is missing.
 */
export function assertManifestFields(manifest: DbxSetupManifest, requiredKeys: readonly string[], label: string): void {
  const { missing } = requireManifestFields(manifest, requiredKeys);
  if (missing.length > 0) {
    throw new Error(`${label}: ${DBX_SETUP_MANIFEST_FILENAME} is missing required field(s): ${missing.join(', ')}. Re-run from a CLI-scaffolded project or add these fields.`);
  }
}

// MARK: Add-on registry
/**
 * Whether an add-on is recorded as installed in the manifest.
 *
 * @param manifest - A parsed manifest.
 * @param id - The add-on id.
 * @returns `true` when the add-on appears in `manifest.addons`.
 */
export function manifestHasAddon(manifest: DbxSetupManifest, id: string): boolean {
  return (manifest.addons ?? []).some((addon) => addon.id === id);
}

/**
 * Returns a manifest with the add-on recorded as installed. Pure; a no-op when
 * the add-on is already recorded (keeps the original `installedAt`).
 *
 * @param manifest - A parsed manifest.
 * @param id - The add-on id.
 * @param installedAt - ISO-8601 install timestamp.
 * @returns The updated manifest.
 */
export function withInstalledAddon(manifest: DbxSetupManifest, id: string, installedAt: string): DbxSetupManifest {
  let result: DbxSetupManifest;
  if (manifestHasAddon(manifest, id)) {
    result = manifest;
  } else {
    result = { ...manifest, addons: [...(manifest.addons ?? []), { id, installedAt }] };
  }
  return result;
}
