import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs, { type CommandModule } from 'yargs';
import { NotificationDeliveryMethod, NotificationSendType, type FirestoreQueryConstraint, firestoreModelIdentity, notificationTemplateTypeInfoRecord } from '@dereekb/firebase';
import { setCliContext, type CliContext } from '../context/cli.context';
import { type CliFirestoreModels } from '../firestore/firestore.models';
import { type CliNotificationConfig } from './notification.config';
import { buildNotificationModelCommands } from './notification.model-commands';

const profileIdentity = firestoreModelIdentity('profile', 'pr');

const CONFIG: CliNotificationConfig = {
  templateTypeInfoRecord: notificationTemplateTypeInfoRecord([{ type: 'A', name: 'Alpha', description: 'Alpha notification.', notificationModelIdentity: profileIdentity }]),
  manifest: { tasks: [{ type: 'E', symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE', checkpoints: ['part_a', 'part_b'], hasHandler: true, sourceFile: 'example.task.ts' }], templates: [] }
};

const COMMANDS = buildNotificationModelCommands(CONFIG);

const SEND_AT = new Date('2020-01-01T00:00:00.000Z');

const STORED: Record<string, unknown> = {
  'nu/u1': { uid: 'u1', gc: { c: { A: { se: false } }, dm: [] }, dc: { c: {} }, bc: [], b: [], x: [] },
  'nb/pr_u1/nbn/t1': { st: NotificationSendType.TASK_NOTIFICATION, n: { id: 't1', cat: SEND_AT.toISOString(), t: 'E' }, sat: SEND_AT.toISOString(), cat: SEND_AT.toISOString(), a: 1, d: false, tpr: ['part_a'] }
};

interface QueryCall {
  readonly parentKey: unknown;
  readonly constraints: readonly FirestoreQueryConstraint[];
}

const calls: QueryCall[] = [];
const getModelCalls: { readonly modelType: string; readonly key: string }[] = [];

function buildModels(): CliFirestoreModels {
  const decode = (snapshot: { readonly raw: unknown }) => snapshot.raw;
  const pair = (id: string, raw: unknown) => ({ document: { key: `nb/pr_u1/nbn/${id}`, id, converter: { fromFirestore: decode } }, snapshot: { raw } });

  return {
    session: { fromCache: false } as never,
    collections: {},
    // the stub collection carries no `config`, so scope through an app-supplied `collectionForModel`
    binding: {
      collections: () => ({}),
      models: (() => ({})) as never,
      collectionForModel: ({ parentKey }) =>
        ({
          queryDocument: (...constraints: FirestoreQueryConstraint[]) => ({
            getDocSnapshotDataPairs: async () => {
              calls.push({ parentKey, constraints });
              return [
                pair('t1', { st: NotificationSendType.TASK_NOTIFICATION, n: { id: 't1', cat: SEND_AT, t: 'E' }, sat: SEND_AT, cat: SEND_AT, a: 0, d: false, tpr: [] }),
                pair('t2', { st: NotificationSendType.TASK_NOTIFICATION, n: { id: 't2', cat: SEND_AT, t: 'E' }, sat: SEND_AT, cat: SEND_AT, a: 0, d: true, tpr: ['part_a', 'part_b'] }),
                pair('n3', { st: NotificationSendType.SEND_IF_BOX_EXISTS, n: { id: 'n3', cat: SEND_AT, t: 'A' }, sat: SEND_AT, cat: SEND_AT, a: 0, d: false, tpr: [] })
              ];
            }
          })
        }) as never
    },
    models: (() => ({})) as never,
    allTypes: () => ['notification'],
    serviceFor: () => ({ loadModelForKey: (() => undefined) as never, getFirestoreCollection: (() => undefined) as never }),
    modelTypeForCollection: () => 'notification'
  };
}

function buildStubContext(input?: { readonly models?: CliFirestoreModels }): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api' } as never,
    accessToken: 'token',
    callModel: (async () => undefined) as never,
    getModel: (async (modelType: string, key: string) => {
      getModelCalls.push({ modelType, key });
      return { key, data: STORED[key] ?? null };
    }) as never,
    getMultipleModels: (async () => ({ results: [], errors: [] })) as never,
    ...(input?.models ? { getFirestoreModels: async () => input.models as CliFirestoreModels } : {})
  };
}

async function run(command: CommandModule | undefined, argv: readonly string[]): Promise<void> {
  if (command == null) {
    throw new Error('missing command');
  }

  await yargs([...argv])
    .command(command)
    .exitProcess(false)
    .fail((msg: string, err: Error | undefined) => {
      throw err ?? new Error(msg);
    })
    .parseAsync();
}

describe('buildNotificationModelCommands()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls.length = 0;
    getModelCalls.length = 0;
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
    setCliContext(undefined);
  });

  it('keys the leaves by model type', () => {
    expect(Object.keys(COMMANDS)).toEqual(['notificationUser', 'notification']);
    expect(COMMANDS['notificationUser']?.map((x) => x.command)).toEqual(['settings [uidOrKey]']);
    expect(COMMANDS['notification']?.map((x) => x.command)).toEqual(['tasks [box]', 'task <key>']);
  });

  describe('settings', () => {
    const settings = COMMANDS['notificationUser']?.[0];

    it('reads a bare uid as nu/<uid> and prints the settings matrix', async () => {
      setCliContext(buildStubContext());
      await run(settings, ['settings', 'u1']);

      expect(getModelCalls).toEqual([{ modelType: 'notificationUser', key: 'nu/u1' }]);
      expect(stdout.join('')).toMatch(/A\s+Alpha\s+off\s+default \(off\)\s+default \(on\)/);
    });

    it('emits the view model with --json, and the update payloads with --expanded', async () => {
      setCliContext(buildStubContext());
      await run(settings, ['settings', 'nu/u1', '--json', '--expanded']);
      const parsed = JSON.parse(stdout.join(''));

      expect(parsed.meta).toMatchObject({ source: 'api' });
      expect(parsed.data.types[0].cells[NotificationDeliveryMethod.EMAIL]).toMatchObject({ value: false, effective: false, source: 'explicit' });
      expect(parsed.data.howToChange.command).toBe('demo-cli model notificationUser update');
    });
  });

  describe('tasks', () => {
    const tasks = COMMANDS['notification']?.[0];

    it('lists one box newest first, skipping non-tasks', async () => {
      setCliContext(buildStubContext({ models: buildModels() }));
      await run(tasks, ['tasks', 'pr/u1', '--json']);
      const parsed = JSON.parse(stdout.join(''));

      expect(calls).toHaveLength(1);
      expect(calls[0]?.parentKey).toBe('nb/pr_u1');
      // orderBy + limit
      expect(calls[0]?.constraints).toHaveLength(2);
      expect(parsed.data.box).toBe('nb/pr_u1');
      expect(parsed.data.skippedNonTasks).toBe(1);
      expect(parsed.data.tasks.map((x: { key: string; state: string }) => [x.key, x.state])).toEqual([
        ['nb/pr_u1/nbn/t1', 'ready'],
        ['nb/pr_u1/nbn/t2', 'done']
      ]);
    });

    it('applies --state and prints a table', async () => {
      setCliContext(buildStubContext({ models: buildModels() }));
      await run(tasks, ['tasks', '--state', 'pending']);
      const text = stdout.join('');

      expect(calls[0]?.parentKey).toBe('nb/not_not');
      expect(text).toContain('nb/not_not: 1 task (read 3 notifications, 1 not tasks).');
      expect(text).toMatch(/t1\s+E\s+ready\s+2020-01-01T00:00:00.000Z\s+0\/5\s+0\/2 next: part_a/);
      expect(text).not.toMatch(/\bt2\b/);
    });

    it('requires a direct-Firestore binding', async () => {
      setCliContext(buildStubContext());
      await expect(run(tasks, ['tasks', '--json'])).rejects.toThrow('process.exit:1');
      expect(stdout.join('')).toContain('not configured for generic direct-Firestore reads');
    });
  });

  describe('task', () => {
    const task = COMMANDS['notification']?.[1];

    it('reads one task and reports its checkpoint progress', async () => {
      setCliContext(buildStubContext());
      await run(task, ['task', 'nb/pr_u1/nbn/t1', '--json', '--expanded']);
      const parsed = JSON.parse(stdout.join(''));

      expect(getModelCalls).toEqual([{ modelType: 'notification', key: 'nb/pr_u1/nbn/t1' }]);
      expect(parsed.data).toMatchObject({ key: 'nb/pr_u1/nbn/t1', type: 'E', state: 'ready', attempts: 1, remainingCheckpoints: ['part_b'], nextCheckpoint: 'part_b', checkpoints: ['part_a', 'part_b'] });
    });

    it('rejects a key that is not a notification key', async () => {
      setCliContext(buildStubContext());
      await expect(run(task, ['task', 'nb/pr_u1', '--json'])).rejects.toThrow('process.exit:1');
      expect(stdout.join('')).toContain('not a notification key');
      expect(getModelCalls).toHaveLength(0);
    });

    it('fails when the task does not exist', async () => {
      setCliContext(buildStubContext());
      await expect(run(task, ['task', 'nb/pr_u1/nbn/missing', '--json'])).rejects.toThrow('process.exit:1');
      expect(stdout.join('')).toContain('NOTIFICATION_NOT_FOUND');
    });
  });
});
