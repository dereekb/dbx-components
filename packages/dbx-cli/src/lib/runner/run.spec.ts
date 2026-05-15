import { describe, it, expect, vi } from 'vitest';
import { createCli } from './run';
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
