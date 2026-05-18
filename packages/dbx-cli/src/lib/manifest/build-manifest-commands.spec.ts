import { describe, it, expect } from 'vitest';
import { type, type Type } from 'arktype';
import yargs from 'yargs';
import { buildManifestCommands, detectDataHelpFormat, resolvePerModelGetKey, type ManifestHelpDataFormat } from './build-manifest-commands';
import { type CliApiManifest, type CliModelManifest } from './types';

interface SampleParams {
  readonly guestbook: string;
  readonly message?: string | null;
  readonly published?: boolean | null;
}

const sampleParamsType = type({
  guestbook: 'string > 0',
  'message?': 'string > 0 & string <= 200 | undefined | null',
  'published?': 'boolean | undefined | null'
}) as Type<SampleParams>;

const MANIFEST: CliApiManifest = [
  {
    model: 'guestbookEntry',
    verb: 'update',
    specifier: 'insert',
    paramsTypeName: 'InsertGuestbookEntryParams',
    paramsValidator: sampleParamsType,
    resultTypeName: 'InsertGuestbookEntryResult',
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts'
  }
];

interface HelpForOptions {
  readonly format?: ManifestHelpDataFormat;
  readonly apiManifest?: CliApiManifest;
  readonly modelManifest?: CliModelManifest;
}

function helpFor(args: readonly string[], formatOrOptions?: ManifestHelpDataFormat | HelpForOptions): Promise<string> {
  const options: HelpForOptions = typeof formatOrOptions === 'string' ? { format: formatOrOptions } : (formatOrOptions ?? {});
  const apiManifest = options.apiManifest ?? MANIFEST;
  const parser = yargs([...args])
    .scriptName('demo-cli')
    .option('verbose', { alias: 'v', type: 'boolean', default: false, global: true, describe: 'Verbose output' })
    .option('env', { type: 'string', global: true, describe: 'Named env' })
    .option('dump-dir', { type: 'string', global: true, describe: 'Dump dir' })
    .option('pick', { type: 'string', global: true, describe: 'Pick fields' })
    .option('set-dump-dir', { type: 'string', global: true, describe: 'Persist dump dir' })
    .option('set-pick', { type: 'string', global: true, describe: 'Persist pick' })
    .option('pick-all', { type: 'boolean', global: true, describe: 'Pick all' })
    .option('data-help', { type: 'string', global: true, describe: 'Data help' })
    .option('all-help', { type: 'boolean', global: true, describe: 'All help' })
    .command(
      buildManifestCommands(apiManifest, {
        argv: args,
        ...(options.format ? { dataHelpFormat: options.format } : {}),
        ...(options.modelManifest ? { modelManifest: options.modelManifest } : {})
      })
    )
    .exitProcess(false)
    .fail(false);

  return parser.getHelp();
}

