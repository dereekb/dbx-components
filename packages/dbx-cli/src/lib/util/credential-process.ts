import { spawn } from 'node:child_process';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { CliError } from './output';

// MARK: Environment
/**
 * Environment variable a parent process sets on a child CLI it runs as a credential process.
 *
 * A dbx-cli command that can hand out a secret (e.g. `external-token`) prints it raw ONLY when this
 * variable is set — run directly by a user or an agent it prints a redacted value instead. The parent
 * (e.g. `zoho-cli` through {@link runCliCredentialProcess}) captures the child's stdout in-process, so
 * the secret never reaches a terminal or an agent's transcript by default.
 */
export const DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR = 'DBX_CLI_CREDENTIAL_PROCESS';

/**
 * Default time a credential process may run before it is killed.
 *
 * Generous enough to cover an interactive re-login prompt the child surfaces on stderr.
 */
export const DEFAULT_CLI_CREDENTIAL_PROCESS_TIMEOUT_MS: Milliseconds = 60_000;

/**
 * {@link CliError} code thrown when the credential process could not be spawned or exited non-zero
 * without printing an error envelope.
 */
export const CLI_CREDENTIAL_PROCESS_FAILED_ERROR_CODE = 'CREDENTIAL_PROCESS_FAILED';

/**
 * {@link CliError} code thrown when the credential process did not finish within its timeout.
 */
export const CLI_CREDENTIAL_PROCESS_TIMEOUT_ERROR_CODE = 'CREDENTIAL_PROCESS_TIMEOUT';

/**
 * {@link CliError} code thrown when the credential process exited cleanly but its stdout was not a
 * JSON object or `{ ok: true, data }` envelope.
 */
export const CLI_CREDENTIAL_PROCESS_INVALID_OUTPUT_ERROR_CODE = 'CREDENTIAL_PROCESS_INVALID_OUTPUT';

/**
 * {@link CliError} code used when the credential process printed an error envelope that carried no code.
 */
export const CLI_CREDENTIAL_PROCESS_ERROR_CODE = 'CREDENTIAL_PROCESS_ERROR';

/**
 * Returns whether the current process runs as a credential process for a parent CLI.
 *
 * Commands that can print a secret check this before writing it raw to stdout.
 *
 * @param env - The environment to inspect. Defaults to `process.env`.
 * @returns `true` when {@link DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR} is `1` or `true`.
 *
 * @example
 * ```typescript
 * if (isCliCredentialProcess()) {
 *   process.stdout.write(`${JSON.stringify(bundle)}\n`);
 * }
 * ```
 */
export function isCliCredentialProcess(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR];
  return value === '1' || value === 'true';
}

// MARK: Run
/**
 * Input for {@link runCliCredentialProcess}.
 */
export interface RunCliCredentialProcessInput {
  /**
   * Shell command to run, e.g. `demo-cli external-token zoho_admin`.
   */
  readonly command: string;
  /**
   * How long the command may run before it is killed. Defaults to
   * {@link DEFAULT_CLI_CREDENTIAL_PROCESS_TIMEOUT_MS}; `0` or a negative value disables the timeout.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * Extra environment variables merged over `process.env` for the child.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
}

/**
 * Runs another CLI as a credential process and returns the JSON object it prints.
 *
 * The command runs through the shell with {@link DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR} set, stdin
 * ignored, and stderr passed through to this process's stderr so login prompts and messages stay
 * visible. Its stdout is captured in-process and parsed as one of:
 *
 * - a bare JSON object — returned as-is;
 * - a dbx-cli success envelope `{ ok: true, data }` — `data` is returned;
 * - a dbx-cli error envelope `{ ok: false, error, code, suggestion? }` — thrown as a {@link CliError}
 *   carrying the child's message, code and suggestion.
 *
 * When the whole stdout is not JSON, its last non-empty line is tried instead. Failures never echo the
 * captured stdout, since it may hold a secret.
 *
 * @param input - The command to run and its options.
 * @returns The parsed JSON object.
 * @throws {CliError} With the child's error when it printed an error envelope; with
 *   {@link CLI_CREDENTIAL_PROCESS_TIMEOUT_ERROR_CODE} when it timed out; with
 *   {@link CLI_CREDENTIAL_PROCESS_FAILED_ERROR_CODE} when it could not start or exited non-zero; with
 *   {@link CLI_CREDENTIAL_PROCESS_INVALID_OUTPUT_ERROR_CODE} when its stdout was not a JSON object.
 *
 * @example
 * ```typescript
 * const bundle = await runCliCredentialProcess<CliExternalConnectionTokenBundle>({ command: 'demo-cli external-token zoho_admin' });
 * ```
 */
export function runCliCredentialProcess<T extends object = Record<string, unknown>>(input: RunCliCredentialProcessInput): Promise<T> {
  const { command } = input;
  const timeoutMs = input.timeoutMs ?? DEFAULT_CLI_CREDENTIAL_PROCESS_TIMEOUT_MS;

  return new Promise<T>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    let settled = false;
    let timeoutHandle: Maybe<NodeJS.Timeout>;

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        fn();
      }
    };

    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, ...input.env, [DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR]: '1' }
    });

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        settle(() => {
          child.kill('SIGTERM');
          reject(new CliError({ message: `Credential process "${command}" did not finish within ${timeoutMs}ms.`, code: CLI_CREDENTIAL_PROCESS_TIMEOUT_ERROR_CODE }));
        });
      }, timeoutMs);
    }

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));

    child.once('error', (e) => {
      settle(() => reject(new CliError({ message: `Credential process "${command}" could not be started: ${e.message}`, code: CLI_CREDENTIAL_PROCESS_FAILED_ERROR_CODE })));
    });

    child.once('close', (exitCode, signal) => {
      settle(() => {
        try {
          resolve(readCliCredentialProcessOutput<T>({ command, stdout: Buffer.concat(stdoutChunks).toString('utf8'), exitCode, signal }));
        } catch (e) {
          reject(e);
        }
      });
    });
  });
}

