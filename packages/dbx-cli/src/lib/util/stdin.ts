import { CliError } from './output';

/**
 * Error code thrown by {@link readAllStdin} when `-` was passed but stdin is an interactive
 * terminal, so no piped input will ever arrive.
 */
export const STDIN_NOT_PIPED_ERROR_CODE = 'STDIN_NOT_PIPED';

/**
 * The raw argv handed to the parser, recorded by {@link setCliRawArgv}.
 *
 * Needed because yargs destroys the `-` token before a handler ever sees it (see
 * {@link isStdinPositionalSentinel}), so the parsed value alone cannot prove intent.
 */
let cliRawArgv: readonly string[] = [];

/**
 * Records the raw argv the parser was handed so {@link isStdinPositionalSentinel} can distinguish a
 * user-typed `-` from an ordinary empty positional.
 *
 * Called by `createCli` with the same argv it passes to yargs, which keeps the behaviour identical
 * under the `CreateCliInput.argv` test override as it is in production.
 *
 * @param argv - The argv the parser was constructed with.
 */
export function setCliRawArgv(argv: readonly string[]): void {
  cliRawArgv = argv;
}

/**
 * Returns `true` when the user passed `-` (the conventional "read from stdin" sentinel) as a
 * flag value. Centralizes the convention so command handlers can pattern-match consistently.
 *
 * Only reliable for flag values, and only when the option declares `.nargs(<name>, 1)` — without it
 * yargs treats the `-` in `--data -` as the next option rather than the flag's value, and the flag
 * parses as boolean `true`. Positionals cannot be expressed this way; use
 * {@link isStdinPositionalSentinel} for those.
 *
 * @param value - The raw argv value to inspect.
 * @returns `true` when the value is exactly `'-'`.
 * @__NO_SIDE_EFFECTS__
 */
export function isStdinSentinel(value: unknown): boolean {
  return value === '-';
}

/**
 * Returns `true` when a *positional* carried the `-` stdin sentinel.
 *
 * yargs cannot surface a lone `-` positional intact: with `type: 'string'` it coerces to `''`, and
 * with no type at all to `true` — the raw `-` survives only in yargs-parser's `_`, which the
 * positional mapping has already consumed by the time a handler runs. So an empty positional is
 * treated as the sentinel only when the argv actually contained a bare `-`, which keeps a genuinely
 * empty argument from being mistaken for a request to read stdin.
 *
 * @param value - The parsed positional value to inspect.
 * @returns `true` when the positional was the stdin sentinel.
 * @__NO_SIDE_EFFECTS__
 */
export function isStdinPositionalSentinel(value: unknown): boolean {
  return isStdinSentinel(value) || (value === '' && cliRawArgv.includes('-'));
}

/**
 * Reads the entire contents of `process.stdin` as a UTF-8 string.
 *
 * Used by command handlers that accept `-` to mean "read from stdin" (e.g. `--data -`,
 * `get-many -`). Resolves once the stream emits `end`; no timeout is applied — callers that
 * need one should wrap with `Promise.race`.
 *
 * Throws when stdin is an interactive terminal: nothing is piped in, so the read would block
 * forever and the CLI would appear to hang rather than report a usage mistake.
 *
 * @returns The UTF-8 decoded stdin contents.
 * @throws {CliError} When stdin is a TTY, with `code: 'STDIN_NOT_PIPED'`.
 */
export async function readAllStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new CliError({
      message: 'Reading from stdin was requested with `-`, but stdin is a terminal. Pipe or redirect input instead (e.g. `cat keys.txt | <cli> get-many -`).',
      code: STDIN_NOT_PIPED_ERROR_CODE
    });
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Reads stdin as a list of whitespace-separated tokens (newlines, spaces, tabs).
 *
 * Empty tokens are dropped so a trailing newline doesn't introduce a phantom entry.
 *
 * @returns The tokens parsed from stdin.
 */
export async function readStdinTokens(): Promise<string[]> {
  const raw = await readAllStdin();
  return raw.split(/\s+/u).filter((s) => s.length > 0);
}
