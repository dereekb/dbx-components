/**
 * Resolves a {@link SetupContext} from CLI inputs: naming comes from explicit
 * flags layered over an existing `dbx.setup.json` (so a single module can be
 * re-run without re-entering naming), with the script defaults filling the rest.
 */

import { resolve } from 'node:path';
import { type Maybe } from '@dereekb/util';
import { deriveSetupNaming, type SetupNamingInputs } from './naming.js';
import { buildSetupTokenTable } from './tokens.js';
import { resolveSetupVersions } from './versions.js';
import { openTemplateArchive } from './archive.js';
import { createShellRunner } from './shell.js';
import { readManifest, setupNamingInputsFromManifest } from './manifest.js';
import { type SetupContext } from './module.js';

const DEFAULT_SOURCE_BRANCH = 'develop';

/**
 * CLI-supplied inputs used to resolve a setup context.
 */
export interface ResolveSetupContextInput {
  /**
   * Project root directory (default: cwd).
   */
  readonly dir?: Maybe<string>;
  readonly firebaseProjectId?: Maybe<string>;
  readonly projectName?: Maybe<string>;
  readonly codePrefix?: Maybe<string>;
  readonly emulatorPort?: Maybe<number>;
  readonly stagingProjectId?: Maybe<string>;
  readonly branch?: Maybe<string>;
  readonly componentsVersion?: Maybe<string>;
  readonly ciTest?: Maybe<boolean>;
  readonly dryRun?: Maybe<boolean>;
  /**
   * Logger for shell + progress output (default: console.error).
   */
  readonly log?: Maybe<(message: string) => void>;
  /**
   * Override for the manifest `createdAt` timestamp (testability).
   */
  readonly now?: Maybe<string>;
}

/**
 * Resolves the full setup context, merging an existing manifest with explicit
 * inputs. Throws when no firebase project id can be determined.
 *
 * @param input - CLI inputs.
 * @returns The resolved setup context.
 * @throws {Error} When no firebase project id is provided and no `dbx.setup.json` is found.
 */
export function resolveSetupContext(input: ResolveSetupContextInput): SetupContext {
  const workspaceRoot = resolve(process.cwd(), input.dir ?? '.');
  const manifest = readManifest(workspaceRoot);
  const base: SetupNamingInputs = manifest ? setupNamingInputsFromManifest(manifest) : { firebaseProjectId: '' };

  const firebaseProjectId = input.firebaseProjectId ?? (base.firebaseProjectId || undefined);
  if (!firebaseProjectId) {
    throw new Error('No firebase project id: pass it as an argument or run inside a project containing dbx.setup.json.');
  }

  const inputs: SetupNamingInputs = {
    firebaseProjectId,
    projectName: input.projectName ?? base.projectName,
    codePrefix: input.codePrefix ?? base.codePrefix,
    emulatorBasePort: input.emulatorPort ?? base.emulatorBasePort,
    stagingProjectId: input.stagingProjectId ?? base.stagingProjectId
  };
  const naming = deriveSetupNaming(inputs);

  let coreOverride: { readonly dbxComponents: string } | undefined;
  if (input.componentsVersion) {
    coreOverride = { dbxComponents: input.componentsVersion };
  } else if (manifest) {
    coreOverride = { dbxComponents: manifest.versions.dbxComponents };
  }
  const versions = resolveSetupVersions({ core: coreOverride, isCiTest: input.ciTest });
  const sourceBranch = input.branch ?? manifest?.sourceBranch ?? DEFAULT_SOURCE_BRANCH;
  const createdAt = manifest?.createdAt ?? input.now ?? new Date().toISOString();
  const log = input.log ?? ((message: string) => console.error(message));

  return {
    workspaceRoot,
    archive: openTemplateArchive(),
    naming,
    tokens: buildSetupTokenTable(naming),
    versions,
    sourceBranch,
    createdAt,
    dryRun: Boolean(input.dryRun),
    shell: createShellRunner(log),
    log
  };
}
