/**
 * Stage 1 — collect `@dbxModelFirebaseIndex`-tagged factories from one component.
 *
 * Reuses `buildModelFirebaseIndexManifest` verbatim rather than re-walking the AST, so the runtime
 * catalog and `firestore.indexes.json` can never disagree about what exists or what it takes.
 */

import { buildModelFirebaseIndexManifest, type BuildModelFirebaseIndexManifestOutcome } from '../../firestore-indexes/src/model-firebase-index-build-manifest.js';
import type { CliFirestoreQueryScope } from '../../src/lib/manifest/types.js';
import type { CollectedQueryEntry } from './types.js';

/**
 * Result of collecting one component.
 */
export type FindQueryEntriesResult = { readonly kind: 'success'; readonly entries: readonly CollectedQueryEntry[]; readonly droppedSpecOnly: number } | { readonly kind: 'failure'; readonly message: string };

/**
 * Input for {@link findQueryEntries}.
 */
export interface FindQueryEntriesInput {
  readonly componentRoot: string;
  readonly generator: string;
  /**
   * Injected for tests; defaults to the real builder.
   */
  readonly buildManifest?: typeof buildModelFirebaseIndexManifest;
}

/**
 * Collects the invocable catalog entries declared by one `-firebase` component.
 *
 * `@dbxModelFirebaseIndexSpecFilesOnly` factories are DROPPED: they exist to serve test callers,
 * and a shipped CLI must not offer to invoke them.
 *
 * @param input - The component root and the generator label.
 * @returns The collected entries, or a failure message naming the non-success outcome kind.
 */
export async function findQueryEntries(input: FindQueryEntriesInput): Promise<FindQueryEntriesResult> {
  const { componentRoot, generator, buildManifest = buildModelFirebaseIndexManifest } = input;
  const outcome = await buildManifest({ projectRoot: componentRoot, generator });
  let result: FindQueryEntriesResult;

  if (outcome.kind === 'success') {
    const dispatcherNames = new Set(outcome.dispatcherSummaries.map((x) => x.name));
    const all = outcome.manifest.entries;
    const kept = all.filter((x) => x.specOnly !== true);

    result = {
      kind: 'success',
      droppedSpecOnly: all.length - kept.length,
      entries: kept.map((entry) => ({
        slug: entry.slug,
        name: entry.name,
        module: entry.module,
        subpath: entry.subpath,
        model: entry.model,
        collection: entry.collection,
        isNested: entry.isNested,
        scope: entry.scope as CliFirestoreQueryScope,
        signature: entry.signature,
        params: entry.params.map((p) => ({ name: p.name, type: p.type, optional: p.optional, ...(p.description ? { description: p.description } : {}) })),
        ...(entry.description ? { description: entry.description } : {}),
        ...(entry.category ? { category: entry.category } : {}),
        ...(entry.tags.length > 0 ? { tags: entry.tags } : {}),
        ...(entry.example ? { example: entry.example } : {}),
        ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: entry.relatedSlugs } : {}),
        ...(entry.manual ? { manual: true } : {}),
        ...(entry.skip ? { skip: true } : {}),
        ...(entry.excluded ? { excluded: true } : {}),
        ...(dispatcherNames.has(entry.name) ? { dispatcher: true } : {})
      }))
    };
  } else {
    result = { kind: 'failure', message: describeFailure(componentRoot, outcome) };
  }

  return result;
}

/**
 * Renders each non-`success` outcome kind as its own actionable message, rather than collapsing
 * them into one "scan failed".
 *
 * @param componentRoot - The component root that was scanned.
 * @param outcome - The non-success build outcome.
 * @returns A single-line message naming the cause and the fix.
 */
function describeFailure(componentRoot: string, outcome: Exclude<BuildModelFirebaseIndexManifestOutcome, { kind: 'success' }>): string {
  let result: string;

  switch (outcome.kind) {
    case 'no-config':
      result = `${componentRoot}: no dbx-mcp.scan.json at ${outcome.configPath}. Add one with a \`modelFirebaseIndex.include\` glob.`;
      break;
    case 'invalid-scan-config':
      result = `${componentRoot}: dbx-mcp.scan.json at ${outcome.configPath} is invalid — ${outcome.error}`;
      break;
    case 'no-package':
      result = `${componentRoot}: no package.json at ${outcome.packagePath}; the entry \`module\` cannot be derived.`;
      break;
    case 'invalid-package':
      result = `${componentRoot}: package.json at ${outcome.packagePath} is invalid — ${outcome.error}`;
      break;
    default:
      result = `${componentRoot}: the extracted manifest failed validation — ${outcome.error}`;
      break;
  }

  return result;
}
