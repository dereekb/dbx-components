/**
 * Loader for `dbx-mcp.config.json`.
 *
 * Reads the config file from `${cwd}/dbx-mcp.config.json` (no upward walk —
 * the MCP is always launched at the repo root, mirroring the cwd contract
 * that the existing `validate-input.ts` security check relies on).
 *
 * Failure modes are surfaced as warnings rather than thrown errors. A
 * missing file is *not* a warning — it is the expected default for fresh
 * installs that haven't opted into downstream manifests yet. Parse and
 * schema failures are warnings so the rest of the MCP can still come up;
 * the caller decides whether to log or escalate.
 */

import { readFile as nodeReadFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type } from 'arktype';
import { DbxMcpConfig } from './config-schema.js';

/**
 * Function shape used by the loader to read the config file. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')`. Tests inject a Map-backed
 * implementation so they can drive the loader without touching disk.
 */
export type ConfigReadFile = (absolutePath: string) => Promise<string>;

/**
 * Discriminated union of the non-fatal events the config loader emits.
 * A missing file is *not* represented here — that case returns `null`
 * config + empty warnings.
 */
export type ConfigWarning = { readonly kind: 'config-parse-failed'; readonly path: string; readonly error: string } | { readonly kind: 'config-schema-failed'; readonly path: string; readonly error: string };

/**
 * Result of {@link findAndLoadConfig}. `config` is `null` either when no
 * file is present or when parsing/validation failed; `configPath` is set
 * iff a file was actually found, regardless of whether parsing succeeded.
 */
export interface FindAndLoadConfigResult {
  readonly config: DbxMcpConfig | null;
  readonly configPath: string | null;
  readonly warnings: readonly ConfigWarning[];
}

/**
 * Input to {@link findAndLoadConfig}.
 */
export interface FindAndLoadConfigInput {
  readonly cwd: string;
  readonly readFile?: ConfigReadFile;
}

const CONFIG_FILENAME = 'dbx-mcp.config.json';

const DEFAULT_READ_FILE: ConfigReadFile = (path) => nodeReadFile(path, 'utf-8');

/**
 * Reads `${cwd}/dbx-mcp.config.json` and returns its parsed contents.
 * Missing files return `{ config: null, configPath: null, warnings: [] }`
 * (not an error — the file is optional). Parse and schema failures
 * return `{ config: null, configPath: <found path>, warnings: [...] }`
 * so the caller can decide how loud to be about the failure.
 *
 * @param input - cwd and an optional injected `readFile`
 * @returns the parsed config, the path it came from, and any warnings
 */
export async function findAndLoadConfig(input: FindAndLoadConfigInput): Promise<FindAndLoadConfigResult> {
  const { cwd, readFile = DEFAULT_READ_FILE } = input;
  const configPath = resolve(cwd, CONFIG_FILENAME);

  let raw: string | null = null;
  try {
    raw = await readFile(configPath);
  } catch {
    raw = null;
  }

  let result: FindAndLoadConfigResult;
  if (raw === null) {
    result = { config: null, configPath: null, warnings: [] };
  } else {
    let parsed: unknown;
    let parseError: string | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }

    if (parseError !== null) {
      result = {
        config: null,
        configPath,
        warnings: [{ kind: 'config-parse-failed', path: configPath, error: parseError }]
      };
    } else {
      const validated = DbxMcpConfig(parsed);
      if (validated instanceof type.errors) {
        result = {
          config: null,
          configPath,
          warnings: [{ kind: 'config-schema-failed', path: configPath, error: validated.summary }]
        };
      } else {
        result = { config: validated, configPath, warnings: [] };
      }
    }
  }

  return result;
}
