/**
 * Shared types for the `dbx_system_m_validate_folder` validator.
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

import type { FolderGroupedResult, FolderGroupedViolation } from '../validate-format.js';
import type { SystemMValidateFolderCode } from './codes.js';

export type { FolderInspectionStatus, ViolationSeverity } from '../validate-format.js';

/**
 * String-literal union derived from {@link SystemMValidateFolderCode}.
 */
export type ViolationCode = `${SystemMValidateFolderCode}`;

export type Violation = FolderGroupedViolation<ViolationCode>;

export type ValidationResult = FolderGroupedResult<Violation>;

/**
 * One folder inspection result passed into the pure rules core. Specs
 * build fixtures directly without touching the disk; the tool wrapper
 * populates {@link files} and {@link systemSource} via `node:fs/promises`.
 */
export interface SystemFolderInspection {
  /**
   * Display name for the folder (typically the last path segment).
   */
  readonly name: string;
  /**
   * Original path as provided by the caller (used in violation messages).
   */
  readonly path: string;
  readonly status: FolderInspectionStatus;
  /**
   * `.ts` file basenames at the folder root (ignored when `status !== 'ok'`).
   */
  readonly files: readonly string[];
  /**
   * Contents of `system.ts` when present. `undefined` when the file is
   * missing or unreadable — content rules are skipped in that case since
   * the missing-file error already surfaces.
   */
  readonly systemSource: string | undefined;
}

/**
 * A `<NAME>_SYSTEM_STATE_TYPE` constant declared in `system.ts`.
 */
export interface ExtractedTypeConstant {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /**
   * Lowercase, underscore-stripped prefix (suffix `_SYSTEM_STATE_TYPE` removed). Used to pair with interfaces.
   */
  readonly normalizedRoot: string;
}

/**
 * An interface `<Foo>SystemData extends SystemStateStoredData`.
 */
export interface ExtractedSystemDataInterface {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /**
   * Lowercase, underscore-stripped form of the `<Foo>` stem (suffix `SystemData` removed).
   */
  readonly normalizedRoot: string;
}

/**
 * An `export const <foo>: SystemStateStoredDataFieldConverterConfig<X> = ...` constant.
 */
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

/**
 * A key referenced inside the aggregate converter map.
 */
export interface ExtractedConverterMapKey {
  readonly raw: string;
  readonly kind: 'identifier' | 'string';
  readonly line: number;
}

/**
 * The `<app>SystemStateStoredDataConverterMap` aggregator constant.
 */
export interface ExtractedConverterMap {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  readonly typeAnnotation: string | undefined;
  readonly keys: readonly ExtractedConverterMapKey[];
}

/**
 * Aggregated AST extraction result for a single `system.ts` file.
 */
export interface ExtractedSystemFile {
  readonly typeConstants: readonly ExtractedTypeConstant[];
  readonly dataInterfaces: readonly ExtractedSystemDataInterface[];
  readonly converters: readonly ExtractedConverter[];
  readonly converterMap: ExtractedConverterMap | undefined;
  /**
   * Identifier names imported into the file (used to accept cross-package map keys).
   */
  readonly importedIdentifiers: ReadonlySet<string>;
  /**
   * Line number of the last top-level export (used to flag converter-map ordering).
   */
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
