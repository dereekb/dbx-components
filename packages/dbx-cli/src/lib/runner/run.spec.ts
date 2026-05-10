import { describe, it, expect } from 'vitest';
import { createCli } from './run';
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
