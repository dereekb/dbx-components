import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { createActionCommand, type ActionCommandSpec } from './action.command.factory';
import { setCliContext } from '../context/cli.context';
import type { CliContext } from '../context/cli.context';
import { CliError } from '../util/output';

function buildStubContext(overrides?: Partial<CliContext>): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'dev',
    env: { apiBaseUrl: 'http://localhost', oidcIssuer: 'http://localhost', clientId: 'cid' } as CliContext['env'],
    accessToken: 'access-token',
    callModel: vi.fn(async () => ({ ok: true })) as unknown as CliContext['callModel'],
    getModel: vi.fn(async () => ({ result: null })) as unknown as CliContext['getModel'],
    getMultipleModels: vi.fn(async () => ({ results: [] })) as unknown as CliContext['getMultipleModels'],
    ...overrides
  };
}

describe('createActionCommand()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = [];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((arg: any) => {
      stdout.push(String(arg));
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    setCliContext(undefined);
  });

  async function runAction<TArgv, TResult>(spec: ActionCommandSpec<TArgv, TResult>, argv: readonly string[]): Promise<void> {
    await yargs(argv as string[])
      .command(createActionCommand(spec))
      .exitProcess(false)
      .fail((msg: string, err: Error | undefined) => {
        throw err ?? new Error(msg);
      })
      .parseAsync();
  }

  it('invokes the handler with the live CliContext and parsed argv', async () => {
    const context = buildStubContext();
    setCliContext(context);

    const seen: { context: CliContext; argv: unknown }[] = [];
    const spec: ActionCommandSpec = {
      command: 'sample <id>',
      describe: 'sample action',
      builder: (y) => y.positional('id', { type: 'string' }),
      handler: ({ context: ctx, argv }) => {
        seen.push({ context: ctx, argv });
        return { received: argv };
      }
    };

    await runAction(spec, ['sample', 'abc123']);

    expect(seen).toHaveLength(1);
    expect(seen[0].context).toBe(context);
    expect((seen[0].argv as { id: string }).id).toBe('abc123');

    const parsed = JSON.parse(stdout.find((s) => s.includes('"ok"')) ?? '{}');
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toEqual({ received: expect.objectContaining({ id: 'abc123' }) });
  });

  it('applies mapResult before output', async () => {
    setCliContext(buildStubContext());

    const spec: ActionCommandSpec<{ readonly value: number }, { readonly v: number }> = {
      command: 'mapped',
      describe: 'mapped',
      handler: () => ({ v: 7 }),
      mapResult: (r) => ({ doubled: r.v * 2 })
    };

    await runAction(spec, ['mapped']);

    const parsed = JSON.parse(stdout.find((s) => s.includes('"ok"')) ?? '{}');
    expect(parsed.data).toEqual({ doubled: 14 });
  });

  it('emits a CliError envelope and exits 1 when the handler throws', async () => {
    setCliContext(buildStubContext());

    const spec: ActionCommandSpec = {
      command: 'boom',
      describe: 'boom',
      handler: () => {
        throw new CliError({ message: 'broken', code: 'TEST_ERROR', suggestion: 'fix it' });
      }
    };

    await expect(runAction(spec, ['boom'])).rejects.toThrow('process.exit:1');

    const parsed = JSON.parse(stdout.find((s) => s.includes('"ok"')) ?? '{}');
    expect(parsed).toEqual({ ok: false, error: 'broken', code: 'TEST_ERROR', suggestion: 'fix it' });
  });

  it('throws when CliContext was not initialized (auth middleware did not run)', async () => {
    setCliContext(undefined);

    const spec: ActionCommandSpec = {
      command: 'no-ctx',
      describe: 'no context',
      handler: () => ({ ok: true })
    };

    await expect(runAction(spec, ['no-ctx'])).rejects.toThrow('process.exit:1');

    const parsed = JSON.parse(stdout.find((s) => s.includes('"ok"')) ?? '{}');
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('ERROR');
    expect(parsed.error).toMatch(/CLI context not initialized/);
  });

  it('appends the helpEpilogue to --help output when provided', async () => {
    const spec: ActionCommandSpec = {
      command: 'eptest',
      describe: 'epilogue test',
      helpEpilogue: 'Custom epilogue text',
      handler: () => undefined
    };

    const help = await yargs(['eptest', '--help']).command(createActionCommand(spec)).exitProcess(false).getHelp();

    expect(help).toContain('Custom epilogue text');
  });
});
