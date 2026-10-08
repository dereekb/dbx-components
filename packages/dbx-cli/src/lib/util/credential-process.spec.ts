import { describe, expect, it } from 'vitest';
import { CLI_CREDENTIAL_PROCESS_FAILED_ERROR_CODE, CLI_CREDENTIAL_PROCESS_INVALID_OUTPUT_ERROR_CODE, CLI_CREDENTIAL_PROCESS_TIMEOUT_ERROR_CODE, DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR, isCliCredentialProcess, runCliCredentialProcess } from './credential-process';
import { CliError } from './output';

// the secret the child prints is assembled at runtime (`"secret-" + "token-value"`) so it is not part of
// the command string, which the error messages are allowed to name

/**
 * Builds a shell command that runs the given script with the current Node binary.
 *
 * @param script - The script passed to `node -e`. Must not contain single quotes.
 * @returns The shell command.
 */
function nodeCommand(script: string): string {
  return `"${process.execPath}" -e '${script}'`;
}

async function captureError(promise: Promise<unknown>): Promise<CliError> {
  let result: unknown;

  try {
    await promise;
  } catch (e) {
    result = e;
  }

  expect(result).toBeInstanceOf(CliError);
  return result as CliError;
}

describe('isCliCredentialProcess()', () => {
  it('is true for "1" and "true"', () => {
    expect(isCliCredentialProcess({ [DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR]: '1' })).toBe(true);
    expect(isCliCredentialProcess({ [DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR]: 'true' })).toBe(true);
  });

  it('is false when unset or set to anything else', () => {
    expect(isCliCredentialProcess({})).toBe(false);
    expect(isCliCredentialProcess({ [DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR]: '0' })).toBe(false);
    expect(isCliCredentialProcess({ [DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR]: 'yes' })).toBe(false);
  });
});

describe('runCliCredentialProcess()', () => {
  it('returns a bare JSON object', async () => {
    const result = await runCliCredentialProcess({ command: nodeCommand('process.stdout.write(JSON.stringify({ accessToken: "abc", n: 1 }))') });
    expect(result).toEqual({ accessToken: 'abc', n: 1 });
  });

  it('unwraps a { ok: true, data } envelope', async () => {
    const result = await runCliCredentialProcess({ command: nodeCommand('console.log(JSON.stringify({ ok: true, data: { accessToken: "abc" }, meta: { x: 1 } }))') });
    expect(result).toEqual({ accessToken: 'abc' });
  });

  it('falls back to the last non-empty line when the whole stdout is not JSON', async () => {
    const result = await runCliCredentialProcess({ command: nodeCommand('console.log("logging in..."); console.log(JSON.stringify({ accessToken: "abc" })); console.log("")') });
    expect(result).toEqual({ accessToken: 'abc' });
  });

  it('throws the error envelope as a CliError carrying its message, code and suggestion', async () => {
    const error = await captureError(runCliCredentialProcess({ command: nodeCommand('console.log(JSON.stringify({ ok: false, error: "Not allowed.", code: "AUTH_FORBIDDEN", suggestion: "Log in again." })); process.exit(1)') }));
    expect(error.message).toBe('Not allowed.');
    expect(error.code).toBe('AUTH_FORBIDDEN');
    expect(error.suggestion).toBe('Log in again.');
  });

  it('throws a generic CliError on a non-zero exit without an error envelope', async () => {
    const error = await captureError(runCliCredentialProcess({ command: nodeCommand('process.stdout.write("secret-" + "token-value"); process.exit(3)') }));
    expect(error.code).toBe(CLI_CREDENTIAL_PROCESS_FAILED_ERROR_CODE);
    expect(error.message).toContain('code 3');
    expect(error.message).not.toContain('secret-token-value');
  });

  it('never echoes unparseable stdout in the error', async () => {
    const error = await captureError(runCliCredentialProcess({ command: nodeCommand('console.log("secret-" + "token-value")') }));
    expect(error.code).toBe(CLI_CREDENTIAL_PROCESS_INVALID_OUTPUT_ERROR_CODE);
    expect(error.message).not.toContain('secret-token-value');
    expect(error.suggestion ?? '').not.toContain('secret-token-value');
  });

  it('rejects a success envelope whose data is not an object', async () => {
    const error = await captureError(runCliCredentialProcess({ command: nodeCommand('console.log(JSON.stringify({ ok: true, data: "secret-" + "token-value" }))') }));
    expect(error.code).toBe(CLI_CREDENTIAL_PROCESS_INVALID_OUTPUT_ERROR_CODE);
    expect(error.message).not.toContain('secret-token-value');
  });

  it('sets the credential process env var on the child, alongside the extra env', async () => {
    const result = await runCliCredentialProcess<{ readonly flag?: string; readonly extra?: string }>({
      command: nodeCommand(`process.stdout.write(JSON.stringify({ flag: process.env.${DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR}, extra: process.env.DBX_CLI_CREDENTIAL_PROCESS_SPEC_EXTRA }))`),
      env: { DBX_CLI_CREDENTIAL_PROCESS_SPEC_EXTRA: 'extra-value' }
    });

    expect(result.flag).toBe('1');
    expect(result.extra).toBe('extra-value');
  });

  it('kills the child and throws once the timeout elapses', async () => {
    const error = await captureError(runCliCredentialProcess({ command: nodeCommand('setTimeout(() => undefined, 10000)'), timeoutMs: 200 }));
    expect(error.code).toBe(CLI_CREDENTIAL_PROCESS_TIMEOUT_ERROR_CODE);
  });
});
