import { describe, it, expect } from 'vitest';
import { type, type Type } from 'arktype';
import yargs from 'yargs';
import { buildManifestCommands, detectDataHelpFormat, type ManifestHelpDataFormat } from './build-manifest-commands';
import { type CliApiManifest } from './types';

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
    paramsValidator: sampleParamsType as Type<unknown>,
    resultTypeName: 'InsertGuestbookEntryResult',
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts'
  }
];

function helpFor(args: readonly string[], format?: ManifestHelpDataFormat): Promise<string> {
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
      buildManifestCommands(MANIFEST, {
        argv: args,
        ...(format ? { dataHelpFormat: format } : {})
      })
    )
    .exitProcess(false)
    .fail(false);

  return parser.getHelp();
}

describe('buildManifestCommands', () => {
  it('renders the params type name, JSON Schema, result type name, and source file in --help', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help']);

    expect(help).toContain('Params: InsertGuestbookEntryParams');
    expect(help).toContain('Params Schema (JSON Schema):');
    expect(help).toContain('Result: InsertGuestbookEntryResult');
    expect(help).toContain('Source: components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts');
  });

  it('emits a JSON Schema that captures required keys and field constraints', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help']);
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
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help']);
    const match = /Params Schema \(JSON Schema\):\n(\{[\s\S]*?\n\})/.exec(help);
    const schema = JSON.parse(match![1]) as {
      readonly properties: Record<string, { readonly anyOf?: readonly unknown[] }>;
    };

    expect(schema.properties.published.anyOf).toEqual([{ type: 'boolean' }, { type: 'null' }]);
    expect(schema.properties.message.anyOf).toEqual([{ type: 'string', maxLength: 200, minLength: 1 }, { type: 'null' }]);
  });

  it('renders the arktype expression instead of JSON Schema when dataHelpFormat=arktype', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help'], 'arktype');

    expect(help).toContain('Params Schema (arktype):');
    expect(help).not.toContain('Params Schema (JSON Schema):');
    expect(help).toContain('guestbook: string >= 1');
    expect(help).toContain('--data-help=jsonschema or --data-help=both');
  });

  it('renders both schema formats when dataHelpFormat=both', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help'], 'both');

    expect(help).toContain('Params Schema (JSON Schema):');
    expect(help).toContain('Params Schema (arktype):');
    // No prompt to switch when both are already shown.
    expect(help).not.toMatch(/--data-help=\w+ or --data-help=both/);
  });

  it('hints at --data-help on JSON Schema (default) help to advertise the arktype form', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help']);

    expect(help).toContain('--data-help=arktype or --data-help=both');
  });

  it('shows the full standard global options block in --help when --data-help is not present', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help']);

    expect(help).toContain('--verbose');
    expect(help).toContain('--dump-dir');
    expect(help).toContain('--pick');
    expect(help).toContain('--pick-all');
  });

  it('hides unrelated global options from --help when --data-help is present', async () => {
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help', '--data-help=arktype']);

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
    const help = await helpFor(['guestbookEntry', 'update-insert', '--help', '--data-help=arktype', '--all-help']);

    expect(help).toMatch(/^\s+(?:-v, )?--verbose\s/m);
    expect(help).toMatch(/^\s+--dump-dir\s/m);
    expect(help).toMatch(/^\s+--pick\s/m);
    expect(help).toMatch(/^\s+--pick-all\s/m);
    // Schema section is still rendered in the requested format.
    expect(help).toContain('Params Schema (arktype):');
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
