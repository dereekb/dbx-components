import { vi } from 'vitest';
import { type INestApplication } from '@nestjs/common';
import { type CliContext, type CliEnvConfig, type CliModelManifest, type CreateCliInput, createCli, createCliContext } from '@dereekb/dbx-cli';

/**
 * Input for {@link buildTestCliContext}.
 */
export interface BuildTestCliContextInput {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly accessToken: string;
  readonly modelManifest?: CliModelManifest;
}

/**
 * Builds a {@link CliContext} for use as `testCliContext` on {@link createCli}.
 *
 * Thin wrapper around {@link createCliContext} that exists so test code can import from a single
 * test-only entry without pulling in production-only types.
 *
 * @param input - The context inputs (cliName, envName, env, accessToken, optional modelManifest).
 * @returns The constructed {@link CliContext} that drives `callModel` / `getModel` / `getMultipleModels`
 *   against `input.env.apiBaseUrl` with `input.accessToken` as the Bearer token.
 * @__NO_SIDE_EFFECTS__
 */
export function buildTestCliContext(input: BuildTestCliContextInput): CliContext {
  return createCliContext({
    cliName: input.cliName,
    envName: input.envName,
    env: input.env,
    accessToken: input.accessToken,
    modelManifest: input.modelManifest
  });
}

/**
 * Result envelope returned by {@link runCliCommand}.
 *
 * Captures everything tests typically want to assert on: stdout/stderr chunks, the parsed argv,
 * yargs's help output (if any), any handler error, and the exit code if the handler called
 * `process.exit` (which is intercepted so it does not actually terminate vitest).
 *
 * {@link runCliCommand} always resolves — errors come back in {@link RunCliCommandResult.error}
 * and exit attempts in {@link RunCliCommandResult.exitCode} so tests can assert on error envelopes
 * without try/catch boilerplate.
 */
export interface RunCliCommandResult {
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
  readonly stdoutText: string;
  readonly stderrText: string;
  readonly argv: unknown;
  readonly helpOutput: string;
  readonly error?: Error;
  /**
   * Set when the CLI's handler called `process.exit(code)`. Captured (so the test process is not
   * killed) and surfaced here so tests can assert on the intended exit status.
   *
   * Production CLI handlers exit with `1` on CliError (via `wrapCommandHandler`) and `4` on auth
   * middleware failures. With the `testCliContext` override the auth middleware never exits, but
   * handler errors still go through `wrapCommandHandler`.
   */
  readonly exitCode?: number;
}

/**
 * Drives a CLI invocation in-process and captures all output.
 *
 * Creates a fresh yargs `Argv` per call (so middleware/option defaults can't leak across tests),
 * parses `args`, and collects `process.stdout.write` / `process.stderr.write` / `console.log` /
 * `console.error` output via `vi.spyOn`. The spies are always restored on completion.
 *
 * Always resolves — handler errors and yargs failures are surfaced in {@link RunCliCommandResult.error}
 * instead of being thrown.
 *
 * @param input - The {@link CreateCliInput} used to build the CLI for this invocation. Pass a fresh
 *   object each call (or rely on the caller-side factory) — yargs `Argv` state is not reused across
 *   invocations.
 * @param args - The argv vector to parse (e.g. `['get', 'p/abc']`).
 * @returns The captured output envelope.
 */
