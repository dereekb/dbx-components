import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Maybe } from '@dereekb/util';

export interface CliSuccessOutput<T = unknown> {
  readonly ok: true;
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}

export interface CliErrorOutput {
  readonly ok: false;
  readonly error: string;
  readonly code: string;
  readonly suggestion?: string;
}

export type CliOutput<T = unknown> = CliSuccessOutput<T> | CliErrorOutput;

/**
 * Configuration for response dumping and field filtering.
 *
 * Set via {@link configureOutputOptions} from global CLI flags.
 */
export interface CliOutputOptions {
  readonly dumpDir?: string;
  readonly pick?: string;
  readonly commandPath?: string[];
}

/**
 * Patterns that indicate a string may contain a secret token or credential.
 */
export type CliSecretPattern = RegExp;

/**
 * Default secret-redaction patterns. Covers OAuth bearer tokens, access/refresh tokens, and client secrets.
 *
 * Apps can extend this list via {@link configureCliSecretPatterns} to add provider-specific patterns
 * (e.g. Zoho's `1000.<32-char>` token shape).
 */
export const DEFAULT_CLI_SECRET_PATTERNS: CliSecretPattern[] = [/Bearer\s+\S+/gi, /access_token[=:]\s*\S+/gi, /refresh_token[=:]\s*\S+/gi, /client_secret[=:]\s*\S+/gi, /id_token[=:]\s*\S+/gi];

/**
 * Optional mapper for converting consumer-specific exception types into a {@link CliErrorOutput} envelope.
 *
 * When set via {@link configureCliErrorMapper}, {@link buildErrorOutput} consults the mapper before falling
 * back to the built-in `CliError` / `Error` / unknown branches. Returning `undefined` defers to the defaults.
 */
export type CliErrorMapper = (error: unknown) => Maybe<CliErrorOutput>;

let _outputOptions: CliOutputOptions = {};
let _secretPatterns: CliSecretPattern[] = [...DEFAULT_CLI_SECRET_PATTERNS];
let _errorMapper: Maybe<CliErrorMapper>;

/**
 * Configures output options from parsed CLI arguments.
 *
 * Call from middleware before any command handler runs.
 *
 * @param options - The resolved {@link CliOutputOptions} (dump dir, pick filter, command path).
 */
export function configureOutputOptions(options: CliOutputOptions): void {
  _outputOptions = options;
}

/**
 * Returns the current process-wide {@link CliOutputOptions} previously set via
 * {@link configureOutputOptions}.
 *
 * @returns The active output options (empty object when never configured).
 */
export function getOutputOptions(): CliOutputOptions {
  return _outputOptions;
}

/**
 * Replaces the active secret-redaction pattern list with the given patterns.
 *
 * Use to add provider-specific patterns. Pass `[...DEFAULT_CLI_SECRET_PATTERNS, ...extra]`
 * to keep the defaults.
 *
 * @param patterns - The new pattern list applied by {@link sanitizeString}.
 */
export function configureCliSecretPatterns(patterns: CliSecretPattern[]): void {
  _secretPatterns = patterns;
}

/**
 * Registers a {@link CliErrorMapper} that {@link buildErrorOutput} consults before falling back
 * to the built-in `CliError` / `Error` / unknown handling. Pass `undefined` to clear.
 *
 * Use to plug provider-specific exception types (e.g. Zoho's `ZohoInvalidTokenError`) into the
 * standard error envelope without duplicating the rest of the formatting / secret-redaction pipeline.
 *
 * @param mapper - The mapper to install, or `undefined` to clear any previously registered mapper.
 */
export function configureCliErrorMapper(mapper?: CliErrorMapper): void {
  _errorMapper = mapper;
}

/**
 * Applies the configured secret-redaction patterns to a string, replacing each match with `[REDACTED]`.
 *
 * @param value - The input string (typically an error message) to sanitize.
 * @returns The sanitized string with secret-shaped substrings replaced.
 */
