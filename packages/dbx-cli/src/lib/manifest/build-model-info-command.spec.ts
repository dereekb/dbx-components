import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { buildModelInfoCommand, type BuildModelInfoCommandOptions } from './build-model-info-command';
import { renderModelManifestEntry, renderModelManifestList } from './model-info-utils';
import type { CliEnumManifest, CliModelManifest } from './types';

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
      { name: 'cat', longName: 'createdAt', converter: 'firestoreDate()', tsType: 'Date', optional: false },
      { name: 's', longName: 'state', converter: 'firestoreEnum<ProfileState>()', tsType: 'ProfileState', optional: false, enumRef: 'ProfileState' },
      {
        name: 'r',
        longName: 'resume',
        converter: 'firestoreSubObject(...)',
        optional: true,
        nestedIsArray: false,
        nestedFields: [
          { name: 'rs', longName: 'resumeState', converter: 'firestoreEnum<ResumeState>()', optional: false, enumRef: 'ResumeState' },
          { name: 'ps', longName: 'previousState', converter: 'firestoreEnum<ProfileState>()', optional: true, enumRef: 'ProfileState' },
          { name: 'g', longName: 'ghost', converter: 'firestoreEnum<GhostState>()', optional: true, enumRef: 'GhostState' }
        ]
      }
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

const ENUMS: CliEnumManifest = {
  ProfileState: {
    name: 'ProfileState',
    description: 'Profile lifecycle state.',
    values: [
      { name: 'ACTIVE', value: 1, description: 'Active profile.' },
      { name: 'BANNED', value: 2 }
    ]
  },
  ResumeState: { name: 'ResumeState', values: [{ name: 'NONE', value: -1 }] }
};

function runWith(argv: readonly string[], options?: BuildModelInfoCommandOptions): void {
  const cmd = buildModelInfoCommand(MANIFEST, options);
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
    expect(parsed.data.fields).toHaveLength(4);
  });

  it('emits a structured error when the model is not in the manifest', () => {
    expect(() => runWith(['model-info', 'missing'])).toThrow(/process\.exit:1/);
    const output = stdout.join('');
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('MODEL_INFO_NOT_FOUND');
  });

  describe('without an enum manifest', () => {
    it('adds an ENUM column to the field table when a field has an enumRef', () => {
      runWith(['model-info', 'profile']);
      const output = stdout.join('');
      expect(output).toMatch(/OPTIONAL\s+ENUM\s+CONVERTER/);
      expect(output).not.toContain('Enums (');
    });

    it('emits no enums key under --json', () => {
      runWith(['model-info', 'profile', '--json']);
      expect(JSON.parse(stdout.join('')).data).not.toHaveProperty('enums');
    });
  });

  describe('with an enum manifest', () => {
    it('ends the model view with the referenced enum tables, resolving nested fields', () => {
      runWith(['model-info', 'profile'], { enumManifest: ENUMS });
      const output = stdout.join('');
      expect(output).toContain('Enums (2):');
      expect(output).toContain('ProfileState — Profile lifecycle state.');
      expect(output).toMatch(/1\s+ACTIVE\s+Active profile\./);
      expect(output).toMatch(/-1\s+NONE/);
      expect(output).not.toContain('GhostState —');
    });

    it('keeps --fields to the field table', () => {
      runWith(['model-info', 'profile', '--fields'], { enumManifest: ENUMS });
      const output = stdout.join('');
      expect(output).toContain('ENUM');
      expect(output).not.toContain('Enums (');
    });

    it('emits data.enums deduped in first-reference order under --json', () => {
      runWith(['model-info', 'profile', '--json'], { enumManifest: ENUMS });
      const parsed = JSON.parse(stdout.join(''));
      expect(parsed.data.fields).toHaveLength(4);
      expect(parsed.data.enums).toEqual([ENUMS['ProfileState'], ENUMS['ResumeState']]);
    });

    it('adds nothing when no referenced enum resolves', () => {
      runWith(['model-info', 'profile', '--json'], { enumManifest: {} });
      expect(JSON.parse(stdout.join('')).data).not.toHaveProperty('enums');
      stdout.length = 0;
      runWith(['model-info', 'profile'], { enumManifest: {} });
      expect(stdout.join('')).not.toContain('Enums (');
    });

    it('keeps the list JSON an array', () => {
      runWith(['model-info', '--json'], { enumManifest: ENUMS });
      expect(Array.isArray(JSON.parse(stdout.join('')).data)).toBe(true);
    });
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
    expect(text).not.toContain('ENUM');
    expect(text).toContain('firstName');
  });

  it('omits the Enums section when no enum manifest is passed', () => {
    const text = renderModelManifestEntry({
      modelType: 'p',
      modelName: 'P',
      identityConst: 'pIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo',
      sourceFile: 'p.ts',
      fields: [{ name: 's', longName: 'state', tsType: 'ProfileState', optional: false, enumRef: 'ProfileState' }]
    });
    expect(text).toMatch(/OPTIONAL\s+ENUM/);
    expect(text).not.toContain('Enums (');
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

  it('omits the Read line when no read posture is declared', () => {
    const text = renderModelManifestEntry({
      modelType: 'p',
      modelName: 'P',
      identityConst: 'pIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo',
      sourceFile: 'p.ts',
      fields: [{ name: 'fn', longName: 'firstName', tsType: 'string', optional: false }]
    });
    expect(text).not.toContain('Read:');
  });

  it('renders the Read line with its gloss when a read posture is declared', () => {
    const text = renderModelManifestEntry({
      modelType: 'p',
      modelName: 'P',
      identityConst: 'pIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo',
      sourceFile: 'p.ts',
      read: 'owner',
      fields: [{ name: 'fn', longName: 'firstName', tsType: 'string', optional: false }]
    });
    expect(text).toContain('Read: owner — readable by the record owner (and admins)');
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
