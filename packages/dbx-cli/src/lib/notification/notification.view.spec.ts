import { describe, expect, it } from 'vitest';
import { NotificationBoxRecipientFlag, NotificationDeliveryMethod, NotificationSendType, firestoreModelIdentity, notificationTemplateTypeInfoRecord, type Notification, type NotificationUser } from '@dereekb/firebase';
import { type CliNotificationManifest } from '../manifest/types';
import { type CliNotificationConfig } from './notification.config';
import { assertCliNotificationKey, notificationTaskTypesView, notificationTaskView, notificationTasksView, notificationTypesView, notificationUserSettingsView, resolveCliNotificationBoxKey } from './notification.view';

const { EMAIL, TEXT, NOTIFICATION_SUMMARY } = NotificationDeliveryMethod;

const profileIdentity = firestoreModelIdentity('profile', 'pr');
const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');

const MANIFEST: CliNotificationManifest = {
  tasks: [
    { type: 'E', symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE', dataInterfaceName: 'ExampleNotificationTaskData', checkpoints: ['part_a', 'part_b', 'part_c'], hasHandler: true, handlerFlowStepCount: 3, sourceFile: 'example.task.ts' },
    { type: 'D', symbolName: 'DELTA_NOTIFICATION_TASK_TYPE', checkpoints: [], hasHandler: false, sourceFile: 'delta.task.ts' }
  ],
  templates: [{ type: 'A', symbolName: 'ALPHA_NOTIFICATION_TEMPLATE_TYPE', factoryFunctionName: 'alphaNotificationTemplate', factoryContentDeliveryMethods: ['e'], sourceFile: 'alpha.ts' }]
};

const CONFIG: CliNotificationConfig = {
  templateTypeInfoRecord: notificationTemplateTypeInfoRecord([
    { type: 'A', name: 'Alpha', description: 'Alpha notification.', notificationModelIdentity: profileIdentity },
    { type: 'B', name: 'Beta', description: 'Beta notification.', notificationModelIdentity: guestbookIdentity, targetModelIdentity: profileIdentity, group: { key: 'gb', name: 'Guestbooks', sortOrder: 1 }, onlySendToExplicitlyEnabledRecipients: true },
    { type: 'H', name: 'Hidden', description: 'Test notification.', notificationModelIdentity: profileIdentity, hideFromUserSettings: true }
  ]),
  manifest: MANIFEST
};

describe('notificationTypesView()', () => {
  it('lists the visible types with each method default, grouped types first', () => {
    const view = notificationTypesView({ config: CONFIG });

    expect(view.deliveryMethods).toEqual([EMAIL, TEXT, NOTIFICATION_SUMMARY]);
    expect(view.types.map((x) => x.type)).toEqual(['B', 'A']);
    expect(view.hiddenCount).toBe(1);

    const alpha = view.types.find((x) => x.type === 'A');
    expect(alpha?.group).toBe('Notifications');
    expect(alpha?.notificationModel).toBe('profile');
    expect(alpha?.defaults).toEqual({ [EMAIL]: true, [TEXT]: false, [NOTIFICATION_SUMMARY]: true });
    expect(alpha?.template).toBeUndefined();

    const beta = view.types.find((x) => x.type === 'B');
    expect(beta?.targetModel).toBe('profile');
    expect(beta?.onlySendToExplicitlyEnabledRecipients).toBe(true);
    expect(beta?.defaults[EMAIL]).toBe(false);
  });

  it('includes and flags the hidden types with all', () => {
    const view = notificationTypesView({ config: { ...CONFIG, hiddenTemplateTypes: ['B'] }, all: true });

    expect(view.hiddenCount).toBe(0);
    expect(view.types.find((x) => x.type === 'H')?.hidden).toBe('hideFromUserSettings');
    expect(view.types.find((x) => x.type === 'B')?.hidden).toBe('hiddenTemplateTypes');
    expect(view.types.find((x) => x.type === 'A')?.hidden).toBeUndefined();
  });

  it('shows a hidden type when it is looked up explicitly', () => {
    const view = notificationTypesView({ config: CONFIG, type: 'H' });
    expect(view.types.map((x) => x.type)).toEqual(['H']);
  });

  it('drops hidden delivery method columns', () => {
    const view = notificationTypesView({ config: { ...CONFIG, hiddenDeliveryMethods: [TEXT] } });
    expect(view.deliveryMethods).toEqual([EMAIL, NOTIFICATION_SUMMARY]);
    expect(view.types[0]?.deliveryMethods).toEqual([EMAIL, NOTIFICATION_SUMMARY]);
  });

  it('adds the manifest template and group key when expanded', () => {
    const alpha = notificationTypesView({ config: CONFIG, expanded: true }).types.find((x) => x.type === 'A');
    expect(alpha?.template?.factoryFunctionName).toBe('alphaNotificationTemplate');
    expect(alpha?.groupKey).toBe('_');
  });
});

describe('notificationTaskTypesView()', () => {
  it('lists the manifest tasks sorted by type', () => {
    const view = notificationTaskTypesView({ manifest: MANIFEST });
    expect(view.tasks.map((x) => x.type)).toEqual(['D', 'E']);
    expect(view.tasks[1]).toEqual({ type: 'E', symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE', checkpoints: ['part_a', 'part_b', 'part_c'], hasHandler: true });
  });

  it('filters by type and adds the source detail when expanded', () => {
    const view = notificationTaskTypesView({ manifest: MANIFEST, type: 'E', expanded: true });
    expect(view.tasks).toHaveLength(1);
    expect(view.tasks[0]?.dataInterfaceName).toBe('ExampleNotificationTaskData');
    expect(view.tasks[0]?.sourceFile).toBe('example.task.ts');
  });
});

describe('notificationUserSettingsView()', () => {
  const notificationUser: Partial<NotificationUser> = {
    uid: 'u1',
    gc: { c: { A: { se: false }, B: { sd: true } }, dm: [TEXT], t: '+12025550123' },
    dc: { c: {} },
    bc: [{ nb: 'pr_u1', i: 0, c: { A: { se: true } }, f: NotificationBoxRecipientFlag.OPT_OUT }],
    b: ['pr_u1'],
    x: [],
    tso: ['+12025550199']
  };

  it('resolves each cell: explicit, type-wide toggle, default and account-wide off', () => {
    const view = notificationUserSettingsView({ config: CONFIG, key: 'nu/u1', notificationUser, cliName: 'demo-cli' });

    expect(view.uid).toBe('u1');
    expect(view.exists).toBe(true);
    expect(view.account).toEqual({ flag: undefined, disabledDeliveryMethods: [TEXT], email: undefined, phone: '+12025550123', textStoppedNumbers: ['+12025550199'] });

    const alpha = view.types.find((x) => x.type === 'A');
    expect(alpha?.cells[EMAIL]).toMatchObject({ value: false, effective: false, source: 'explicit' });
    expect(alpha?.cells[TEXT]).toMatchObject({ disabled: true, effective: false, source: 'disabled' });
    expect(alpha?.cells[NOTIFICATION_SUMMARY]).toMatchObject({ value: null, defaultValue: true, effective: true, source: 'default' });

    const beta = view.types.find((x) => x.type === 'B');
    expect(beta?.cells[EMAIL]).toMatchObject({ value: null, defaultValue: true, effective: true, source: 'master' });

    expect(view.types.find((x) => x.type === 'H')).toBeUndefined();
    expect(view.howToChange).toBeUndefined();
  });

  it('falls back to every default when the NotificationUser does not exist', () => {
    const view = notificationUserSettingsView({ config: CONFIG, key: 'nu/u2', notificationUser: null, cliName: 'demo-cli' });

    expect(view.uid).toBe('u2');
    expect(view.exists).toBe(false);
    expect(view.types.find((x) => x.type === 'A')?.cells[TEXT]).toMatchObject({ value: null, effective: false, source: 'default' });
  });

  it('adds the box configs and the update payloads when expanded', () => {
    const view = notificationUserSettingsView({ config: CONFIG, key: 'nu/u1', notificationUser, cliName: 'demo-cli', expanded: true });

    expect(view.boxes).toEqual([{ nb: 'pr_u1', flag: 'opt-out', removed: false, needsSync: false, types: { A: { [EMAIL]: { value: true, overriddenBy: false }, [TEXT]: { value: null }, [NOTIFICATION_SUMMARY]: { value: null } } } }]);
    expect(view.boxIds).toEqual(['pr_u1']);
    expect(view.howToChange?.command).toBe('demo-cli model notificationUser update');

    const examples = view.howToChange?.examples ?? [];
    expect(examples.map((x) => x.data)).toEqual([
      { key: 'nu/u1', gc: { configs: [{ type: 'B', se: false }] } },
      { key: 'nu/u1', gc: { configs: [{ type: 'B', se: null }] } },
      { key: 'nu/u1', gc: { dm: [TEXT, EMAIL] } },
      { key: 'nu/u1', bc: [{ nb: 'pr_u1', f: NotificationBoxRecipientFlag.OPT_OUT }], resync: true }
    ]);
    expect(examples[0]?.command).toBe(`demo-cli model notificationUser update --data '{"key":"nu/u1","gc":{"configs":[{"type":"B","se":false}]}}'`);
  });
});

describe('notificationTaskView()', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');
  const past = new Date('2026-01-01T11:00:00.000Z');
  const future = new Date('2026-01-01T13:00:00.000Z');

  function task(input: Partial<Notification>): Partial<Notification> {
    return { st: NotificationSendType.TASK_NOTIFICATION, n: { id: 'x', cat: past, t: 'E' }, sat: future, cat: past, a: 0, d: false, tpr: [], ...input };
  }

  it('derives done, ready and scheduled', () => {
    expect(notificationTaskView({ key: 'nb/b/nbn/1', notification: task({ d: true }), now }).state).toBe('done');
    expect(notificationTaskView({ key: 'nb/b/nbn/1', notification: task({ sat: past }), now }).state).toBe('ready');
    expect(notificationTaskView({ key: 'nb/b/nbn/1', notification: task({}), now }).state).toBe('scheduled');
  });

  it('reads API JSON date strings', () => {
    const view = notificationTaskView({ key: 'nb/b/nbn/1', notification: task({ sat: past.toISOString() as never }), now });
    expect(view.sendAt).toEqual(past);
    expect(view.state).toBe('ready');
  });

  it('compares the completed checkpoints against the manifest flow', () => {
    const view = notificationTaskView({ key: 'nb/b/nbn/1', notification: task({ tpr: ['part_a'], a: 2, at: 1 }), manifest: MANIFEST, now });

    expect(view.knownType).toBe(true);
    expect(view.remainingCheckpoints).toEqual(['part_b', 'part_c']);
    expect(view.nextCheckpoint).toBe('part_b');
    expect(view.attempts).toBe(2);
    expect(view.maxAttempts).toBe(5);
    expect(view.checkpointAttempts).toBe(1);
    expect(view.warnings).toEqual([]);
    expect(view.checkpoints).toBeUndefined();
  });

  it('flags a type that is not in the manifest', () => {
    const view = notificationTaskView({ key: 'nb/not_not/nbn/1', notification: task({ n: { id: 'x', cat: past, t: 'SFP' } }), manifest: MANIFEST, now });

    expect(view.knownType).toBe(false);
    expect(view.remainingCheckpoints).toBeUndefined();
    expect(view.warnings[0]).toContain('not in the app');
  });

  it('flags a notification that is not a task', () => {
    const view = notificationTaskView({ key: 'nb/b/nbn/1', notification: task({ st: NotificationSendType.SEND_IF_BOX_EXISTS }), now });
    expect(view.isTask).toBe(false);
    expect(view.warnings[0]).toContain('Not a task');
  });

  it('adds the flow, creator and data when expanded', () => {
    const view = notificationTaskView({ key: 'nb/b/nbn/1', notification: task({ n: { id: 'x', cat: past, t: 'E', cb: 'u1', d: { value: 1 } } }), manifest: MANIFEST, now, expanded: true });
    expect(view.checkpoints).toEqual(['part_a', 'part_b', 'part_c']);
    expect(view.createdBy).toBe('u1');
    expect(view.data).toEqual({ value: 1 });
  });

  it('notificationTasksView() skips non-tasks and applies the type and state filters', () => {
    const notifications = [
      { key: 'nb/b/nbn/1', notification: task({ d: true }) },
      { key: 'nb/b/nbn/2', notification: task({}) },
      { key: 'nb/b/nbn/3', notification: task({ n: { id: 'x', cat: past, t: 'D' } }) },
      { key: 'nb/b/nbn/4', notification: task({ st: NotificationSendType.SEND_IF_BOX_EXISTS }) }
    ];

    const all = notificationTasksView({ box: 'nb/b', notifications, now });
    expect(all.read).toBe(4);
    expect(all.skippedNonTasks).toBe(1);
    expect(all.tasks.map((x) => x.key)).toEqual(['nb/b/nbn/1', 'nb/b/nbn/2', 'nb/b/nbn/3']);

    expect(notificationTasksView({ box: 'nb/b', notifications, now, state: 'pending' }).tasks.map((x) => x.key)).toEqual(['nb/b/nbn/2', 'nb/b/nbn/3']);
    expect(notificationTasksView({ box: 'nb/b', notifications, now, state: 'done' }).tasks.map((x) => x.key)).toEqual(['nb/b/nbn/1']);
    expect(notificationTasksView({ box: 'nb/b', notifications, now, type: 'D' }).tasks.map((x) => x.key)).toEqual(['nb/b/nbn/3']);
  });
});

describe('resolveCliNotificationBoxKey()', () => {
  it('defaults to the framework task box', () => {
    expect(resolveCliNotificationBoxKey(undefined)).toBe('nb/not_not');
    expect(resolveCliNotificationBoxKey('  ')).toBe('nb/not_not');
  });

  it('keeps a box key, prefixes a bare id and converts a model key', () => {
    expect(resolveCliNotificationBoxKey('nb/abc')).toBe('nb/abc');
    expect(resolveCliNotificationBoxKey('abc')).toBe('nb/abc');
    expect(resolveCliNotificationBoxKey('pr/u1')).toBe('nb/pr_u1');
  });
});

describe('assertCliNotificationKey()', () => {
  it('accepts a notification key', () => {
    expect(() => assertCliNotificationKey('nb/pr_u1/nbn/abc')).not.toThrow();
  });

  it('rejects other keys', () => {
    expect(() => assertCliNotificationKey('nb/pr_u1')).toThrow(/not a notification key/);
    expect(() => assertCliNotificationKey('pr/u1/nbn/abc')).toThrow(/not a notification key/);
    expect(() => assertCliNotificationKey('nb//nbn/abc')).toThrow(/not a notification key/);
  });
});