export async function runCliCommand(input: CreateCliInput, args: readonly string[]): Promise<RunCliCommandResult> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdoutChunks.push(toChunkString(chunk));
    return true;
  }) as never);
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderrChunks.push(toChunkString(chunk));
    return true;
  }) as never);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(((...parts: unknown[]) => {
    stdoutChunks.push(parts.map((p) => stringifyConsolePart(p)).join(' ') + '\n');
  }) as never);
  const errLogSpy = vi.spyOn(console, 'error').mockImplementation(((...parts: unknown[]) => {
    stderrChunks.push(parts.map((p) => stringifyConsolePart(p)).join(' ') + '\n');
  }) as never);

  // Intercept process.exit so production handlers that exit (e.g. wrapCommandHandler on CliError)
  // do not actually kill the vitest worker. Throw a sentinel to abort the handler chain — the
  // catch below maps it back into a structured exitCode.
  let capturedExitCode: number | undefined;
  const exitSentinel = new Error('__cli_test_process_exit__');
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    capturedExitCode = code ?? 0;
    throw exitSentinel;
  }) as never);

  let capturedArgv: unknown;
  let capturedError: Error | undefined;
  let helpOutput = '';

  try {
    await createCli(input)
      .exitProcess(false)
      .parse([...args], (err: Error | undefined, argv: unknown, output: string) => {
        capturedArgv = argv;
        if (err) capturedError = err;
        helpOutput = output;
      });
  } catch (e) {
    if (e !== exitSentinel) {
      capturedError = e instanceof Error ? e : new Error(String(e));
    }
  } finally {
    writeSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
    errLogSpy.mockRestore();
    exitSpy.mockRestore();
  }

  const result: RunCliCommandResult = {
    stdout: stdoutChunks,
    stderr: stderrChunks,
    stdoutText: stdoutChunks.join(''),
    stderrText: stderrChunks.join(''),
    argv: capturedArgv,
    helpOutput,
    error: capturedError,
    exitCode: capturedExitCode
  };

  return result;
}

/**
 * Idempotently binds the fixture's NestJS application to `127.0.0.1:0` (or the supplied host) and
 * returns the live `apiBaseUrl` so the CLI's `fetch` calls have a real socket to hit.
 *
 * Safe to call multiple times against the same app — when `app.getHttpServer().listening` is true,
 * skips re-binding and just resolves the current address.
 *
 * The caller does NOT need to `.close()` explicitly: the demoApi/firebase-admin-nest fixture closes
 * the underlying NestJS app at the end of its describe block, which closes the HTTP listener.
 *
 * @param input - The fixture app + optional global route prefix (defaults to `'api'` to match
 *   demo-api's production prefix) and host (defaults to `127.0.0.1`).
 * @returns The bound `apiBaseUrl` (e.g. `http://127.0.0.1:54321/api`) and the resolved port.
 */
export async function listenOnNestAppForTest(input: ListenOnNestAppForTestInput): Promise<ListenOnNestAppForTestResult> {
  const host = input.host ?? '127.0.0.1';
  const prefix = input.apiPrefix ?? 'api';
  const server = input.app.getHttpServer();

  if (!server.listening) {
    await input.app.listen(0, host);
  }

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const trimmedPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const apiBaseUrl = trimmedPrefix.length > 0 ? `http://${host}:${port}/${trimmedPrefix}` : `http://${host}:${port}`;

  return { apiBaseUrl, port };
}

export interface ListenOnNestAppForTestInput {
  readonly app: INestApplication;
  /**
   * Global route prefix the NestJS app is mounted under. Defaults to `'api'` to match the demo-api
   * production configuration. Pass an empty string to skip the prefix.
   */
  readonly apiPrefix?: string;
  /**
   * Host to bind to. Defaults to `127.0.0.1`.
   */
  readonly host?: string;
}

export interface ListenOnNestAppForTestResult {
  readonly apiBaseUrl: string;
  readonly port: number;
}

function toChunkString(chunk: unknown): string {
  let result: string;

  if (typeof chunk === 'string') {
    result = chunk;
  } else if (chunk instanceof Uint8Array) {
    result = Buffer.from(chunk).toString('utf8');
  } else {
    result = String(chunk);
  }

  return result;
}

function stringifyConsolePart(part: unknown): string {
  let result: string;

  if (typeof part === 'string') {
    result = part;
  } else if (part instanceof Error) {
    result = part.stack ?? part.message;
  } else {
    try {
      result = JSON.stringify(part);
    } catch {
      result = String(part);
    }
  }

  return result;
}
