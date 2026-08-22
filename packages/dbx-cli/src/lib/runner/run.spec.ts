import { describe, it, expect, vi } from 'vitest';
import type { CommandModule } from 'yargs';
import { createCli, runCli } from './run';
import { getCliContext } from '../context/cli.context';
import type { CliContext } from '../context/cli.context';
import type { CliModelManifest } from '../manifest/types';

const MODEL_MANIFEST: CliModelManifest = [
  {
    modelType: 'profile',
    modelName: 'Profile',
    identityConst: 'profileIdentity',
    collectionPrefix: 'p',
    sourcePackage: 'demo-firebase',
    sourceFile: 'profile.ts',
    fields: []
  }
];

async function getRootHelp(input: Parameters<typeof createCli>[0]): Promise<string> {
  let result = '';
  let captured: Error | undefined;

  await createCli({ ...input, argv: ['--help'] })
    .exitProcess(false)
    .parse(['--help'], (err: Error | undefined, _argv: unknown, output: string) => {
      captured = err;
      result = output;
    });

  if (captured) throw captured;
  return result;
}

describe('createCli() model-info auto-wiring', () => {
  it('registers the built-in model-info command when modelManifest is provided', async () => {
    const help = await getRootHelp({ cliName: 'demo-cli', modelManifest: MODEL_MANIFEST });
    expect(help).toContain('model-info');
  });

  it('does NOT register model-info when modelManifest is omitted', async () => {
    const help = await getRootHelp({ cliName: 'demo-cli' });
    expect(help).not.toContain('model-info');
  });

  it('does NOT register model-info when disableModelInfo is true', async () => {
    const help = await getRootHelp({ cliName: 'demo-cli', modelManifest: MODEL_MANIFEST, disableModelInfo: true });
    expect(help).not.toContain('model-info');
  });
});

describe('createCli() model-decode auto-wiring', () => {
  it('registers the built-in model-decode command when modelManifest is provided', async () => {
    const help = await getRootHelp({ cliName: 'demo-cli', modelManifest: MODEL_MANIFEST });
    expect(help).toContain('model-decode');
  });

  it('does NOT register model-decode when modelManifest is omitted', async () => {
    const help = await getRootHelp({ cliName: 'demo-cli' });
    expect(help).not.toContain('model-decode');
  });

  it('does NOT register model-decode when disableModelDecode is true', async () => {
    const help = await getRootHelp({ cliName: 'demo-cli', modelManifest: MODEL_MANIFEST, disableModelDecode: true });
    expect(help).not.toContain('model-decode');
  });
});

describe('createCli() testCliContext override', () => {
  it('skips the auth middleware and attaches the supplied context for command handlers', async () => {
    const handler = vi.fn(() => undefined);

    const testCliContext: CliContext = {
      cliName: 'demo-cli',
      envName: 'test',
      env: {
        apiBaseUrl: 'http://127.0.0.1:0/api',
        oidcIssuer: 'http://127.0.0.1:0/oidc',
        appClientUrl: 'http://127.0.0.1:0',
        clientId: 'test-client',
        redirectUri: 'http://127.0.0.1:0/callback',
        scopes: 'openid'
      },
      accessToken: 'test-token',
      callModel: handler as never,
      getModel: handler as never,
      getMultipleModels: handler as never
    };

    const observed: CliContext[] = [];

    await createCli({
      cliName: 'demo-cli',
      testCliContext,
      apiCommands: [
        {
          command: 'probe',
          describe: 'capture the live CliContext',
          handler: () => {
            const ctx = getCliContext();
            if (ctx) observed.push(ctx);
          }
        }
      ]
    })
      .exitProcess(false)
      .parse(['probe']);

    expect(observed).toHaveLength(1);
    expect(observed[0].accessToken).toBe('test-token');
    expect(observed[0].envName).toBe('test');
  });
});

