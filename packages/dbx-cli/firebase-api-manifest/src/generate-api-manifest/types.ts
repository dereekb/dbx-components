/**
 * Internal types shared between the generator's pipeline stages.
 *
 * The runtime manifest types (`CliApiManifest`, `CliApiManifestEntry`,
 * `CliApiVerb`) live in `packages/dbx-cli/src/lib/manifest/types.ts` and are
 * re-exported from `@dereekb/dbx-cli`. The generator emits TypeScript that
 * imports those runtime types — it does not reference them itself.
 *
 * The `<model>.api.ts` walker types (`CrudEntry`, `CrudExtraction`,
 * `CrudEntryDocField`) live in the sibling `dbx-cli-manifest-extract` Nx
 * project and are exposed at `@dereekb/dbx-cli/manifest-extract`. They are
 * re-exported from this module so the rest of the manifest pipeline can keep
 * importing them by their local name.
 */

import type { CallModelHandlerMapOpaque, CrudEntry, CrudExtraction, CrudVerb, ModelExtraction } from '@dereekb/dbx-cli/manifest-extract';

// eslint-disable-next-line dereekb-util/no-sister-re-export -- intentional facade so the firebase-api-manifest pipeline can keep importing extractor types by their local name
export type { CrudEntry, CrudEntryDocField, CrudExtraction } from '@dereekb/dbx-cli/manifest-extract';

export interface FunctionsGroup {
  readonly groupKey: string;
  readonly className: string;
  readonly importedFromModule: string;
}

export interface PackageRef {
  readonly packageName: string;
  readonly packageRoot: string;
}

export interface ApiFileMatch {
  readonly filePath: string;
  readonly className: string;
  readonly extraction: CrudExtraction;
}

export interface CollectedEntry {
  readonly entry: CrudEntry & { readonly groupName: string; readonly sourceFile: string };
  readonly packageName?: string;
  readonly validatorName?: string;
}

/**
 * Per-source-file model extraction tagged with the package label and
 * workspace-relative source path the orchestrator stamps on every produced
 * manifest entry.
 */
export interface ModelExtractionSource {
  readonly sourcePackage: string;
  readonly sourceFile: string;
  readonly extraction: ModelExtraction;
}

/**
 * The calls an API app's callModel handler map registers, read by `--api-dir`.
 *
 * Entries the map never wires are dropped from the manifest; verbs / models the scan could not read
 * keep every entry (fail open).
 */
export interface RegisteredCalls {
  /**
   * Workspace-relative handler-map path, for log lines.
   */
  readonly handlerMapFile: string;
  /**
   * `mcpManifestKey(model, verb, specifier)` of every registered cell — the key the MCP runtime joins on.
   */
  readonly callKeys: ReadonlySet<string>;
  /**
   * Verbs whose whole model set could not be read.
   */
  readonly opaqueVerbs: ReadonlySet<CrudVerb>;
  /**
   * `<verb>:<model>` pairs whose specifiers could not be read.
   */
  readonly opaqueModelCalls: ReadonlySet<string>;
  readonly opaque: readonly CallModelHandlerMapOpaque[];
  readonly verbsFound: readonly CrudVerb[];
}
