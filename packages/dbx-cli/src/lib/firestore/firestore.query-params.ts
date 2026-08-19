import { type CliFirestoreQueryManifestEntry, type CliFirestoreQueryParam } from '../manifest/types';
import { CliError } from '../util/output';

/**
 * Strict ISO-8601 datetime WITH a time component and a zone.
 *
 * Deliberately narrow. `firestoreDate` persists an ISO8601 STRING, so a params field legitimately
 * holding a persisted date string is real and common — over-eager coercion would silently break
 * `where(field, '==', isoString)` by turning the operand into a `Date`. A bare `YYYY-MM-DD` is left
 * alone for the same reason.
 */
const STRICT_ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:\d{2})$/;

/**
 * Matches a `Date` mention anywhere in a parameter's source type text — `Date`, `Maybe<Date>`,
 * `Date | undefined`, `Date = new Date()`.
 */
const DATE_TYPE_TEXT = /\bDate\b/;

/**
 * Input for {@link resolveCliFirestoreQueryArgs}.
 */
export interface ResolveCliFirestoreQueryArgsInput {
  readonly entry: CliFirestoreQueryManifestEntry;
  /**
   * The raw `--params` string, if supplied.
   */
  readonly params?: string;
  /**
   * When true, no date coercion is applied at any level.
   */
  readonly rawParams?: boolean;
}

/**
 * Resolves the positional argument list to call a catalog entry's factory with.
 *
 * The contract is POSITIONAL-first, because the single-params-object convention is not universal:
 * the workspace's `*.query.ts` files include zero-arg, single-scalar, two-positional,
 * defaulted-positional, `Maybe<Date>` and `ArrayOrValue<T>` shapes.
 *
 * 1. **omitted** → call with no args; valid only when every param is optional.
 * 2. **JSON array** → spread positionally. Works for every shape.
 * 3. **JSON object** → when the factory takes exactly one param and the key set is not exactly that
 *    param's name, the whole object is passed as arg 0 (the single-params-object ergonomic path).
 *    Otherwise keys are mapped by param name into positional order.
 * 4. **unparseable** → a `CliError` quoting the parse error and the received string.
 *
 * @param input - The catalog entry and the raw `--params` string.
 * @returns The positional arguments to spread into the factory.
 * @throws {CliError} On any arity, naming, JSON, or date-coercion failure.
 */
export function resolveCliFirestoreQueryArgs(input: ResolveCliFirestoreQueryArgsInput): unknown[] {
  const { entry, params, rawParams = false } = input;
  const trimmed = params?.trim();
  let result: unknown[];

  if (trimmed == null || trimmed.length === 0) {
    result = resolveOmittedArgs(entry);
  } else {
    const parsed = parseParamsJson(entry, trimmed);

    if (Array.isArray(parsed)) {
      result = resolveArrayArgs(entry, parsed);
    } else if (parsed != null && typeof parsed === 'object') {
      result = resolveObjectArgs(entry, parsed as Record<string, unknown>);
    } else {
      // a bare scalar is the natural spelling of a one-positional factory
      result = resolveArrayArgs(entry, [parsed]);
    }
  }

  return rawParams ? result : result.map((value, index) => coerceArg(entry, entry.params[index], value));
}

function requiredParamCount(entry: CliFirestoreQueryManifestEntry): number {
  return entry.params.filter((p) => !p.optional).length;
}

function resolveOmittedArgs(entry: CliFirestoreQueryManifestEntry): unknown[] {
  if (requiredParamCount(entry) > 0) {
    throw new CliError({
      message: `Query "${entry.slug}" requires parameters.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Signature: ${entry.signature}. Pass --params with a JSON object or array.`
    });
  }

  return [];
}

