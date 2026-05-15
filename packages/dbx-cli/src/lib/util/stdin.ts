/**
 * Returns `true` when the user passed `-` (the conventional "read from stdin" sentinel) as a
 * positional or flag value. Centralizes the convention so command handlers can pattern-match
 * consistently.
 *
 * @param value - The raw argv value to inspect.
 * @returns `true` when the value is exactly `'-'`.
 * @__NO_SIDE_EFFECTS__
 */
export function isStdinSentinel(value: unknown): boolean {
  return value === '-';
}

/**
 * Reads the entire contents of `process.stdin` as a UTF-8 string.
 *
 * Used by command handlers that accept `-` to mean "read from stdin" (e.g. `--data -`,
 * `get-many -`). Resolves once the stream emits `end`; no timeout is applied — callers that
 * need one should wrap with `Promise.race`.
 *
 * @returns The UTF-8 decoded stdin contents.
 */
export async function readAllStdin(): Promise<string> {
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
