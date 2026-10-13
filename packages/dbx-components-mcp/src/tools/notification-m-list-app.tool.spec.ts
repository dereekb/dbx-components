/**
 * Runs `dbx_notification_m_list_app` against the real demo pair (`components/demo-firebase` + `apps/demo-api`) and
 * checks its NotificationTaskBot section. Asserts names, codes and flags, not line numbers.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { notificationListApp } from '@dereekb/dbx-cli/validate';
import { notificationMListAppTool } from './notification-m-list-app.tool.js';

const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');
const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';

let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  process.chdir(WORKSPACE_ROOT);
});

afterAll(() => {
  process.chdir(originalCwd);
});

async function runText(format: 'markdown' | 'json'): Promise<string> {
  const result = await notificationMListAppTool.run({ componentDir: COMPONENT_DIR, apiDir: API_DIR, format });
  expect(result.isError).toBeFalsy();
  return result.content.map((c) => ('text' in c ? c.text : '')).join('\n');
}

describe('dbx_notification_m_list_app on the demo pair', () => {
  it('lists the demo NotificationTaskBot wiring in JSON', async () => {
    const report = JSON.parse(await runText('json')) as notificationListApp.AppNotificationsReport;
    const { taskBot } = report;
    expect(taskBot.inUse).toBe(true);
    expect(taskBot.taskTypesInTaskServiceValidate).toBe(true);
    expect(taskBot.registries[0]).toEqual(expect.objectContaining({ symbolName: 'DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD', wired: true }));
    expect(taskBot.handlers[0].reachable).toBe(true);
    expect(taskBot.repairCalls[0].sourceFile).toBe('src/app/function/notification/notification.schedule.ts');
    expect(taskBot.scripts.map((s) => s.scriptType)).toEqual(['demo_ping', 'demo_ping_required']);
    const flags = { dataTypeSource: 'declared', groupKey: 'ping_reminders', inRegistry: true, inHandlerValidate: true, hasProcessor: true };
    expect(taskBot.scripts[0]).toEqual(expect.objectContaining({ ...flags, allowOwnerOptOut: true }));
    expect(taskBot.scripts[1]).toEqual(expect.objectContaining(flags));
    expect(taskBot.scripts[1].allowOwnerOptOut).toBeUndefined();
  });

  it('renders the NotificationTaskBot scripts in markdown without an info marker', async () => {
    const md = await runText('markdown');
    expect(md).toContain('## NotificationTaskBot scripts (2)');
    expect(md).not.toContain('ℹ️');
  });
});