// MARK: Internal
interface ReadCliCredentialProcessOutputInput {
  readonly command: string;
  readonly stdout: string;
  readonly exitCode: Maybe<number>;
  readonly signal: Maybe<NodeJS.Signals>;
}

function readCliCredentialProcessOutput<T extends object>(input: ReadCliCredentialProcessOutputInput): T {
  const { command, exitCode, signal } = input;
  const parsed = parseCliCredentialProcessJson(input.stdout);
  const exitedCleanly = exitCode === 0;
  let result: Maybe<T>;
  let error: Maybe<CliError>;

  if (parsed?.['ok'] === false) {
    // the child's own error envelope wins over the generic exit-code failure (dbx-cli exits non-zero after printing one).
    error = cliErrorFromErrorEnvelope(parsed);
  } else if (!exitedCleanly) {
    const reason = signal ? `was killed by ${signal}` : `exited with code ${exitCode}`;
    error = new CliError({ message: `Credential process "${command}" ${reason}.`, code: CLI_CREDENTIAL_PROCESS_FAILED_ERROR_CODE });
  } else if (parsed?.['ok'] === true) {
    const data = parsed['data'];
    result = isJsonObject(data) ? (data as T) : undefined;
  } else if (parsed != null) {
    result = parsed as T;
  }

  if (result == null && error == null) {
    error = new CliError({
      message: `Credential process "${command}" did not print a JSON object on stdout.`,
      code: CLI_CREDENTIAL_PROCESS_INVALID_OUTPUT_ERROR_CODE,
      suggestion: 'Run the command directly to check it succeeds. Its stdout must be a single JSON object.'
    });
  }

  if (error) {
    throw error;
  }

  return result as T;
}

function parseCliCredentialProcessJson(stdout: string): Maybe<Record<string, unknown>> {
  const trimmed = stdout.trim();
  let result = parseJsonObject(trimmed);

  if (result == null && trimmed) {
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const lastLine = lines.at(-1);
    result = lastLine == null ? undefined : parseJsonObject(lastLine.trim());
  }

  return result;
}

function parseJsonObject(value: string): Maybe<Record<string, unknown>> {
  let result: Maybe<Record<string, unknown>>;

  try {
    const parsed: unknown = JSON.parse(value);
    result = isJsonObject(parsed) ? parsed : undefined;
  } catch {
    result = undefined;
  }

  return result;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cliErrorFromErrorEnvelope(envelope: Record<string, unknown>): CliError {
  const rawError = envelope['error'];
  // dbx-cli emits `{ ok: false, error: string, code, suggestion? }`; also accept a nested `error: { message, code, suggestion }` object.
  const nested = isJsonObject(rawError) ? rawError : undefined;
  const message = (typeof rawError === 'string' ? rawError : undefined) ?? asString(nested?.['message']) ?? 'The credential process failed.';
  const code = asString(envelope['code']) ?? asString(nested?.['code']) ?? CLI_CREDENTIAL_PROCESS_ERROR_CODE;
  const suggestion = asString(envelope['suggestion']) ?? asString(nested?.['suggestion']);
  return new CliError({ message, code, ...(suggestion ? { suggestion } : {}) });
}

function asString(value: unknown): Maybe<string> {
  return typeof value === 'string' && value ? value : undefined;
}
