/**
 * Shared types for the `dbx_system_model_validate_folder` validator.
 *
 * The validator takes one or more folder paths and asserts that each is a
 * downstream `system/` model folder following the project convention:
 *
 *   - `system.ts` and `index.ts` are required at the folder root.
 *   - `system.action.ts` and `system.api.ts` are optional (the action file
 *     is a historical artifact, and any api file is checked separately by
 *     `dbx_validate_model_api`).
 *   - `system.id.ts` and `system.query.ts` are not allowed: SystemState
 *     identifiers are string keys and documents are fetched by key, not
 *     queried.
 *   - Inside `system.ts`, every `<NAME>_SYSTEM_STATE_TYPE` constant must
 *     be paired with an interface `<Foo>SystemData extends
 *     SystemStateStoredData` and a converter `<foo>SystemDataConverter`
 *     typed `SystemStateStoredDataFieldConverterConfig<<Foo>SystemData>`;
 *     the file must end with the aggregate `<app>SystemStateStoredDataConverterMap`
 *     whose keys reference each declared type constant.
 *
 * Always runs in downstream mode — the base `@dereekb/firebase` system
 * folder ships machinery (`systemStateIdentity`, `SystemStateDocument`,
 * etc.) rather than state-type triples and should not be validated with
 * this tool.
 */

export type ViolationCode =
  // I/O failures (errors)
  | 'SYSTEM_FOLDER_NOT_FOUND'
  | 'SYSTEM_FOLDER_NOT_DIRECTORY'
  // Folder layout (errors)
  | 'SYSTEM_FOLDER_MISSING_MAIN'
  | 'SYSTEM_FOLDER_MISSING_INDEX'
  | 'SYSTEM_FOLDER_DISALLOWED_FILE'
  // Folder layout (warning)
  | 'SYSTEM_FOLDER_STRAY_FILE'
  // Content: aggregator (errors)
  | 'SYSTEM_MISSING_CONVERTER_MAP'
  | 'SYSTEM_TYPE_NOT_IN_MAP'
  // Content: triple pairing (errors)
  | 'SYSTEM_MISSING_CONVERTER'
  | 'SYSTEM_MISSING_TYPE_CONSTANT'
  | 'SYSTEM_ORPHAN_CONVERTER'
  | 'SYSTEM_ORPHAN_TYPE_CONSTANT'
  // Content: warnings
  | 'SYSTEM_CONVERTER_MAP_NOT_LAST'
  | 'SYSTEM_UNKNOWN_MAP_KEY';

export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  readonly code: ViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly folder: string;
  readonly file: string | undefined;
}

export interface ValidationResult {
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly foldersChecked: number;
}

export type FolderInspectionStatus = 'ok' | 'not-found' | 'not-directory';

/**
 * One folder inspection result passed into the pure rules core. Specs
 * build fixtures directly without touching the disk; the tool wrapper
 * populates {@link files} and {@link systemSource} via `node:fs/promises`.
 */
export interface SystemFolderInspection {
  /** Display name for the folder (typically the last path segment). */
  readonly name: string;
  /** Original path as provided by the caller (used in violation messages). */
  readonly path: string;
  readonly status: FolderInspectionStatus;
  /** `.ts` file basenames at the folder root (ignored when `status !== 'ok'`). */
  readonly files: readonly string[];
  /**
   * Contents of `system.ts` when present. `undefined` when the file is
   * missing or unreadable — content rules are skipped in that case since
   * the missing-file error already surfaces.
   */
  readonly systemSource: string | undefined;
}

/** A `<NAME>_SYSTEM_STATE_TYPE` constant declared in `system.ts`. */
export interface ExtractedTypeConstant {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /** Lowercase, underscore-stripped prefix (suffix `_SYSTEM_STATE_TYPE` removed). Used to pair with interfaces. */
  readonly normalizedRoot: string;
}

/** An interface `<Foo>SystemData extends SystemStateStoredData`. */
export interface ExtractedSystemDataInterface {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /** Lowercase, underscore-stripped form of the `<Foo>` stem (suffix `SystemData` removed). */
  readonly normalizedRoot: string;
}

/** An `export const <foo>: SystemStateStoredDataFieldConverterConfig<X> = ...` constant. */
export interface ExtractedConverter {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /**
   * Generic argument name in the `SystemStateStoredDataFieldConverterConfig<X>`
   * annotation. Populated when the annotation references a type name
   * directly; `undefined` for inline literals.
   */
  readonly dataTypeArgument: string | undefined;
}

/** A key referenced inside the aggregate converter map. */
export interface ExtractedConverterMapKey {
  readonly raw: string;
  readonly kind: 'identifier' | 'string';
  readonly line: number;
}

/** The `<app>SystemStateStoredDataConverterMap` aggregator constant. */
export interface ExtractedConverterMap {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  readonly typeAnnotation: string | undefined;
  readonly keys: readonly ExtractedConverterMapKey[];
}

/** Aggregated AST extraction result for a single `system.ts` file. */
export interface ExtractedSystemFile {
  readonly typeConstants: readonly ExtractedTypeConstant[];
  readonly dataInterfaces: readonly ExtractedSystemDataInterface[];
  readonly converters: readonly ExtractedConverter[];
  readonly converterMap: ExtractedConverterMap | undefined;
  /** Identifier names imported into the file (used to accept cross-package map keys). */
  readonly importedIdentifiers: ReadonlySet<string>;
  /** Line number of the last top-level export (used to flag converter-map ordering). */
  readonly lastTopLevelExportLine: number;
}

/**
 * Files disallowed at the `system/` folder root. The validator emits a
 * {@link SYSTEM_FOLDER_DISALLOWED_FILE} error naming the file and the
 * reason.
 */
export interface DisallowedSystemFile {
  readonly filename: string;
  readonly reason: string;
}

export const DISALLOWED_SYSTEM_FILES: readonly DisallowedSystemFile[] = [
  { filename: 'system.id.ts', reason: 'SystemState identifiers are plain string keys — no `id` module is needed.' },
  { filename: 'system.query.ts', reason: 'SystemState documents are fetched by key, not queried — no `query` module is needed.' }
];
