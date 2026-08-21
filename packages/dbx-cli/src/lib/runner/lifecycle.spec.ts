import { describe, it, expect, vi } from 'vitest';
import { type CliContext } from '../context/cli.context';
import { cliLifecycleRunner } from './lifecycle';

const CLI_NAME = 'demo-cli';

function testCliContext(): CliContext {
  return { cliName: CLI_NAME, envName: 'test', env: { apiBaseUrl: 'http://127.0.0.1:0/api' }, accessToken: 'test-token' } as unknown as CliContext;
}

describe('cliLifecycleRunner() setup', () => {
  // the guard exists because yargs re-runs a global middleware once per COMMAND LEVEL, so a nested
  // command (`action worker export`) enters the setup middleware three times
  it('runs the setup hook at most once, however many times it is invoked', async () => {
    const setup = vi.fn(async () => undefined);
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, setup });

    await runner.runSetup(undefined);
    await runner.runSetup(undefined);
    await runner.runSetup(undefined);

    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('hands the hook the cli name and the live context', async () => {
    const setup = vi.fn(async () => undefined);
    const context = testCliContext();
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, setup });

    await runner.runSetup(context);

    expect(setup).toHaveBeenCalledWith({ cliName: CLI_NAME, context });
  });

  it('rethrows: a failed precondition must abort the command rather than run it degraded', async () => {
    const setup = vi.fn(async () => {
      throw new Error('setup failed');
    });
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, setup });

    await expect(runner.runSetup(undefined)).rejects.toThrow('setup failed');
  });

  it('does not retry a throwing setup on a later command level', async () => {
    const setup = vi.fn(async () => {
      throw new Error('setup failed');
    });
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, setup });

    await expect(runner.runSetup(undefined)).rejects.toThrow('setup failed');
    await runner.runSetup(undefined);

    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no setup hook was supplied', async () => {
    const runner = cliLifecycleRunner({ cliName: CLI_NAME });
    await expect(runner.runSetup(undefined)).resolves.toBeUndefined();
  });
});

describe('cliLifecycleRunner() teardown', () => {
  it('runs the teardown hook at most once', async () => {
    const teardown = vi.fn(async () => undefined);
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, teardown });

    await runner.runTeardown(undefined);
    await runner.runTeardown(undefined);

    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing teardown: the command result is already emitted', async () => {
    const teardown = vi.fn(async () => {
      throw new Error('teardown failed');
    });
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, teardown });

    await expect(runner.runTeardown(undefined)).resolves.toBeUndefined();
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('runs even when setup never did — an invocation can fail before reaching setup', async () => {
    const setup = vi.fn(async () => undefined);
    const teardown = vi.fn(async () => undefined);
    const runner = cliLifecycleRunner({ cliName: CLI_NAME, setup, teardown });

    await runner.runTeardown(undefined);

    expect(setup).not.toHaveBeenCalled();
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no teardown hook was supplied', async () => {
    const runner = cliLifecycleRunner({ cliName: CLI_NAME });
    await expect(runner.runTeardown(undefined)).resolves.toBeUndefined();
  });
});
