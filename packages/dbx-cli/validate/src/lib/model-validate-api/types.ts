/**
 * Shared types for the `dbx_validate_model_api` validator.
 *
 * The validator runs on one or more `<model>.api.ts` source files that
 * declare parameter / result interfaces paired with Arktype validators,
 * followed by a "Functions block" of six exports that wire the CRUD call
 * map for the model group (e.g. `ProfileFunctions`, `profileFunctionMap`).
 *
 * Rule severity tiers:
 * - Hard errors flag structural breakage the caller must fix (missing
 *   Functions-block exports, params without validators, bad casts).
 * - Warnings flag convention deviations: ordering, readonly fields,
 *   `Maybe<T>` without `clearable(...)`, missing `// MARK:` markers,
 *   missing `[Params, Result]` tuple form in the CRUD config.
 */

import type { ModelValidateApiCode } from './codes.js';
import type { RemediationHint } from '../rule-catalog/types.js';

/**
 * String-literal union derived from {@link ModelValidateApiCode}.
 */
export type ViolationCode = `${ModelValidateApiCode}`;

/**
 * Error codes are hard failures the caller is expected to fix. Warning
 * codes flag convention deviations — validation is still considered a
 * pass.
 */
export type { ViolationSeverity } from '../validate-format.js';

export interface Violation {
  readonly code: ViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly file: string;
  readonly line: number | undefined;
  readonly group: string | undefined;
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
}

export interface ValidationResult {
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly filesChecked: number;
  readonly apisChecked: number;
}

/**
 * One file's raw contents passed into the validator. Callers reading
 * paths or globs off disk resolve them to this shape before calling into
 * the core.
 */
export interface ValidatorSource {
  readonly name: string;
  readonly text: string;
}

/**
 * Canonical order of the Functions block declarations at the bottom of a
 * model-api file. Consulted by the order-check rule.
 */
export const FUNCTIONS_BLOCK_ORDER = ['functionTypeMap', 'functionTypeConfigMap', 'crudConfigType', 'crudConfigConst', 'functionMap', 'functionsClass'] as const;

export type FunctionsBlockKind = (typeof FUNCTIONS_BLOCK_ORDER)[number];

/**
 * File basenames that use the `.api.ts` convention but are not CRUD
 * model-apis. The validator emits a {@link NON_CRUD_API_FILENAME}
 * warning and short-circuits structural checks.
 */
export const NON_CRUD_API_BASENAMES: readonly string[] = ['development.api.ts'];

export interface ExtractedFile {
  readonly name: string;
  readonly factoryCallSeen: boolean;
  readonly groupName: string | undefined;
  readonly functionTypeMap: ExtractedTypeAlias | undefined;
  readonly functionTypeConfigMap: ExtractedVariable | undefined;
  readonly crudConfigType: ExtractedCrudConfigType | undefined;
  readonly crudConfigConst: ExtractedCrudConfigConst | undefined;
  readonly functionMap: ExtractedFunctionMap | undefined;
  readonly functionsClass: ExtractedFunctionsClass | undefined;
  readonly paramsDecls: readonly ExtractedParamsDecl[];
  readonly paramsValidators: readonly ExtractedParamsValidator[];
  readonly resultDecls: readonly ExtractedResultDecl[];
  readonly firstFunctionsBlockLine: number | undefined;
  readonly markComments: readonly MarkComment[];
  readonly firstParamsOrResultLine: number | undefined;
  /**
   * Line of the last `*Params` or `*Result` declaration that falls before the Functions block.
   */
  readonly lastParamsOrResultBeforeFunctionsLine: number | undefined;
}

export interface MarkComment {
  /**
   * The text after `// MARK:` trimmed (e.g. `Functions`, `Keys`, `Constants`).
   */
  readonly label: string;
  readonly line: number;
}

export interface ExtractedTypeAlias {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
}

export interface ExtractedVariable {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /**
   * Raw text of the declaration's type annotation (the text after `:`), if any.
   */
  readonly typeAnnotation: string | undefined;
}

export interface ExtractedCrudConfigType extends ExtractedTypeAlias {
  /**
   * Top-level keys declared in the type (e.g. `profile`, `userInvite`).
   */
  readonly keys: readonly string[];
  /**
   * Keys whose value is not `null` (need abstract class members + runtime entries).
   */
  readonly nonNullKeys: readonly string[];
  /**
   * Names of `*Params` interfaces referenced at leaves in bare form (no `[*, *Result]` tuple).
   */
  readonly bareLeafParamsNames: readonly string[];
}

export interface ExtractedCrudConfigConst extends ExtractedVariable {
  /**
   * Top-level keys declared in the runtime object literal initializer.
   */
  readonly runtimeKeys: readonly string[];
}

export interface ExtractedFunctionMap extends ExtractedVariable {
  /**
   * Whether the initializer is a call to `callModelFirebaseFunctionMapFactory(...)`.
   */
  readonly callsFactory: boolean;
  /**
   * Identifier arg names passed to the factory, in order.
   */
  readonly factoryArgs: readonly string[];
}

export interface ExtractedFunctionsClass {
  readonly name: string;
  readonly exported: boolean;
  readonly isAbstract: boolean;
  readonly line: number;
  /**
   * Raw text of the first `implements` clause (including generics), or `undefined`.
   */
  readonly implementsText: string | undefined;
  /**
   * Property names declared on the class (abstract or otherwise).
   */
  readonly memberNames: readonly string[];
}

export interface ExtractedParamsDecl {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /**
   * Whether this was declared as `interface` (true) or `type` alias (false).
   */
  readonly isInterface: boolean;
  readonly fields: readonly ExtractedField[];
}

export interface ExtractedResultDecl {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  readonly isInterface: boolean;
  readonly fields: readonly ExtractedField[];
}

export interface ExtractedParamsValidator {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /**
   * Target type inside `as Type<...>` / `as unknown as Type<...>`, if present.
   */
  readonly castTargetName: string | undefined;
  /**
   * Top-level properties from the arktype object literal (`type({...})` or `base.merge({...})`).
   */
  readonly properties: readonly ExtractedValidatorProperty[];
}

/**
 * One property from the arktype object literal backing a `*ParamsType`.
 * Arktype uses `'foo?'` for optional keys; {@link name} is the stripped
 * property name (no trailing `?` and no quotes), {@link optional} flags
 * whether `?` was present.
 */
export interface ExtractedValidatorProperty {
  readonly name: string;
  readonly optional: boolean;
  /**
   * `true` if the property value is a call to `clearable(...)`.
   */
  readonly hasClearable: boolean;
  readonly line: number;
}

export interface ExtractedField {
  readonly name: string;
  readonly readonly: boolean;
  readonly line: number;
  /**
   * Raw type-annotation text. Used to detect `Maybe<...>` wrappers.
   */
  readonly typeText: string;
  readonly hasMaybeType: boolean;
}