describe('buildManifestCommands', () => {
  it('returns a single `model <model>` parent command that lists per-model subcommands under `model --help`', async () => {
    const commands = buildManifestCommands(MANIFEST);

    expect(commands).toHaveLength(1);
    expect(commands[0].command).toBe('model <model>');

    const rootHelp = await helpFor([]);
    expect(rootHelp).toContain('demo-cli model <model>');
    // The per-model entries should not leak to the top-level help.
    expect(rootHelp).not.toContain('demo-cli guestbookEntry ');

    const modelHelp = await helpFor(['model', '--help']);
    expect(modelHelp).toContain('guestbookEntry <action>');
  });

  it('returns an empty command list when the manifest has no callable entries', () => {
    expect(buildManifestCommands([])).toEqual([]);
  });

  it('appends a synthetic `get <key>` sub-command to every model so any model can be read by key', async () => {
    const help = await helpFor(['model', 'guestbookEntry', '--help']);
    expect(help).toContain('get <key>');
    expect(help).toContain('Read a single guestbookEntry');
  });

  it('renders the params type name, JSON Schema, result type name, and source file in --help', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help']);

    expect(help).toContain('Params: InsertGuestbookEntryParams');
    expect(help).toContain('Params Schema (JSON Schema):');
    expect(help).toContain('Result: InsertGuestbookEntryResult');
    expect(help).toContain('Source: components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts');
  });

  it('emits a JSON Schema that captures required keys and field constraints', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help']);
    const match = /Params Schema \(JSON Schema\):\n(\{[\s\S]*?\n\})/.exec(help);

    expect(match).not.toBeNull();

    const schema = JSON.parse(match![1]) as {
      readonly properties: Record<string, unknown>;
      readonly required?: readonly string[];
    };

    expect(schema.required).toEqual(['guestbook']);
    expect(schema.properties.guestbook).toEqual({ type: 'string', minLength: 1 });
  });

  it('prunes unjsonifiable `undefined` branches from clearable unions so `T | null | undefined` reads as `T | null`', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help']);
    const match = /Params Schema \(JSON Schema\):\n(\{[\s\S]*?\n\})/.exec(help);
    const schema = JSON.parse(match![1]) as {
      readonly properties: Record<string, { readonly anyOf?: readonly unknown[] }>;
    };

    expect(schema.properties.published.anyOf).toEqual([{ type: 'boolean' }, { type: 'null' }]);
    expect(schema.properties.message.anyOf).toEqual([{ type: 'string', maxLength: 200, minLength: 1 }, { type: 'null' }]);
  });

  it('renders the arktype expression instead of JSON Schema when dataHelpFormat=arktype', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help'], 'arktype');

    expect(help).toContain('Params Schema (arktype):');
    expect(help).not.toContain('Params Schema (JSON Schema):');
    expect(help).toContain('guestbook: string >= 1');
    expect(help).toContain('--data-help=jsonschema or --data-help=both');
  });

  it('renders both schema formats when dataHelpFormat=both', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help'], 'both');

    expect(help).toContain('Params Schema (JSON Schema):');
    expect(help).toContain('Params Schema (arktype):');
    // No prompt to switch when both are already shown.
    expect(help).not.toMatch(/--data-help=\w+ or --data-help=both/);
  });

  it('hints at --data-help on JSON Schema (default) help to advertise the arktype form', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help']);

    expect(help).toContain('--data-help=arktype or --data-help=both');
  });

  it('shows the full standard global options block in --help when --data-help is not present', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help']);

    expect(help).toContain('--verbose');
    expect(help).toContain('--dump-dir');
    expect(help).toContain('--pick');
    expect(help).toContain('--pick-all');
  });

  it('hides unrelated global options from --help when --data-help is present', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help', '--data-help=arktype']);

    expect(help).not.toMatch(/^\s+(?:-v, )?--verbose\s/m);
    expect(help).not.toMatch(/^\s+--dump-dir\s/m);
    expect(help).not.toMatch(/^\s+--pick\s/m);
    expect(help).not.toMatch(/^\s+--set-dump-dir\s/m);
    expect(help).not.toMatch(/^\s+--set-pick\s/m);
    expect(help).not.toMatch(/^\s+--pick-all\s/m);
    // The data-related options stay visible.
    expect(help).toMatch(/^\s+--data-help\s/m);
    expect(help).toMatch(/^\s+--data\s/m);
    expect(help).toMatch(/^\s+--help\s/m);
  });

  it('keeps the full options table visible when --all-help is passed alongside --data-help', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'update-insert', '--help', '--data-help=arktype', '--all-help']);

    expect(help).toMatch(/^\s+(?:-v, )?--verbose\s/m);
    expect(help).toMatch(/^\s+--dump-dir\s/m);
    expect(help).toMatch(/^\s+--pick\s/m);
    expect(help).toMatch(/^\s+--pick-all\s/m);
    // Schema section is still rendered in the requested format.
    expect(help).toContain('Params Schema (arktype):');
  });
});

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

describe('buildManifestCommands per-model `get` help text', () => {
  const API_MANIFEST: CliApiManifest = [
    {
      model: 'profile',
      verb: 'update',
      groupName: 'Profile',
      sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts'
    },
    {
      model: 'guestbookEntry',
      verb: 'update',
      specifier: 'insert',
      groupName: 'Guestbook',
      sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts'
    }
  ];

  const MODEL_MANIFEST_WITH_BOTH: CliModelManifest = [
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
      modelType: 'guestbook',
      modelName: 'Guestbook',
      identityConst: 'guestbookIdentity',
      collectionPrefix: 'gb',
      sourcePackage: 'demo-firebase',
      sourceFile: 'guestbook.ts',
      fields: []
    },
    {
      modelType: 'guestbookEntry',
      modelName: 'GuestbookEntry',
      identityConst: 'guestbookEntryIdentity',
      collectionPrefix: 'gbe',
      parentIdentityConst: 'guestbookIdentity',
      sourcePackage: 'demo-firebase',
      sourceFile: 'guestbook.ts',
      fields: []
    }
  ];

  it('shows `get <id-or-key>` in usage for a root-level model when the model manifest is wired', async () => {
    const help = await helpFor(['model', 'profile', '--help'], { apiManifest: API_MANIFEST, modelManifest: MODEL_MANIFEST_WITH_BOTH });
    expect(help).toContain('get <id-or-key>');
    expect(help).not.toContain('get <key>');
    expect(normalize(help)).toContain('Read a single profile document by id or key.');
  });

  it('mentions the resolved `<prefix>/<id>` form in the positional help for root models', async () => {
    const help = await helpFor(['model', 'profile', 'get', '--help'], { apiManifest: API_MANIFEST, modelManifest: MODEL_MANIFEST_WITH_BOTH });
    const flat = normalize(help);
    expect(flat).toContain('`p/<id>`');
    expect(flat).toContain('full `prefix/id`');
  });

  it('keeps `get <key>` in usage for a subcollection model (guestbookEntry)', async () => {
    const help = await helpFor(['model', 'guestbookEntry', '--help'], { apiManifest: API_MANIFEST, modelManifest: MODEL_MANIFEST_WITH_BOTH });
    expect(help).toContain('get <key>');
    expect(help).not.toContain('get <id-or-key>');
    expect(normalize(help)).toContain('Read a single guestbookEntry document by key.');
  });

  it('says bare doc id is not supported in the positional help for a subcollection model', async () => {
    const help = await helpFor(['model', 'guestbookEntry', 'get', '--help'], { apiManifest: API_MANIFEST, modelManifest: MODEL_MANIFEST_WITH_BOTH });
    const flat = normalize(help);
    expect(flat).toContain('bare doc id is not supported for this subcollection model');
  });

  it('falls back to `get <key>` when no model manifest is wired (root/sub indeterminate)', async () => {
    const help = await helpFor(['model', 'profile', '--help'], { apiManifest: API_MANIFEST });
    expect(help).toContain('get <key>');
    expect(help).not.toContain('get <id-or-key>');
  });
});

