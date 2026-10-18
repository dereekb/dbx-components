import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/dbx-cli/test is a test-only sibling sub-project; demo-cli specs are the intended consumer.
import { runCliCommand, type RunCliCommandResult } from '@dereekb/dbx-cli/test';
import { DEMO_CLI_ENUM_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from '../../lib/manifest/api.manifest.generated';

/**
 * Runs the demo CLI in-process with the shipped model + enum manifests. `enum-info` and `model-info`
 * are auth-free config commands, so no login, env, or emulator fixture is involved.
 *
 * @param args - CLI arguments.
 * @returns The captured run result.
 */
function runDemoEnumCli(args: readonly string[]): Promise<RunCliCommandResult> {
  return runCliCommand({ cliName: 'demo-cli-enum-info-spec', modelManifest: DEMO_CLI_MODEL_MANIFEST, enumManifest: DEMO_CLI_ENUM_MANIFEST }, args);
}

describe('demo-cli enum-info', () => {
  it('lists every generated enum', async () => {
    const result = await runDemoEnumCli(['enum-info', '--json']);
    const envelope = JSON.parse(result.stdoutText);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.total).toBe(Object.keys(DEMO_CLI_ENUM_MANIFEST).length);
    expect(envelope.data.names).toContain('StorageFileProcessingState');
  });

  it('decodes a raw StorageFile processing state', async () => {
    const result = await runDemoEnumCli(['enum-info', 'StorageFileProcessingState', '--json']);
    const envelope = JSON.parse(result.stdoutText);
    const row = envelope.data.enums[0].values.find((v: { readonly value: unknown }) => v.value === 2);
    expect(row.name).toBe('PROCESSING');
    expect(envelope.data.notFound).toBeUndefined();
  });

  it('renders negative values in the text table', async () => {
    const result = await runDemoEnumCli(['enum-info', 'NotificationSendState']);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdoutText).toContain('# NotificationSendState');
    expect(result.stdoutText).toMatch(/^-1\s+NONE/m);
  });

  it('appends the referenced enum tables to model-info, reaching nested fields', async () => {
    const result = await runDemoEnumCli(['model-info', 'profile', '--json']);
    const envelope = JSON.parse(result.stdoutText);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.enums.map((e: { readonly name: string }) => e.name)).toContain('ProfileResumeState');
  });
});
