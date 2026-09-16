/**
 * Loader for PRE-BUILT model-firebase-index manifests.
 *
 * `buildModelFirebaseIndexManifest` derives a manifest by parsing query-factory
 * bodies with ts-morph, which only works against a scannable source tree. A
 * published `@dereekb/*` tarball ships `.d.ts` only, so a downstream app cannot
 * derive the framework models' indexes that way and is forced to hand-carry them
 * in its own `firestore.indexes.json` — the gap that nearly dropped the `nbn`
 * notification send-sweep composite in a production workspace.
 *
 * This module closes that gap from the other side: it reads the manifests the
 * framework already generates at release time (`generate-manifests.mjs` writes
 * them into `@dereekb/dbx-components-mcp`'s `generated/` directory) so
 * `generate-firestore-indexes` can merge framework entries without any source to
 * scan.
 *
 * Merge policy is intentionally ADDITIVE and unfiltered: every entry a package
 * declares is emitted, whether or not the consuming app wires that collection.
 * The two failure directions are not symmetric — an index for a collection the
 * app never writes to holds no index entries, so it costs nothing, while a
 * MISSING index breaks the query outright. Filtering to "collections this app
 * wires" is also not the cheap text match it looks like: collection ids are
 * framework constants that never appear literally in consumer source, and the
 * wiring is split across the client model service and the separate server-only
 * `firebaseModelServiceFactory` path. Any escape hatch added later should be an
 * opt-OUT list, which fails safe, rather than an opt-in one, which does not.
 *
 * I/O is fully injectable so tests drive every branch without touching disk.
 */

