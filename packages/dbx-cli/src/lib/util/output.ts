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
  /**
   * When true, the stdout JSON envelope is rendered with 2-space indent instead of compact.
   * Driven by the global `--pretty` flag.
   */
  readonly pretty?: boolean;
}

/**
 * Standard exit code used when a CLI command handler throws.
 *
 * Used by {@link wrapCommandHandler} when no override is supplied.
 */
export const CLI_EXIT_CODE_HANDLER = 1;

/**
 * Exit code used when the auth middleware itself fails (no env, no token, expired refresh,
 * etc.) — distinct from a handler error so scripts can disambiguate auth from logic failures.
 */
export const CLI_EXIT_CODE_AUTH = 4;

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
let _verbose = false;
let _timeoutMs: Maybe<number>;

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
 * Toggles the process-wide verbose flag. The HTTP layer (`call-model.client.ts`,
 * `oidc.client.ts`) checks {@link isCliVerbose} before each request and emits a
 * `[<method> <url>]` trace line to stderr when enabled.
 *
 * @param value - Whether verbose tracing is on.
 */
export function setCliVerbose(value: boolean): void {
  _verbose = value;
}

/**
 * @returns Whether the verbose flag is currently enabled.
 */
export function isCliVerbose(): boolean {
  return _verbose;
}

/**
 * Writes a one-line stderr trace prefixed with `[verbose]` when the verbose
 * flag is on. No-op otherwise. Kept off stdout so the JSON envelope on stdout
 * stays parseable.
 *
 * @param message - The trace message.
 */
export function verboseLog(message: string): void {
  if (_verbose) {
    process.stderr.write(`[verbose] ${message}\n`);
  }
}

/**
 * Drop-in `fetch` replacement that wraps the request with the configured verbose-trace
 * and `--timeout` behavior. Aborts via `AbortController` after the configured timeout.
 *
 * Translates an aborted request into a {@link CliError} with code `TIMEOUT`.
 *
 * @param fetcher - The underlying fetch impl (defaults to global `fetch`). Allows tests to inject.
 * @param input - The first arg to fetch (URL or Request).
 * @param init - The RequestInit. Any existing `signal` is preserved; we only attach our own when no signal was supplied.
 * @returns The fetch Response.
 */
export async function tracedFetch(fetcher: typeof fetch | undefined, input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const fetchImpl = fetcher ?? fetch;
  const timeoutMs = _timeoutMs;
  const method = init?.method ?? 'GET';

  let url: string;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  verboseLog(`${method} ${url}`);

  let controller: Maybe<AbortController>;
  let timeoutHandle: Maybe<NodeJS.Timeout>;
  let finalInit: RequestInit | undefined = init;

  if (timeoutMs != null && init?.signal == null) {
    const localController = new AbortController();
    controller = localController;
    timeoutHandle = setTimeout(() => localController.abort(), timeoutMs);
    finalInit = { ...init, signal: localController.signal };
  }

  try {
    return await fetchImpl(input, finalInit);
  } catch (e) {
    if (controller?.signal.aborted) {
      throw new CliError({
        message: `${method} ${url}: request aborted after ${timeoutMs}ms.`,
        code: 'TIMEOUT'
      });
    }

    throw e;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Sets the process-wide HTTP timeout (in milliseconds) honored by the HTTP layer.
 *
 * Pass `undefined` to clear. The HTTP helpers thread this into an `AbortController`
 * so individual `fetch` calls cancel after the configured duration.
 *
 * @param ms - Timeout in ms, or `undefined` to clear.
 */
export function setCliTimeoutMs(ms: Maybe<number>): void {
  _timeoutMs = ms;
}

/**
 * @returns The current process-wide HTTP timeout in ms, or `undefined` when unset.
 */
export function getCliTimeoutMs(): Maybe<number> {
  return _timeoutMs;
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
 * @__NO_SIDE_EFFECTS__
 */
export function buildDumpFilePath(extension: 'json' | 'ndjson', suffix?: string): Maybe<string> {
  const { dumpDir, commandPath } = _outputOptions;
  let result: Maybe<string>;

  if (!dumpDir) {
    result = undefined;
  } else {
    if (!existsSync(dumpDir)) {
      mkdirSync(dumpDir, { recursive: true });
    }

    const prefix = commandPath?.length ? commandPath.join('_') : 'response';
    const stamp = dumpTimestamp();
    const base = suffix ? `${prefix}_${stamp}_${suffix}` : `${prefix}_${stamp}`;
    result = join(dumpDir, `${base}.${extension}`);
  }

  return result;
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
  let result: T;

  if (Array.isArray(data)) {
    result = data.map((item) => pickFromObject(item, fields)) as T;
  } else if (data != null && typeof data === 'object') {
    result = pickFromObject(data, fields) as T;
  } else {
    result = data;
  }

  return result;
}

function pickFromObject(obj: unknown, fields: string[]): unknown {
  let result: unknown;

  if (obj == null || typeof obj !== 'object') {
    result = obj;
  } else {
    const picked: Record<string, unknown> = {};

    for (const field of fields) {
      if (field in (obj as Record<string, unknown>)) {
        picked[field] = (obj as Record<string, unknown>)[field];
      }
    }

    result = picked;
  }

  return result;
}

function stringifyEnvelope(value: unknown): string {
  return _outputOptions.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

/**
 * Prints a successful command result as a `{ ok: true, data, meta? }` JSON envelope on stdout.
 *
 * Also writes a full unfiltered dump to disk when `dumpDir` is configured, then applies any
 * configured `pick` filter to the stdout payload. Honors the global `--pretty` flag for the
 * stdout payload only (the dump-to-disk path is always pretty-printed).
 *
 * @param data - The command result to emit.
 * @param meta - Optional additional metadata to attach to the envelope.
 */
export function outputResult<T>(data: T, meta?: Record<string, unknown>): void {
  dumpResponse(data, meta);

  const outputData = _outputOptions.pick ? pickFields(data, _outputOptions.pick) : data;
  const output: CliSuccessOutput<typeof outputData> = { ok: true, data: outputData, ...(meta ? { meta } : {}) };
  console.log(stringifyEnvelope(output));
}

/**
 * Prints a failed command result as a `{ ok: false, error, code, suggestion? }` JSON envelope on stdout.
 *
 * Honors the global `--pretty` flag.
 *
 * @param error - The thrown value to convert. Mapped via {@link buildErrorOutput} (which consults any registered {@link CliErrorMapper}).
 */
export function outputError(error: unknown): void {
  const output = buildErrorOutput(error);
  console.log(stringifyEnvelope(output));
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
 * @__NO_SIDE_EFFECTS__
 */
export function buildErrorOutput(error: unknown): CliErrorOutput {
  const mapped = _errorMapper ? _errorMapper(error) : undefined;
  let result: CliErrorOutput;

  if (mapped) {
    result = mapped;
  } else if (error instanceof CliError) {
    result = { ok: false, error: sanitizeString(error.message), code: error.code, ...(error.suggestion ? { suggestion: error.suggestion } : {}) };
  } else if (error instanceof Error) {
    result = { ok: false, error: sanitizeString(error.message), code: 'ERROR' };
  } else {
    result = { ok: false, error: sanitizeString(String(error)), code: 'UNKNOWN_ERROR' };
  }

  return result;
}