describe('resolvePerModelGetKey', () => {
  const MODEL_MANIFEST: CliModelManifest = [
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
      modelType: 'guestbook',
      modelName: 'Guestbook',
      identityConst: 'guestbookIdentity',
      collectionPrefix: 'gb',
      sourcePackage: 'demo-firebase',
      sourceFile: 'guestbook.ts',
      fields: []
    },
    {
      modelType: 'guestbookEntry',
      modelName: 'GuestbookEntry',
      identityConst: 'guestbookEntryIdentity',
      collectionPrefix: 'gbe',
      parentIdentityConst: 'guestbookIdentity',
      sourcePackage: 'demo-firebase',
      sourceFile: 'guestbook.ts',
      fields: []
    }
  ];

  describe('top-level model (profile)', () => {
    it('prepends the collection prefix for a bare doc id', () => {
      expect(resolvePerModelGetKey('profile', 'abc123', MODEL_MANIFEST)).toBe('p/abc123');
    });

    it('passes a full prefix/id key through unchanged', () => {
      expect(resolvePerModelGetKey('profile', 'p/abc123', MODEL_MANIFEST)).toBe('p/abc123');
    });

    it('resolves the bare id and the full prefix/id form to the same key', () => {
      const fromId = resolvePerModelGetKey('profile', 'abc123', MODEL_MANIFEST);
      const fromKey = resolvePerModelGetKey('profile', 'p/abc123', MODEL_MANIFEST);
      expect(fromId).toBe(fromKey);
      expect(fromId).toBe('p/abc123');
    });
  });

  describe('subcollection model (guestbookEntry)', () => {
    it('throws on a bare doc id and tells the caller what the full path should look like', () => {
      expect(() => resolvePerModelGetKey('guestbookEntry', 'abc123', MODEL_MANIFEST)).toThrow(/subcollection/);
      expect(() => resolvePerModelGetKey('guestbookEntry', 'abc123', MODEL_MANIFEST)).toThrow(/<parentPrefix>\/<parentId>\/gbe\/abc123/);
    });

    it('passes a full subcollection path through unchanged', () => {
      expect(resolvePerModelGetKey('guestbookEntry', 'gb/book1/gbe/abc123', MODEL_MANIFEST)).toBe('gb/book1/gbe/abc123');
    });
  });

  describe('fallbacks', () => {
    it('passes the key through unchanged when the manifest is not wired', () => {
      expect(resolvePerModelGetKey('profile', 'abc123', undefined)).toBe('abc123');
    });

    it('passes the key through unchanged when the model is not in the manifest', () => {
      expect(resolvePerModelGetKey('unknown', 'abc123', MODEL_MANIFEST)).toBe('abc123');
    });
  });
});

describe('detectDataHelpFormat', () => {
  it('defaults to jsonschema when the flag is absent', () => {
    expect(detectDataHelpFormat(['node', 'cli', 'foo', 'bar', '--help'])).toBe('jsonschema');
  });

  it('parses --data-help=<format>', () => {
    expect(detectDataHelpFormat(['cli', '--data-help=arktype'])).toBe('arktype');
    expect(detectDataHelpFormat(['cli', '--data-help=both'])).toBe('both');
    expect(detectDataHelpFormat(['cli', '--data-help=jsonschema'])).toBe('jsonschema');
  });

  it('parses the space-separated form `--data-help <format>`', () => {
    expect(detectDataHelpFormat(['cli', '--data-help', 'arktype'])).toBe('arktype');
  });

  it('falls back to jsonschema when the value is unrecognized', () => {
    expect(detectDataHelpFormat(['cli', '--data-help=garbage'])).toBe('jsonschema');
  });
});
