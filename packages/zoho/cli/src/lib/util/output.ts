import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError, ZohoInvalidAuthorizationError } from '@dereekb/zoho';

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

// MARK: Output Options
/**
 * Configuration for response dumping and field filtering.
 *
 * Set via {@link configureOutputOptions} from global CLI flags.
 */
export interface CliOutputOptions {
  /**
   * Directory path to dump full API responses to.
   *
   * When set, every successful result is written as a JSON file before any field filtering.
   */
  readonly dumpDir?: string;
  /**
   * Comma-separated list of top-level field names to include in stdout output.
   *
   * When set, only these fields are included on each data item. The full response
   * is still written to the dump file (if dumpDir is set).
   */
  readonly pick?: string;
  /**
   * The command path segments from yargs (argv._), used for dump file naming.
   */
  readonly commandPath?: string[];
}

let _outputOptions: CliOutputOptions = {};

/**
 * Configures output options from parsed CLI arguments.
 *
 * Call from middleware before any command handler runs.
 */
export function configureOutputOptions(options: CliOutputOptions): void {
  _outputOptions = options;
}

// MARK: Secrets
/**
 * Patterns that indicate a string may contain a secret token or credential.
 * Used by {@link sanitizeString} to redact sensitive values from CLI output.
 */
const SECRET_PATTERNS = [/Bearer\s+\S+/gi, /access_token[=:]\s*\S+/gi, /refresh_token[=:]\s*\S+/gi, /client_secret[=:]\s*\S+/gi, /1000\.\w{20,}/g];

function sanitizeString(value: string): string {
  let result = value;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

// MARK: Dump
/**
 * Builds a file-safe timestamp string for dump file names.
 */
export function dumpTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Returns a snapshot of the current output options.
 *
 * Used by the multi-page pagination helper to read `dumpDir`, `commandPath`, and `pick`
 * from the same source the rest of the output utilities use.
 */
export function getOutputOptions(): CliOutputOptions {
  return _outputOptions;
}

/**
 * Builds a dump file path based on the current `dumpDir` and `commandPath`.
 *
 * Ensures the dump directory exists. Returns `undefined` if no `dumpDir` is configured.
 *
 * @param extension File extension without the leading dot (`json` or `ndjson`).
 * @param suffix Optional suffix appended before the extension (e.g. `pick`).
 */
export function buildDumpFilePath(extension: 'json' | 'ndjson', suffix?: string): string | undefined {
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

/**
 * Writes the full API response to a JSON file in the configured dump directory.
 *
 * File name format: `{command}_{timestamp}.json` where command is the yargs
 * command path joined by underscores (e.g. `desk_tickets_list`).
 */
function dumpResponse<T>(data: T, meta: Record<string, unknown> | undefined): void {
  const { dumpDir, commandPath } = _outputOptions;

  if (!dumpDir) {
    return;
  }

  if (!existsSync(dumpDir)) {
    mkdirSync(dumpDir, { recursive: true });
  }

  const prefix = commandPath?.length ? commandPath.join('_') : 'response';
  const fileName = `${prefix}_${dumpTimestamp()}.json`;
  const filePath = join(dumpDir, fileName);
  const content: CliSuccessOutput<T> = { ok: true, data, ...(meta ? { meta } : {}) };

  writeFileSync(filePath, JSON.stringify(content, null, 2));
}

// MARK: Pick
/**
 * Filters data to include only the specified top-level fields.
 *
 * For arrays, each element is filtered. For plain objects, the object itself is filtered.
 * Non-object/array values pass through unchanged.
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

// MARK: Output
export function outputResult<T>(data: T, meta?: Record<string, unknown>): void {
  dumpResponse(data, meta);

  const outputData = _outputOptions.pick ? pickFields(data, _outputOptions.pick) : data;
  const output: CliSuccessOutput<typeof outputData> = { ok: true, data: outputData, ...(meta ? { meta } : {}) };
  console.log(JSON.stringify(output));
}

export function outputError(error: unknown): void {
  const output = buildErrorOutput(error);
  console.log(JSON.stringify(output));
}

export function buildErrorOutput(error: unknown): CliErrorOutput {
  if (error instanceof ZohoInvalidTokenError) {
    return { ok: false, error: sanitizeString(error.message), code: 'TOKEN_EXPIRED', suggestion: 'Run: zoho-cli auth check' };
  }

  if (error instanceof ZohoInvalidAuthorizationError) {
    return { ok: false, error: sanitizeString(error.message), code: 'AUTH_ERROR', suggestion: 'Check your client ID, secret, and refresh token.' };
  }

  if (error instanceof ZohoTooManyRequestsError) {
    return { ok: false, error: sanitizeString(error.message), code: 'RATE_LIMITED', suggestion: 'Wait and retry. Zoho rate limit exceeded.' };
  }

  if (error instanceof ZohoServerFetchResponseError) {
    return { ok: false, error: sanitizeString(error.message), code: 'API_ERROR' };
  }

  if (error instanceof Error) {
    return { ok: false, error: sanitizeString(error.message), code: 'ERROR' };
  }

  return { ok: false, error: sanitizeString(String(error)), code: 'UNKNOWN_ERROR' };
}
