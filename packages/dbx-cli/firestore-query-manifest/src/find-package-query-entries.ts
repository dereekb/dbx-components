/**
 * Stage 1b — collect the query factories the installed `@dereekb/*` packages declare.
 *
 * A published tarball ships `.d.ts` only, so a downstream app cannot scan the framework's
 * `@dbxModelFirebaseIndex` factories (`notificationsNewestFirstQuery`, …) the way it scans its own
 * component. The framework already generates their manifests at release time and bundles them in
 * `@dereekb/dbx-components-mcp` — the same source `generate-firestore-indexes --packages` merges — so
 * this stage reads those instead, and the catalog and the deployed indexes agree on the framework
 * queries exactly as they do on the app's own.
 */

import { formatModelFirebaseIndexPackageManifestFailure, loadModelFirebaseIndexPackageManifests } from '../../firestore-indexes/src/model-firebase-index-package-manifests.js';
import { collectQueryEntries } from './find-query-entries.js';
import type { CollectedQueryEntry } from './types.js';

/**
 * Result of {@link findPackageQueryEntries}.
 */
export type FindPackageQueryEntriesResult =
  | {
      readonly kind: 'success';
      readonly entries: readonly CollectedQueryEntry[];
      readonly droppedSpecOnly: number;
      /**
       * Absolute paths of the manifests the entries were read from.
       */
      readonly manifestPaths: readonly string[];
    }
  | { readonly kind: 'failure'; readonly message: string };

/**
 * Input for {@link findPackageQueryEntries}.
 */
export interface FindPackageQueryEntriesInput {
  /**
   * Working directory the bundled package is resolved from — the consuming workspace root.
   */
  readonly cwd: string;
  /**
   * Injected for tests; defaults to the real loader.
   */
  readonly loadManifests?: typeof loadModelFirebaseIndexPackageManifests;
}

/**
 * Collects the catalog entries from every model-firebase-index manifest bundled in the installed
 * `@dereekb/dbx-components-mcp`.
 *
 * @param input - The workspace cwd and an optional loader override.
 * @returns The collected entries, or a failure message naming the cause and the fix.
 */
export async function findPackageQueryEntries(input: FindPackageQueryEntriesInput): Promise<FindPackageQueryEntriesResult> {
  const { cwd, loadManifests = loadModelFirebaseIndexPackageManifests } = input;
  const outcome = await loadManifests({ cwd, discoverBundled: true });
  let result: FindPackageQueryEntriesResult;

  if (outcome.kind === 'success') {
    const entries: CollectedQueryEntry[] = [];
    let droppedSpecOnly = 0;

    for (const loaded of outcome.loaded) {
      const collected = collectQueryEntries({ entries: loaded.manifest.entries });
      entries.push(...collected.entries);
      droppedSpecOnly += collected.droppedSpecOnly;
    }

    result = { kind: 'success', entries, droppedSpecOnly, manifestPaths: outcome.loaded.map((x) => x.path) };
  } else {
    result = { kind: 'failure', message: `[packages] ${formatModelFirebaseIndexPackageManifestFailure(outcome)}` };
  }

  return result;
}
