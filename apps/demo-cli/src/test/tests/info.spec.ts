import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/dbx-cli/test is a test-only sibling sub-project; demo-cli specs are the intended consumer.
import { runCliCommand, type RunCliCommandResult } from '@dereekb/dbx-cli/test';
import { DEMO_CLI_ENUM_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from '../../lib/manifest/api.manifest.generated';

/**
 * Runs the demo CLI in-process with the shipped model + enum manifests. `info` is an auth-free config command, so no
 * login, env, or emulator fixture is involved.
 *
 * @param args - CLI arguments.
 * @returns The parsed `--json` envelope.
 */
async function runDemoInfoJson(args: readonly string[]): Promise<any> {
  const result: RunCliCommandResult = await runCliCommand({ cliName: 'demo-cli-info-spec', modelManifest: DEMO_CLI_MODEL_MANIFEST, enumManifest: DEMO_CLI_ENUM_MANIFEST }, [...args, '--json']);
  return JSON.parse(result.stdoutText);
}

describe('demo-cli info', () => {
  it('reports every generated model and enum in the overview', async () => {
    const envelope = await runDemoInfoJson(['info']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.mode).toBe('overview');
    expect(envelope.data.totalModels).toBe(DEMO_CLI_MODEL_MANIFEST.length);
    expect(envelope.data.totalEnums).toBe(Object.keys(DEMO_CLI_ENUM_MANIFEST).length);
  });

  it('lists the notification fields that store NotificationSendState', async () => {
    const envelope = await runDemoInfoJson(['info', '--enum', 'NotificationSendState']);
    const usedBy = envelope.data.enums[0].usedBy as { readonly modelType: string; readonly field: string }[];
    expect(usedBy.every((x) => x.modelType === 'notification')).toBe(true);
    expect(usedBy.map((x) => x.field)).toEqual(['ts', 'es', 'ps', 'ns']);
  });

  it('lists the profile resume sub-object and its state for ProfileResumeState', async () => {
    const envelope = await runDemoInfoJson(['info', '--enum', 'ProfileResumeState']);
    const longNames = (envelope.data.enums[0].usedBy as { readonly longName: string }[]).map((x) => x.longName);
    expect(longNames).toContain('resume');
    expect(longNames).toContain('resume.state');
  });

  it('returns only field hits with --kind field', async () => {
    const envelope = await runDemoInfoJson(['info', 'created', 'at', '--kind', 'field']);
    expect(envelope.data.hits.length).toBeGreaterThan(0);
    expect(envelope.data.hits.every((x: { readonly kind: string }) => x.kind === 'field')).toBe(true);
  });

  it('puts the enum first for its exact name', async () => {
    const envelope = await runDemoInfoJson(['info', 'ProfileResumeState']);
    expect(envelope.data.hits[0]).toMatchObject({ kind: 'enum', enum: 'ProfileResumeState' });
  });
});
