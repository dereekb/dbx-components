import { type Maybe } from '@dereekb/util';

// MARK: Modes
/**
 * How the callModel dispatch treats a request whose data fails its handler's `inputType`.
 *
 * - 'enforce' (default): throw a `VALIDATION_ERROR` bad request naming each failing field.
 * - 'log': `console.warn` the failure (call, modelType, specifier and summary, never the data) and run the handler
 *   with the raw data. For rolling validation out to an app whose clients may send data its types don't describe.
 * - 'off': skip the check for `'validate'` handlers.
 *
 * Handlers set to `'parse'` are always enforced, and handlers set to `'off'` are never checked.
 */
export type OnCallModelInputValidationMode = 'enforce' | 'log' | 'off';

/**
 * Default {@link OnCallModelInputValidationMode}.
 */
export const DEFAULT_ON_CALL_MODEL_INPUT_VALIDATION_MODE: OnCallModelInputValidationMode = 'enforce';

/**
 * How the callModel dispatch checks a request's data against a handler's `inputType` before the handler runs.
 *
 * - 'validate' (default): reject invalid data; the handler receives the raw data unchanged.
 * - 'parse': same check; the handler receives the schema's output (morphs applied, defaults filled, `'delete'` keys
 *   removed). Always enforced, whatever the app mode.
 * - 'off': no check, for a handler that validates itself or must accept data its type does not describe.
 */
export type OnCallModelFunctionInputValidation = 'validate' | 'parse' | 'off';

/**
 * Default {@link OnCallModelFunctionInputValidation}.
 */
export const DEFAULT_ON_CALL_MODEL_FUNCTION_INPUT_VALIDATION: OnCallModelFunctionInputValidation = 'validate';

// MARK: Standard Schema
/**
 * A path segment of a {@link OnCallModelInputValidatorIssue}, per Standard Schema v1.
 */
export interface OnCallModelInputValidatorPathSegment {
  readonly key: PropertyKey;
}

/**
 * A single failure reported by an {@link OnCallModelInputValidator}, per Standard Schema v1.
 */
export interface OnCallModelInputValidatorIssue {
  readonly message: string;
  readonly path?: Maybe<ReadonlyArray<PropertyKey | OnCallModelInputValidatorPathSegment>>;
}

/**
 * The result of an {@link OnCallModelInputValidator}, per Standard Schema v1.
 *
 * Success carries `value` and no `issues`. Failure carries `issues`. ArkType's failure result is its `ArkErrors`,
 * which also carries a `summary`.
 */
export interface OnCallModelInputValidatorResult {
  readonly value?: unknown;
  readonly issues?: Maybe<ReadonlyArray<OnCallModelInputValidatorIssue>>;
  readonly summary?: unknown;
}

/**
 * A Standard Schema v1 validator. Every ArkType `Type` implements it.
 *
 * Detected by shape so no Standard Schema dependency is needed.
 */
export interface OnCallModelInputValidator {
  readonly '~standard': {
    readonly validate: (value: unknown) => OnCallModelInputValidatorResult | PromiseLike<OnCallModelInputValidatorResult>;
  };
}

/**
 * Whether the input implements Standard Schema v1 (has a `~standard.validate` function).
 *
 * @param x - The value to check, typically a handler's declared `inputType`.
 * @returns True when the value can validate input.
 */
export function isOnCallModelInputValidator(x: unknown): x is OnCallModelInputValidator {
  const standard = x != null && (typeof x === 'object' || typeof x === 'function') ? (x as Partial<OnCallModelInputValidator>)['~standard'] : undefined;
  return standard != null && typeof standard.validate === 'function';
}

/**
 * Whether the validator result is a thenable, which the synchronous dispatch cannot wait on.
 *
 * @param result - The validator result.
 * @returns True when the result is a thenable.
 */
export function isOnCallModelInputValidatorResultPromise(result: OnCallModelInputValidatorResult | PromiseLike<OnCallModelInputValidatorResult>): result is PromiseLike<OnCallModelInputValidatorResult> {
  return typeof (result as Partial<PromiseLike<unknown>>).then === 'function';
}

/**
 * Builds the one-line-per-field summary for a failed validator result.
 *
 * Uses ArkType's `summary` when present. Any other Standard Schema result is summarized one line per issue, as
 * `<path joined by '.'> <message>`.
 *
 * @param result - The failed validator result.
 * @returns The summary text.
 */
export function onCallModelInputValidatorResultSummary(result: OnCallModelInputValidatorResult): string {
  let summary: string;

  if (typeof result.summary === 'string') {
    summary = result.summary;
  } else {
    summary = (result.issues ?? [])
      .map((issue) => {
        const path = (issue.path ?? []).map((segment) => String(typeof segment === 'object' && segment != null ? segment.key : segment)).join('.');
        return path ? `${path} ${issue.message}` : issue.message;
      })
      .join('\n');
  }

  return summary;
}
