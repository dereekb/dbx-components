import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { NotificationDeliveryMethod, firestoreModelIdentity, notificationTemplateTypeInfoRecord } from '@dereekb/firebase';
import { type CliNotificationManifest } from '../manifest/types';
import { createNotificationCommand } from './notification.command.factory';
import { type CliNotificationConfig } from './notification.config';

const profileIdentity = firestoreModelIdentity('profile', 'pr');

const MANIFEST: CliNotificationManifest = {
  tasks: [{ type: 'E', symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE', dataInterfaceName: 'ExampleNotificationTaskData', checkpoints: ['part_a', 'part_b'], hasHandler: true, sourceFile: 'example.task.ts' }],
  templates: [{ type: 'A', symbolName: 'ALPHA_NOTIFICATION_TEMPLATE_TYPE', factoryContentDeliveryMethods: ['e'], sourceFile: 'alpha.ts' }]
};

const CONFIG: CliNotificationConfig = {
  templateTypeInfoRecord: notificationTemplateTypeInfoRecord([
    { type: 'A', name: 'Alpha', description: 'Alpha notification.', notificationModelIdentity: profileIdentity },
    { type: 'H', name: 'Hidden', description: 'Test notification.', notificationModelIdentity: profileIdentity, hideFromUserSettings: true }
  ]),
  manifest: MANIFEST
};

async function run(config: CliNotificationConfig, argv: readonly string[]): Promise<void> {
  await yargs([...argv])
    .command(createNotificationCommand(config))
    .exitProcess(false)
    .fail((msg: string, err: Error | undefined) => {
      throw err ?? new Error(msg);
    })
    .parseAsync();
}

describe('createNotificationCommand()', () => {
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

  it('honours a command-name override', () => {
    expect(createNotificationCommand({ ...CONFIG, commandName: 'notif' }).command).toBe('notif');
  });

  describe('types', () => {
    it('prints a compact table by default', async () => {
      await run(CONFIG, ['notification', 'types']);
      const text = stdout.join('');

      expect(text).toContain('1 notification type (1 hidden, pass --all to include them).');
      expect(text).toMatch(/TYPE\s+NAME\s+GROUP\s+EMAIL\s+TEXT\s+SUMMARY/);
      expect(text).toMatch(/A\s+Alpha\s+Notifications\s+on\s+off\s+on/);
      expect(text).not.toContain('Hidden');
      expect(text).not.toContain('always');
    });

    it('prints always for a forced delivery method', async () => {
      const config: CliNotificationConfig = { ...CONFIG, templateTypeInfoRecord: notificationTemplateTypeInfoRecord([{ type: 'F', name: 'Forced', description: 'Forced notification.', notificationModelIdentity: profileIdentity, forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL] }]) };
      await run(config, ['notification', 'types']);
      const text = stdout.join('');

      expect(text).toContain('always means the method is always on and cannot be changed');
      expect(text).toMatch(/F\s+Forced\s+Notifications\s+always\s+-\s+-/);
    });

    it('prints the always on line with --expanded', async () => {
      const config: CliNotificationConfig = { ...CONFIG, templateTypeInfoRecord: notificationTemplateTypeInfoRecord([{ type: 'F', name: 'Forced', description: 'Forced notification.', notificationModelIdentity: profileIdentity, forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL] }]) };
      await run(config, ['notification', 'types', '--expanded']);
      expect(stdout.join('')).toContain('always on: email');
    });

    it('prints the full detail with --expanded', async () => {
      await run(CONFIG, ['notification', 'types', '--expanded', '--all']);
      const text = stdout.join('');

      expect(text).toContain('A — Alpha  [Notifications]');
      expect(text).toContain('notification model: profile');
      expect(text).toContain('template: ALPHA_NOTIFICATION_TEMPLATE_TYPE');
      expect(text).toContain('hidden: hideFromUserSettings');
    });

    it('emits the compact view model with --json', async () => {
      await run(CONFIG, ['notification', 'types', '--json']);
      const parsed = JSON.parse(stdout.join(''));

      expect(parsed.ok).toBe(true);
      expect(parsed.data.hiddenCount).toBe(1);
      expect(parsed.data.types).toEqual([{ type: 'A', name: 'Alpha', description: 'Alpha notification.', group: 'Notifications', notificationModel: 'profile', deliveryMethods: ['e', 't', 'n'], defaults: { e: true, t: false, n: true } }]);
    });

    it('emits the expanded view model with --json --expanded', async () => {
      await run(CONFIG, ['notification', 'types', 'A', '--json', '--expanded']);
      const parsed = JSON.parse(stdout.join(''));
      expect(parsed.data.types[0].template.symbolName).toBe('ALPHA_NOTIFICATION_TEMPLATE_TYPE');
    });

    it('fails on an unknown type', async () => {
      await expect(run(CONFIG, ['notification', 'types', 'Z', '--json'])).rejects.toThrow('process.exit:1');
      expect(stdout.join('')).toContain('NOTIFICATION_TYPE_NOT_FOUND');
    });
  });

  describe('task-types', () => {
    it('prints a compact table by default', async () => {
      await run(CONFIG, ['notification', 'task-types']);
      expect(stdout.join('')).toMatch(/E\s+EXAMPLE_NOTIFICATION_TASK_TYPE\s+yes\s+part_a > part_b/);
    });

    it('prints the full detail with --expanded', async () => {
      await run(CONFIG, ['notification', 'task-types', 'E', '--expanded']);
      const text = stdout.join('');
      expect(text).toContain('data: ExampleNotificationTaskData');
      expect(text).toContain('checkpoints: 1. part_a  2. part_b');
    });

    it('emits the view model with --json', async () => {
      await run(CONFIG, ['notification', 'task-types', '--json']);
      const parsed = JSON.parse(stdout.join(''));
      expect(parsed.data.tasks).toEqual([{ type: 'E', symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE', checkpoints: ['part_a', 'part_b'], hasHandler: true }]);
    });

    it('fails with a wiring hint when there is no manifest', async () => {
      await expect(run({ ...CONFIG, manifest: undefined }, ['notification', 'task-types', '--json'])).rejects.toThrow('process.exit:1');
      expect(stdout.join('')).toContain('NOTIFICATION_MANIFEST_MISSING');
    });
  });
});