export function sanitizeString(value: string): string {
  let result = value;

  for (const pattern of _secretPatterns) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

/**
 * Returns the current time as a filename-safe ISO-8601 stamp (`:` and `.` replaced with `-`).
 *
 * @returns The formatted timestamp string.
 */
export function dumpTimestamp(): string {
  return new Date().toISOString().replaceAll(/[:.]/g, '-');
}

/**
 * Builds a dump-file absolute path inside the configured `dumpDir`.
 *
 * The filename combines the active command path (joined with `_`), the current
 * {@link dumpTimestamp}, and the optional `suffix`. Returns `undefined` when no `dumpDir` is set.
 *
 * @param extension - File extension to append (`json` for full responses, `ndjson` for streaming dumps).
 * @param suffix - Optional suffix appended to the filename before the extension.
 * @returns The absolute file path, or `undefined` when `dumpDir` is not configured.
 */
export function buildDumpFilePath(extension: 'json' | 'ndjson', suffix?: string): Maybe<string> {
  const { dumpDir, commandPath } = _outputOptions;

  if (!dumpDir) {
    return undefined;
  }

  if (!existsSync(dumpDir)) {
    mkdirSync(dumpDir, { recursive: true });
  }

  const prefix = commandPath?.length ? commandPath.join('_') : 'response';
  const stamp = dumpTimestamp();
  const base = suffix ? `${prefix}_${stamp}_${suffix}` : `${prefix}_${stamp}`;
  return join(dumpDir, `${base}.${extension}`);
}

function dumpResponse<T>(data: T, meta: Record<string, unknown> | undefined): void {
  const filePath = buildDumpFilePath('json');

  if (!filePath) {
    return;
  }

  const content: CliSuccessOutput<T> = { ok: true, data, ...(meta ? { meta } : {}) };
  writeFileSync(filePath, JSON.stringify(content, null, 2));
}

/**
 * Reduces an object (or array of objects) to the named top-level fields.
 *
 * @param data - The value to filter; arrays are mapped element-wise, objects are reduced to the picked keys, primitives pass through unchanged.
 * @param pick - Comma-separated list of field names to keep.
 * @returns The filtered value (typed as the input).
 */
export function pickFields<T>(data: T, pick: string): T {
  const fields = pick.split(',').map((f) => f.trim());

  if (Array.isArray(data)) {
    return data.map((item) => pickFromObject(item, fields)) as T;
  }

  if (data != null && typeof data === 'object') {
    return pickFromObject(data, fields) as T;
  }

  return data;
}

function pickFromObject(obj: unknown, fields: string[]): unknown {
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (field in (obj as Record<string, unknown>)) {
      result[field] = (obj as Record<string, unknown>)[field];
    }
  }

  return result;
}

/**
 * Prints a successful command result as a `{ ok: true, data, meta? }` JSON envelope on stdout.
 *
 * Also writes a full unfiltered dump to disk when `dumpDir` is configured, then applies any
 * configured `pick` filter to the stdout payload.
 *
 * @param data - The command result to emit.
 * @param meta - Optional additional metadata to attach to the envelope.
 */
export function outputResult<T>(data: T, meta?: Record<string, unknown>): void {
  dumpResponse(data, meta);

  const outputData = _outputOptions.pick ? pickFields(data, _outputOptions.pick) : data;
  const output: CliSuccessOutput<typeof outputData> = { ok: true, data: outputData, ...(meta ? { meta } : {}) };
  console.log(JSON.stringify(output));
}

/**
 * Prints a failed command result as a `{ ok: false, error, code, suggestion? }` JSON envelope on stdout.
 *
 * @param error - The thrown value to convert. Mapped via {@link buildErrorOutput} (which consults any registered {@link CliErrorMapper}).
 */
export function outputError(error: unknown): void {
  const output = buildErrorOutput(error);
  console.log(JSON.stringify(output));
}

/**
 * An error that carries a stable code and optional suggestion for the user.
 *
 * Throw from within commands to produce a structured `{ ok: false, code, suggestion }` envelope.
 */
export class CliError extends Error {
  readonly code: string;
  readonly suggestion?: string;

  constructor(input: { readonly message: string; readonly code: string; readonly suggestion?: string }) {
    super(input.message);
    this.name = 'CliError';
    this.code = input.code;
    this.suggestion = input.suggestion;
  }
}

/**
 * Converts an arbitrary thrown value into a {@link CliErrorOutput} envelope.
 *
 * Order of resolution:
 *   1. Any registered {@link CliErrorMapper} that returns a mapped envelope.
 *   2. {@link CliError} instances (preserve `code` and optional `suggestion`).
 *   3. Generic `Error` instances (`code: 'ERROR'`).
 *   4. Unknown values (`code: 'UNKNOWN_ERROR'`, message stringified).
 *
 * Error messages are passed through {@link sanitizeString} so secret-shaped substrings are redacted.
 *
 * @param error - The thrown value to convert.
 * @returns The structured {@link CliErrorOutput}.
 */
export function buildErrorOutput(error: unknown): CliErrorOutput {
  if (_errorMapper) {
    const mapped = _errorMapper(error);

    if (mapped) {
      return mapped;
    }
  }

  if (error instanceof CliError) {
    return { ok: false, error: sanitizeString(error.message), code: error.code, ...(error.suggestion ? { suggestion: error.suggestion } : {}) };
  }

  if (error instanceof Error) {
    return { ok: false, error: sanitizeString(error.message), code: 'ERROR' };
  }

  return { ok: false, error: sanitizeString(String(error)), code: 'UNKNOWN_ERROR' };
}