function parseParamsJson(entry: CliFirestoreQueryManifestEntry, text: string): unknown {
  let result: unknown;

  try {
    result = JSON.parse(text);
  } catch (e) {
    throw new CliError({
      message: `Query "${entry.slug}": --params is not valid JSON (${e instanceof Error ? e.message : String(e)}). Received: ${truncateForError(text)}`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Signature: ${entry.signature}. Shell quoting is the usual culprit — wrap the JSON in single quotes.`
    });
  }

  return result;
}

function resolveArrayArgs(entry: CliFirestoreQueryManifestEntry, values: readonly unknown[]): unknown[] {
  const required = requiredParamCount(entry);

  if (values.length < required || values.length > entry.params.length) {
    throw new CliError({
      message: `Query "${entry.slug}" takes ${arityText(required, entry.params.length)}, but ${values.length} were supplied.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Signature: ${entry.signature}.`
    });
  }

  return [...values];
}

function resolveObjectArgs(entry: CliFirestoreQueryManifestEntry, value: Record<string, unknown>): unknown[] {
  const names = entry.params.map((p) => p.name);
  const keys = Object.keys(value);
  let result: unknown[];

  // The openrouter ergonomic path: `--params '{"published":true}'` against
  // `fn(params: PublishedGuestbookEntriesQueryParams)` means "this IS the params object", not
  // "bind by parameter name" — unless the object's single key happens to BE the parameter's name.
  if (entry.params.length === 1 && !(keys.length === 1 && keys[0] === names[0])) {
    result = [value];
  } else {
    const unknownKeys = keys.filter((k) => !names.includes(k));

    if (unknownKeys.length > 0) {
      throw new CliError({
        message: `Query "${entry.slug}": unknown parameter(s) ${quoteList(unknownKeys)}.`,
        code: 'INVALID_ARGUMENT',
        suggestion: names.length === 0 ? 'This query takes no parameters.' : `Accepted parameter names: ${names.join(', ')}. Signature: ${entry.signature}.`
      });
    }

    const missing = entry.params.filter((p) => !p.optional && !(p.name in value)).map((p) => p.name);

    if (missing.length > 0) {
      throw new CliError({
        message: `Query "${entry.slug}": missing required parameter(s) ${quoteList(missing)}.`,
        code: 'INVALID_ARGUMENT',
        suggestion: `Accepted parameter names: ${names.join(', ')}. Signature: ${entry.signature}.`
      });
    }

    result = trimTrailingUndefined(entry.params.map((p) => value[p.name]));
  }

  return result;
}

/**
 * Drops trailing `undefined` slots so an omitted optional tail parameter takes its default rather
 * than being explicitly overwritten with `undefined`.
 *
 * @param values - The positional values, some of which may be trailing `undefined`.
 * @returns The values with the trailing `undefined` tail removed.
 */
function trimTrailingUndefined(values: readonly unknown[]): unknown[] {
  const result = [...values];

  while (result.length > 0 && result[result.length - 1] === undefined) {
    result.pop();
  }

  return result;
}

function coerceArg(entry: CliFirestoreQueryManifestEntry, param: CliFirestoreQueryParam | undefined, value: unknown): unknown {
  let result: unknown;

  if (param != null && typeof value === 'string' && DATE_TYPE_TEXT.test(param.type)) {
    // top level: the manifest KNOWS this parameter is date-shaped, so any string is a date
    result = parseDateOrThrow(entry, param.name, value);
  } else if (value != null && typeof value === 'object') {
    // nested: the manifest is blind, so only a strict ISO datetime with a zone is coerced
    result = coerceNested(value);
  } else {
    result = value;
  }

  return result;
}

function coerceNested(value: object): unknown {
  let result: unknown;

  if (Array.isArray(value)) {
    result = value.map((x) => coerceNestedValue(x));
  } else {
    const out: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      out[key] = coerceNestedValue(item);
    }

    result = out;
  }

  return result;
}

function coerceNestedValue(value: unknown): unknown {
  let result: unknown;

  if (typeof value === 'string') {
    result = coerceNestedString(value);
  } else if (value != null && typeof value === 'object') {
    result = coerceNested(value);
  } else {
    result = value;
  }

  return result;
}

function coerceNestedString(value: string): string | Date {
  return STRICT_ISO_DATETIME.test(value) ? new Date(value) : value;
}

function parseDateOrThrow(entry: CliFirestoreQueryManifestEntry, paramName: string, value: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new CliError({
      message: `Query "${entry.slug}": parameter "${paramName}" is date-typed but "${value}" is not a parsable date.`,
      code: 'INVALID_ARGUMENT',
      suggestion: 'Pass an ISO-8601 datetime, e.g. "2026-08-19T12:00:00Z". Use --raw-params to disable date coercion entirely.'
    });
  }

  return parsed;
}

function quoteList(values: readonly string[]): string {
  return values.map((value) => JSON.stringify(value)).join(', ');
}

function arityText(required: number, total: number): string {
  return required === total ? `${total} argument(s)` : `${required}–${total} argument(s)`;
}

function truncateForError(text: string): string {
  return text.length <= 120 ? text : `${text.slice(0, 119)}…`;
}
