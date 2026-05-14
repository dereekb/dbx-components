import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { buildModelInfoCommand } from './build-model-info-command';
import { renderModelManifestEntry, renderModelManifestList } from './model-info-utils';
import type { CliModelManifest } from './types';

const MANIFEST: CliModelManifest = [
  {
    modelType: 'profile',
    modelName: 'Profile',
    identityConst: 'profileIdentity',
    collectionPrefix: 'p',
    sourcePackage: 'demo-firebase',
    sourceFile: 'profile.ts',
    fields: [
      { name: 'fn', longName: 'firstName', converter: 'firestoreString()', tsType: 'string', optional: false, description: 'First name' },
      { name: 'cat', longName: 'createdAt', converter: 'firestoreDate()', tsType: 'Date', optional: false }
    ]
  },
  {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    sourcePackage: 'demo-firebase',
    sourceFile: 'guestbook.ts',
    fields: []
  }
];

function runWith(argv: readonly string[]): void {
  const cmd = buildModelInfoCommand(MANIFEST);
  yargs([...argv])
    .command(cmd)
    .demandCommand(1)
    .strict()
    .fail(false)
    .exitProcess(false)
    .parseSync();
}

describe('buildModelInfoCommand()', () => {
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
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('lists every model in the manifest when no positional is provided', () => {
    runWith(['model-info']);
    const output = stdout.join('');
    expect(output).toContain('profile');
    expect(output).toContain('guestbook');
    expect(output).toContain('FIELDS');
  });

  it('renders full model details for a specific model', () => {
    runWith(['model-info', 'profile']);
    const output = stdout.join('');
    expect(output).toContain('# profile');
    expect(output).toContain('firstName');
    expect(output).toContain('createdAt');
  });

  it('looks up by identity const', () => {
    runWith(['model-info', 'profileIdentity']);
    const output = stdout.join('');
    expect(output).toContain('# profile');
  });

  it('looks up by collection prefix', () => {
    runWith(['model-info', 'p']);
    const output = stdout.join('');
    expect(output).toContain('# profile');
  });

  it('emits structured JSON envelope when --json is passed', () => {
    runWith(['model-info', 'profile', '--json']);
    const output = stdout.join('');
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.modelType).toBe('profile');
    expect(parsed.data.fields).toHaveLength(2);
  });

  it('emits a structured error when the model is not in the manifest', () => {
    expect(() => runWith(['model-info', 'missing'])).toThrow(/process\.exit:1/);
    const output = stdout.join('');
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('MODEL_INFO_NOT_FOUND');
  });
});

describe('renderModelManifestList()', () => {
  it('returns an explanatory message for an empty manifest', () => {
    expect(renderModelManifestList([])).toMatch(/No models found/);
  });
});

describe('renderModelManifestEntry()', () => {
  it('omits the CONVERTER column when no field carries converter text', () => {
    const text = renderModelManifestEntry({
      modelType: 'p',
      modelName: 'P',
      identityConst: 'pIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo',
      sourceFile: 'p.ts',
      fields: [{ name: 'fn', longName: 'firstName', tsType: 'string', optional: false }]
    });
    expect(text).not.toContain('CONVERTER');
    expect(text).toContain('firstName');
  });

  it('keeps the CONVERTER column when at least one field carries converter text', () => {
    const text = renderModelManifestEntry({
      modelType: 'p',
      modelName: 'P',
      identityConst: 'pIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo',
      sourceFile: 'p.ts',
      fields: [{ name: 'fn', longName: 'firstName', converter: 'firestoreString()', tsType: 'string', optional: false }]
    });
    expect(text).toContain('CONVERTER');
    expect(text).toContain('firestoreString()');
  });

  it('renders nested fields under their parent field', () => {
    const text = renderModelManifestEntry({
      modelType: 'p',
      modelName: 'P',
      identityConst: 'pIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo',
      sourceFile: 'p.ts',
      fields: [
        {
          name: 'r',
          longName: 'recipients',
          converter: 'firestoreObjectArray(...)',
          optional: false,
          nestedFields: [{ name: 'uid', longName: 'uid', converter: 'firestoreUID()', optional: false }],
          nestedIsArray: true
        }
      ]
    });
    expect(text).toContain('recipients');
    expect(text).toContain('array element');
    expect(text).toContain('uid');
  });
});
