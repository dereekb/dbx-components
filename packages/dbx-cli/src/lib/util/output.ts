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

let _outputOptions: CliOutputOptions = {};
let _secretPatterns: CliSecretPattern[] = [...DEFAULT_CLI_SECRET_PATTERNS];

/**
 * Configures output options from parsed CLI arguments.
 *
 * Call from middleware before any command handler runs.
 */
export function configureOutputOptions(options: CliOutputOptions): void {
  _outputOptions = options;
}

export function getOutputOptions(): CliOutputOptions {
  return _outputOptions;
}

/**
 * Replaces the active secret-redaction pattern list with the given patterns.
 *
 * Use to add provider-specific patterns. Pass `[...DEFAULT_CLI_SECRET_PATTERNS, ...extra]`
 * to keep the defaults.
 */
export function configureCliSecretPatterns(patterns: CliSecretPattern[]): void {
  _secretPatterns = patterns;
}

export function sanitizeString(value: string): string {
  let result = value;

  for (const pattern of _secretPatterns) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

export function dumpTimestamp(): string {
  return new Date().toISOString().replaceAll(/[:.]/g, '-');
}

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

export function buildErrorOutput(error: unknown): CliErrorOutput {
  if (error instanceof CliError) {
    return { ok: false, error: sanitizeString(error.message), code: error.code, ...(error.suggestion ? { suggestion: error.suggestion } : {}) };
  }

  if (error instanceof Error) {
    return { ok: false, error: sanitizeString(error.message), code: 'ERROR' };
  }

  return { ok: false, error: sanitizeString(String(error)), code: 'UNKNOWN_ERROR' };
}
