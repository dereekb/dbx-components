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
