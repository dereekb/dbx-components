import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { buildModelDecodeCommand, decodeFirestoreModelKey, renderDecodedKey } from './build-model-decode-command';
import type { CliModelManifest } from './types';

const MANIFEST: CliModelManifest = [
  {
    modelType: 'profile',
    modelName: 'Profile',
    identityConst: 'profileIdentity',
    collectionPrefix: 'p',
    sourcePackage: 'demo-firebase',
    sourceFile: 'profile.ts',
    fields: []
  },
  {
    modelType: 'notificationBox',
    modelName: 'NotificationBox',
    modelGroup: 'Notification',
    identityConst: 'notificationBoxIdentity',
    collectionPrefix: 'nb',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'notification.ts',
    fields: []
  },
  {
    modelType: 'notification',
    modelName: 'Notification',
    modelGroup: 'Notification',
    identityConst: 'notificationIdentity',
    collectionPrefix: 'nbn',
    parentIdentityConst: 'notificationBoxIdentity',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'notification.ts',
    fields: []
  }
];

describe('buildModelDecodeCommand()', () => {
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
  });

  function runWith(argv: readonly string[]): void {
    const cmd = buildModelDecodeCommand(MANIFEST);
    yargs(argv as string[])
      .command(cmd)
      .demandCommand(1)
      .strict()
      .fail(false)
      .exitProcess(false)
      .parseSync();
  }

  it('decodes a top-level key into model + id', () => {
    runWith(['model-decode', 'p/abc123']);
    const output = stdout.join('');
    expect(output).toContain('Model: Profile');
    expect(output).toContain('identityConst: profileIdentity');
    expect(output).toContain('modelType: profile');
    expect(output).toContain('prefix: p');
    expect(output).toContain('id: abc123');
    expect(output).toContain('source: demo-firebase (profile.ts)');
  });

  it('renders a parent chain for subcollection paths', () => {
    runWith(['model-decode', 'nb/parent123/nbn/child456']);
    const output = stdout.join('');
    expect(output).toContain('Model: Notification');
    expect(output).toContain('prefix: nbn');
    expect(output).toContain('id: child456');
    expect(output).toContain('parentIdentityConst: notificationBoxIdentity');
    expect(output).toContain('Parent chain:');
    expect(output).toContain('- NotificationBox — prefix nb, id parent123');
  });

  it('surfaces unresolved prefixes without exiting', () => {
    runWith(['model-decode', 'bogus/abc']);
    const output = stdout.join('');
    expect(output).toContain("Model: <unknown — prefix 'bogus' not in manifest>");
    expect(output).toContain('prefix: bogus');
    expect(output).toContain('id: abc');
    expect(output).toContain('Unresolved prefix: bogus');
  });

  it('emits a structured JSON envelope when --json is passed', () => {
    runWith(['model-decode', 'p/abc123', '--json']);
    const output = stdout.join('');
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.key).toBe('p/abc123');
    expect(parsed.data.leaf.modelName).toBe('Profile');
    expect(parsed.data.leaf.id).toBe('abc123');
    expect(parsed.data.ancestors).toEqual([]);
    expect(parsed.data.unresolvedPrefixes).toEqual([]);
  });

  it('emits a JSON envelope with ancestors for subcollection paths', () => {
    runWith(['model-decode', 'nb/parent/nbn/child', '--json']);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(true);
    expect(parsed.data.leaf.modelName).toBe('Notification');
    expect(parsed.data.ancestors).toHaveLength(1);
    expect(parsed.data.ancestors[0].modelName).toBe('NotificationBox');
    expect(parsed.data.ancestors[0].id).toBe('parent');
  });

  it('emits a structured error for an odd-segment key', () => {
    expect(() => runWith(['model-decode', 'sf/abc/extra'])).toThrow(/process\.exit:1/);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('MODEL_DECODE_INVALID_KEY');
  });

  it('emits a structured error for an empty key', () => {
    expect(() => runWith(['model-decode', '   '])).toThrow(/process\.exit:1/);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('MODEL_DECODE_INVALID_KEY');
  });
});

describe('decodeFirestoreModelKey()', () => {
  it('throws CliError for empty input', () => {
    expect(() => decodeFirestoreModelKey('', MANIFEST)).toThrow(/Key is empty/);
  });

  it('throws CliError for a single segment', () => {
    expect(() => decodeFirestoreModelKey('justone', MANIFEST)).toThrow(/Invalid Firestore key/);
  });

  it('throws CliError for a path with an odd number of segments', () => {
    expect(() => decodeFirestoreModelKey('nb/abc/nbn', MANIFEST)).toThrow(/Invalid Firestore key/);
  });

  it('captures unresolved prefixes alongside resolved ones', () => {
    const decoded = decodeFirestoreModelKey('unknown/a/nb/b', MANIFEST);
    expect(decoded.ancestors).toHaveLength(1);
    expect(decoded.ancestors[0].modelName).toBeUndefined();
    expect(decoded.leaf.modelName).toBe('NotificationBox');
    expect(decoded.unresolvedPrefixes).toEqual(['unknown']);
  });
});

describe('renderDecodedKey()', () => {
  it('falls back to an explanatory line when the leaf prefix is unresolved', () => {
    const decoded = decodeFirestoreModelKey('bogus/abc', MANIFEST);
    const text = renderDecodedKey(decoded);
    expect(text).toContain("Model: <unknown — prefix 'bogus' not in manifest>");
    expect(text).toContain('Unresolved prefix: bogus');
  });
});
