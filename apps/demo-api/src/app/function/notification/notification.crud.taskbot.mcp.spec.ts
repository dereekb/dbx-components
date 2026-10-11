import { notificationTaskBotIdentity } from '@dereekb/firebase';
import { buildMcpToolName, MODEL_ROLES_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { MS_IN_HOUR } from '@dereekb/util';
import { DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { callMcpTool, listMcpTools } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Shape of the `model-roles` structured response.
 */
interface RolesResponse {
  readonly results: ReadonlyArray<{ readonly key: string; readonly exists: boolean; readonly fullAccess: boolean; readonly roles: ReadonlyArray<string> }>;
}

/**
 * MCP coverage for the NotificationTaskBot owner opt-outs.
 *
 * The bot's owner is granted ONLY the `optOut` role (never `read`), and the admin-only `update:entry` / `update:run`
 * tools are hidden from non-admins, while the owner-facing `read:optOuts` / `update:optOut` tools stay listed.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  const entryToolName = buildMcpToolName(notificationTaskBotIdentity.modelType, 'update', 'entry');
  const runToolName = buildMcpToolName(notificationTaskBotIdentity.modelType, 'update', 'run');
  const readOptOutsToolName = buildMcpToolName(notificationTaskBotIdentity.modelType, 'read', 'optOuts');
  const updateOptOutToolName = buildMcpToolName(notificationTaskBotIdentity.modelType, 'update', 'optOut');

  demoAuthorizedUserContext({ f }, (u) => {
    demoProfileContext({ f, u }, (p) => {
      demoNotificationTaskBotContext({ f, for: p, owner: p, entries: [{ entryId: DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, data: { iv: MS_IN_HOUR } }] }, (ntb) => {
        it('grants the owner exactly the optOut role', async () => {
          const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: notificationTaskBotIdentity.modelType, keys: [ntb.documentKey] } });

          expect(result.isError).toBeUndefined();
          const structured = result.structuredContent as unknown as RolesResponse;
          expect(structured.results[0]).toEqual({ key: ntb.documentKey, exists: true, fullAccess: false, roles: ['optOut'] });
        });
      });

      describe('tools/list', () => {
        it('lists the opt-out tools but hides the admin-only entry and run tools from a non-admin', async () => {
          const names = new Set((await listMcpTools(f, u)).map((t) => t.name));

          expect(names.has(readOptOutsToolName)).toBe(true);
          expect(names.has(updateOptOutToolName)).toBe(true);
          expect(names.has(entryToolName)).toBe(false);
          expect(names.has(runToolName)).toBe(false);
        });

        demoAuthorizedUserAdminContext({ f }, (au) => {
          it('lists the entry and run tools for an admin', async () => {
            const names = new Set((await listMcpTools(f, au)).map((t) => t.name));

            expect(names.has(entryToolName)).toBe(true);
            expect(names.has(runToolName)).toBe(true);
            expect(names.has(readOptOutsToolName)).toBe(true);
          });
        });
      });
    });
  });
});