import type { Maybe } from '@dereekb/util';
import { type } from 'arktype';
import { readdir as nodeReadDir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { defaultReadFile, type ScanReadFile } from '../../src/lib/scan-helpers/scan-io.js';
import { ModelFirebaseIndexManifest } from './model-firebase-index-schema.js';

// MARK: Constants
/**
 * Filename suffix every generated model-firebase-index manifest carries. The
 * leading segment is the source package's slug (`dereekb-firebase`), so
 * discovery matches on the suffix alone and picks up any package that starts
 * publishing one without a code change here.
 */
export const MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX = '.model-firebase-index.mcp.generated.json';

/**
 * Package that bundles the generated `@dereekb/*` manifests. The manifests do
 * not ship inside each model-owning package (`@dereekb/firebase` and friends
 * publish no JSON assets); `generate-manifests.mjs` collects them all into this
 * one package's `generated/` directory, which is what actually gets published.
 */
export const BUNDLED_MODEL_FIREBASE_INDEX_MANIFEST_PACKAGE = '@dereekb/dbx-components-mcp';

const BUNDLED_MANIFEST_DIRECTORY_NAME = 'generated';

// MARK: Types
/**
 * Function shape used to list a directory's entry names. Defaults to
 * `node:fs/promises.readdir`.
 */
export type ModelFirebaseIndexManifestReadDir = (absolutePath: string) => Promise<readonly string[]>;

/**
 * Function shape used to locate the bundled manifest directory from the
 * consuming workspace's cwd. Returns `null` when the bundling package is not
 * installed.
 */
export type ModelFirebaseIndexManifestDirectoryResolver = (cwd: string) => Maybe<string>;

/**
 * One successfully loaded manifest plus the absolute path it came from. The
 * path is retained so the CLI can name the offending file in diagnostics.
 */
export interface LoadedModelFirebaseIndexManifest {
  readonly path: string;
  readonly manifest: ModelFirebaseIndexManifest;
}

/**
 * Outcome of one {@link loadModelFirebaseIndexPackageManifests} call.
 */
export type LoadModelFirebaseIndexPackageManifestsOutcome =
  | {
      readonly kind: 'success';
      readonly loaded: readonly LoadedModelFirebaseIndexManifest[];
    }
  | {
      readonly kind: 'unreadable-manifest';
      readonly path: string;
      readonly error: string;
    }
  | {
      readonly kind: 'invalid-manifest';
      readonly path: string;
      readonly error: string;
    }
  | {
      readonly kind: 'no-bundled-package';
      readonly packageName: string;
    };

/**
 * Input to {@link loadModelFirebaseIndexPackageManifests}.
 */
export interface LoadModelFirebaseIndexPackageManifestsInput {
  /**
   * Working directory explicit `manifestPaths` resolve against, and the origin
   * bundled-package resolution starts from.
   */
  readonly cwd: string;
  /**
   * Explicit manifest paths (cwd-relative or absolute). Loaded in the order
   * given, ahead of any discovered bundled manifests.
   */
  readonly manifestPaths?: readonly string[];
  /**
   * When true, also discover every manifest bundled in the installed
   * {@link BUNDLED_MODEL_FIREBASE_INDEX_MANIFEST_PACKAGE}.
   */
  readonly discoverBundled?: boolean;
  readonly readFile?: ScanReadFile;
  readonly readDir?: ModelFirebaseIndexManifestReadDir;
  readonly resolveBundledDirectory?: ModelFirebaseIndexManifestDirectoryResolver;
}

// MARK: Defaults
/**
 * Resolves the bundled manifest directory by asking Node to resolve the
 * bundling package's `package.json` from the consuming workspace. Going through
 * module resolution (rather than joining `node_modules` by hand) keeps this
 * correct under hoisting and workspace layouts.
 *
 * @param cwd - Working directory the resolution originates from.
 * @returns The absolute `generated/` directory, or null when the package is not installed.
 */
export const defaultBundledManifestDirectoryResolver: ModelFirebaseIndexManifestDirectoryResolver = (cwd) => {
  let result: Maybe<string>;
  try {
    // createRequire needs a FILE origin, not a directory — the trailing segment is never read.
    const requireFromCwd = createRequire(resolve(cwd, 'noop.js'));
    const packageJsonPath = requireFromCwd.resolve(`${BUNDLED_MODEL_FIREBASE_INDEX_MANIFEST_PACKAGE}/package.json`);
    result = resolve(dirname(packageJsonPath), BUNDLED_MANIFEST_DIRECTORY_NAME);
  } catch {
    result = null;
  }
  return result;
};

const defaultReadDir: ModelFirebaseIndexManifestReadDir = (path) => nodeReadDir(path);

// MARK: Entry point
/**
 * Loads and validates pre-built model-firebase-index manifests from explicit
 * paths and/or the installed bundling package. Never throws — every failure
 * path returns a discriminated outcome the CLI renders as a diagnostic.
 *
 * @param input - Cwd, the manifest sources to load, and injectable I/O hooks.
 * @returns The loaded manifests, or the first failure encountered.
 */
export async function loadModelFirebaseIndexPackageManifests(input: LoadModelFirebaseIndexPackageManifestsInput): Promise<LoadModelFirebaseIndexPackageManifestsOutcome> {
  const { cwd, manifestPaths = [], discoverBundled = false, readFile = defaultReadFile, readDir = defaultReadDir, resolveBundledDirectory = defaultBundledManifestDirectoryResolver } = input;

  const paths: string[] = manifestPaths.map((path) => resolve(cwd, path));
  let failure: Maybe<LoadModelFirebaseIndexPackageManifestsOutcome> = null;

  if (discoverBundled) {
    const bundledDirectory = resolveBundledDirectory(cwd);
    if (bundledDirectory == null) {
      failure = { kind: 'no-bundled-package', packageName: BUNDLED_MODEL_FIREBASE_INDEX_MANIFEST_PACKAGE };
    } else {
      paths.push(...(await readBundledManifestPaths(bundledDirectory, readDir)));
    }
  }

  const loaded: LoadedModelFirebaseIndexManifest[] = [];
  for (const path of paths) {
    if (failure != null) {
      break;
    }
    const readResult = await readManifestFile(path, readFile);
    if (readResult.kind === 'ok') {
      loaded.push({ path, manifest: readResult.manifest });
    } else {
      failure = readResult.outcome;
    }
  }

  return failure ?? { kind: 'success', loaded };
}

/**
 * Renders a non-success outcome as a single actionable line, naming both the
 * cause and the fix.
 *
 * @param outcome - The non-success load outcome.
 * @returns A one-line description suitable for stderr.
 */
export function formatModelFirebaseIndexPackageManifestFailure(outcome: Exclude<LoadModelFirebaseIndexPackageManifestsOutcome, { kind: 'success' }>): string {
  let result: string;

  switch (outcome.kind) {
    case 'unreadable-manifest':
      result = `could not read manifest at ${outcome.path} — ${outcome.error}`;
      break;
    case 'invalid-manifest':
      result = `manifest at ${outcome.path} failed validation — ${outcome.error}`;
      break;
    default:
      result = `${outcome.packageName} is not installed, so no bundled index manifests could be discovered. Install it, or pass --manifest <path> explicitly.`;
      break;
  }

  return result;
}

// MARK: Internal
/**
 * Lists the manifest files in the bundled directory, sorted so the merge order
 * is deterministic across machines. A missing or unreadable directory yields no
 * paths rather than an error — the package can legitimately ship without any
 * index manifests.
 *
 * @param directory - Absolute path of the bundled `generated/` directory.
 * @param readDir - Directory lister injected by the caller.
 * @returns Absolute paths of the suffix-matching manifests, sorted by filename.
 */
async function readBundledManifestPaths(directory: string, readDir: ModelFirebaseIndexManifestReadDir): Promise<readonly string[]> {
  let result: readonly string[];
  try {
    const names = await readDir(directory);
    result = names
      .filter((name) => name.endsWith(MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX))
      .toSorted()
      .map((name) => resolve(directory, name));
  } catch {
    result = [];
  }
  return result;
}

type ReadManifestFileResult = { readonly kind: 'ok'; readonly manifest: ModelFirebaseIndexManifest } | { readonly kind: 'fail'; readonly outcome: Exclude<LoadModelFirebaseIndexPackageManifestsOutcome, { kind: 'success' }> };

/**
 * Reads one manifest file, parses it as JSON, and validates it against
 * {@link ModelFirebaseIndexManifest}.
 *
 * @param path - Absolute path of the manifest to read.
 * @param readFile - File reader injected by the caller.
 * @returns Either the validated manifest or a forwardable failure outcome.
 */
async function readManifestFile(path: string, readFile: ScanReadFile): Promise<ReadManifestFileResult> {
  let raw: Maybe<string> = null;
  let readError: Maybe<string> = null;
  try {
    raw = await readFile(path);
  } catch (err) {
    readError = err instanceof Error ? err.message : String(err);
  }

  let result: ReadManifestFileResult;
  if (raw == null) {
    result = { kind: 'fail', outcome: { kind: 'unreadable-manifest', path, error: readError ?? 'unknown error' } };
  } else {
    let parsed: unknown;
    let parseError: Maybe<string> = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }

    if (parseError == null) {
      const validated = ModelFirebaseIndexManifest(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-manifest', path, error: validated.summary } };
      } else {
        result = { kind: 'ok', manifest: validated };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-manifest', path, error: parseError } };
    }
  }

  return result;
}
