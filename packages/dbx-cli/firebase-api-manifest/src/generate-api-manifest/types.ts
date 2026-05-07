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

import type { CrudEntry, CrudExtraction } from '@dereekb/dbx-cli/manifest-extract';

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
