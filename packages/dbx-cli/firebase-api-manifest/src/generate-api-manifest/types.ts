/**
 * Internal types shared between the generator's pipeline stages.
 *
 * The runtime manifest types (`CliApiManifest`, `CliApiManifestEntry`,
 * `CliApiVerb`) live in `packages/dbx-cli/src/lib/manifest/types.ts` and are
 * re-exported from `@dereekb/dbx-cli`. The generator emits TypeScript that
 * imports those runtime types — it does not reference them itself.
 */

export interface FunctionsGroup {
  readonly groupKey: string;
  readonly className: string;
  readonly importedFromModule: string;
}

export interface PackageRef {
  readonly packageName: string;
  readonly packageRoot: string;
}

export interface CrudEntry {
  readonly model: string;
  readonly verb: string;
  readonly specifier?: string;
  readonly paramsTypeName?: string;
  readonly resultTypeName?: string;
  readonly line: number;
}

export interface CrudExtraction {
  readonly groupName: string | undefined;
  readonly modelKeys: readonly string[];
  readonly entries: readonly CrudEntry[];
  readonly functionsClassName?: string;
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
