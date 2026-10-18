import { buildModelManifestCatalog, MODEL_MANIFEST_INFO_INVALID_INPUT_ERROR_CODE, resolveModelManifestInfoOutput } from '@dereekb/firebase/manifest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { buildInfoCommand, type BuildInfoCommandInput } from './build-info-command';
import { buildCliInfoHints } from './info-utils';
import type { CliEnumManifest, CliModelManifest } from './types';

const MODELS: CliModelManifest = [
  {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    modelGroup: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    description: 'A guestbook that people sign.',
    sourcePackage: 'demo-firebase',
    sourceFile: 'guestbook.ts',
    fields: [{ name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date' }]
  },
  {
    modelType: 'notification',
    modelName: 'Notification',
    modelGroup: 'Notification',
    identityConst: 'notificationIdentity',
    collectionPrefix: 'nbn',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'notification.ts',
    fields: [
      { name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date' },
      { name: 'ts', longName: 'textSendState', optional: false, enumRef: 'NotificationSendState' },
      { name: 'es', longName: 'emailSendState', optional: false, enumRef: 'NotificationSendState' }
    ]
  }
];

const ENUMS: CliEnumManifest = {
  NotificationSendState: { name: 'NotificationSendState', description: 'Send state.', values: [{ name: 'QUEUED', value: 0 }] }
};

const INPUT: BuildInfoCommandInput = { modelManifest: MODELS, enumManifest: ENUMS };

function runWith(argv: readonly string[], input: BuildInfoCommandInput = INPUT): void {
  yargs([...argv])
    .command(buildInfoCommand(input))
    .demandCommand(1)
    .strict()
    .fail(false)
    .exitProcess(false)
    .parseSync();
}

describe('buildInfoCommand()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  function text(): string {
    return stdout.join('');
  }

  function stdoutJson(): any {
    return JSON.parse(text());
  }

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

  it('prints the overview as text and JSON', () => {
    runWith(['info']);
    expect(text()).toContain('2 models, 1 enum.');
    expect(text()).toMatch(/GROUP\s+MODELS/);
    expect(text()).toContain('Enums: NotificationSendState');

    stdout = [];
    runWith(['info', '--json']);
    expect(stdoutJson().data).toMatchObject({ mode: 'overview', totalModels: 2, totalEnums: 1 });
  });

  it('joins positional words into the query', () => {
    runWith(['info', 'NotificationSendState', '--json']);
    const data = stdoutJson().data;
    expect(data.mode).toBe('search');
    expect(data.hits[0]).toMatchObject({ kind: 'enum', enum: 'NotificationSendState' });
  });

  it('narrows with --kind and pages with --limit / --offset', () => {
    runWith(['info', 'created', 'at', '--kind', 'field', '--limit', '1', '--json']);
    const first = stdoutJson().data;
    expect(first.hits.map((x: any) => x.kind)).toEqual(['field']);
    expect(first.total).toBe(2);
    expect(first.nextOffset).toBe(1);

    stdout = [];
    runWith(['info', 'created', 'at', '--kind', 'field', '--limit', '1', '--offset', '1']);
    expect(text()).toContain('Showing 2–2 of 2.');
  });

  it('returns models and their enums for a repeated --model', () => {
    runWith(['info', '--model', 'gb', '--model', 'notification', '--json']);
    const data = stdoutJson().data;
    expect(data.models.map((x: any) => x.modelType)).toEqual(['guestbook', 'notification']);
    expect(data.enums.map((x: any) => x.name)).toEqual(['NotificationSendState']);
  });

  it('returns usedBy for --enum', () => {
    runWith(['info', '--enum', 'NotificationSendState']);
    expect(text()).toContain('Used by:');
    expect(text()).toMatch(/notification\s+ts\s+textSendState/);
  });

  it('exits 1 with MODEL_MANIFEST_INFO_INVALID_INPUT for an invalid combination', () => {
    expect(() => runWith(['info', 'guestbook', '--model', 'gb'])).toThrow(/process\.exit:1/);
    const envelope = stdoutJson();
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe(MODEL_MANIFEST_INFO_INVALID_INPUT_ERROR_CODE);
  });

  it('returns the shared resolver output as the JSON data', () => {
    runWith(['info', '--enum', 'NotificationSendState', '--enum', 'Ghost', '--json']);
    const expected = resolveModelManifestInfoOutput({ catalog: buildModelManifestCatalog({ models: MODELS, enums: ENUMS }), input: { enum: ['NotificationSendState', 'Ghost'] }, hints: buildCliInfoHints(undefined) });
    expect(stdoutJson().data).toEqual(expected);
  });

  it('honours a commandName override in the command and the hints', () => {
    const cmd = buildInfoCommand({ ...INPUT, commandName: 'catalog' });
    expect(cmd.command).toBe('catalog [query..]');

    runWith(['catalog'], { ...INPUT, commandName: 'catalog' });
    expect(text()).toContain('Run `catalog <words>`');
  });
});