const TEST_CLI_CONTEXT: CliContext = {
  cliName: 'demo-cli',
  envName: 'test',
  env: {
    apiBaseUrl: 'http://127.0.0.1:0/api',
    oidcIssuer: 'http://127.0.0.1:0/oidc',
    appClientUrl: 'http://127.0.0.1:0',
    clientId: 'test-client',
    redirectUri: 'http://127.0.0.1:0/callback',
    scopes: 'openid'
  },
  accessToken: 'test-token',
  callModel: (() => undefined) as never,
  getModel: (() => undefined) as never,
  getMultipleModels: (() => undefined) as never
};

/**
 * A single-level command, for the cases where the nesting is not what is under test.
 */
function probeCommand(onHandler: () => unknown): CommandModule {
  return {
    command: 'probe',
    describe: 'probe command',
    handler: () => {
      onHandler();
    }
  };
}

/**
 * A two-level command (`parent child`), which is what makes the per-command-level middleware re-run
 * observable — the shape a real `action <model> <action>` command has.
 */
function nestedCommand(onHandler: () => unknown): CommandModule {
  const child: CommandModule = {
    command: 'child',
    describe: 'child command',
    handler: () => {
      onHandler();
    }
  };

  return {
    command: 'parent <sub>',
    describe: 'parent command',
    builder: (y) => y.command(child),
    handler: () => undefined
  };
}

describe('createCli() setup hook', () => {
  it('runs the setup hook once for a NESTED command, not once per command level', async () => {
    const calls: string[] = [];
    const setup = vi.fn(() => {
      calls.push('setup');
    });

    await createCli({
      cliName: 'demo-cli',
      testCliContext: TEST_CLI_CONTEXT,
      setup,
      apiCommands: [nestedCommand(() => calls.push('handler'))]
    })
      .exitProcess(false)
      .parse(['parent', 'child']);

    expect(calls).toEqual(['setup', 'handler']);
  });

  it('hands the setup hook the live context', async () => {
    const observed: (CliContext | null | undefined)[] = [];

    await createCli({
      cliName: 'demo-cli',
      testCliContext: TEST_CLI_CONTEXT,
      setup: ({ context }) => {
        observed.push(context);
      },
      apiCommands: [{ command: 'probe', describe: 'probe', handler: () => undefined }]
    })
      .exitProcess(false)
      .parse(['probe']);

    expect(observed).toHaveLength(1);
    expect(observed[0]?.accessToken).toBe('test-token');
  });

  it('a throwing setup aborts the command: the handler never runs', async () => {
    const handler = vi.fn(() => undefined);
    let captured: unknown;

    try {
      await createCli({
        cliName: 'demo-cli',
        testCliContext: TEST_CLI_CONTEXT,
        setup: () => {
          throw new Error('setup blew up');
        },
        apiCommands: [{ command: 'probe', describe: 'probe', handler }]
      })
        .exitProcess(false)
        .parse(['probe']);
    } catch (e) {
      captured = e;
    }

    expect((captured as Error | undefined)?.message).toBe('setup blew up');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('runCli() teardown hook', () => {
  it('runs teardown once, AFTER the command handler', async () => {
    const calls: string[] = [];

    await runCli({
      cliName: 'demo-cli',
      testCliContext: TEST_CLI_CONTEXT,
      argv: ['probe'],
      setup: () => {
        calls.push('setup');
      },
      teardown: () => {
        calls.push('teardown');
      },
      apiCommands: [probeCommand(() => calls.push('handler'))]
    });

    expect(calls).toEqual(['setup', 'handler', 'teardown']);
  });

  it('a throwing teardown does not fail the invocation', async () => {
    const calls: string[] = [];

    await runCli({
      cliName: 'demo-cli',
      testCliContext: TEST_CLI_CONTEXT,
      argv: ['probe'],
      teardown: () => {
        calls.push('teardown');
        throw new Error('teardown blew up');
      },
      apiCommands: [probeCommand(() => calls.push('handler'))]
    });

    expect(calls).toEqual(['handler', 'teardown']);
  });
});
