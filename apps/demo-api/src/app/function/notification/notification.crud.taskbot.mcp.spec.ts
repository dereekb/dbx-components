import { notificationTaskBotIdentity } from '@dereekb/firebase';
import { mcpMethodIdForDispatch, MODEL_ROLES_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { MS_IN_HOUR } from '@dereekb/util';
import { DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
import { type DemoApiAuthorizedUserTestContextFixture, type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { callMcpMethod, describeMcpMethod, searchMcpMethods } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Shape of the `model-roles` structured response.
 */
interface RolesResponse {
  readonly results: ReadonlyArray<{ readonly key: string; readonly exists: boolean; readonly fullAccess: boolean; readonly roles: ReadonlyArray<string> }>;
}

/**
 * MCP coverage for the NotificationTaskBot owner opt-outs and the admin entry method's data patch.
 *
 * The bot's owner is granted ONLY the `optOut` role (never `read`), and the admin-only `update.entry` / `update.run`
 * methods are hidden from non-admins, while the owner-facing `read.optOuts` / `update.optOut` methods stay visible.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  const modelType = notificationTaskBotIdentity.modelType;
  const entryMethod = mcpMethodIdForDispatch({ modelType, call: 'update', specifier: 'entry' });
  const runMethod = mcpMethodIdForDispatch({ modelType, call: 'update', specifier: 'run' });
  const readOptOutsMethod = mcpMethodIdForDispatch({ modelType, call: 'read', specifier: 'optOuts' });
  const updateOptOutMethod = mcpMethodIdForDispatch({ modelType, call: 'update', specifier: 'optOut' });

  /**
   * Returns the notificationTaskBot method ids visible to the caller through the compact search tool.
   *
   * @param u - The calling user.
   * @returns The visible method ids.
   */
  async function visibleTaskBotMethods(u: DemoApiAuthorizedUserTestContextFixture): Promise<Set<string>> {
    const found = await searchMcpMethods({ f, u, query: '', model: modelType, limit: 50 });
    return new Set(found.methods.map((x) => x.method));
  }

  demoAuthorizedUserContext({ f }, (u) => {
    demoProfileContext({ f, u }, (p) => {
      demoNotificationTaskBotContext({ f, for: p, owner: p, entries: [{ entryId: DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, data: { iv: MS_IN_HOUR } }] }, (ntb) => {
        it('grants the owner exactly the optOut role', async () => {
          const result = await callMcpMethod({ f, u, kind: 'read', method: MODEL_ROLES_TOOL_NAME, params: { modelType: notificationTaskBotIdentity.modelType, keys: [ntb.documentKey] } });

          expect(result.isError).toBeUndefined();
          const structured = result.structuredContent as unknown as RolesResponse;
          expect(structured.results[0]).toEqual({ key: ntb.documentKey, exists: true, fullAccess: false, roles: ['optOut'] });
        });

        demoAuthorizedUserAdminContext({ f }, (au) => {
          describe('entry method data patch', () => {
            it('advertises updateData on the entry method', async () => {
              const { details } = await describeMcpMethod({ f, u: au, method: entryMethod });
              const inputSchema = details?.inputSchema as { readonly properties?: Record<string, unknown> };

              expect(inputSchema.properties?.['updateData']).toBeDefined();
            });

            it('patches entry data through the entry method', async () => {
              const result = await callMcpMethod({ f, u: au, kind: 'destructive', method: entryMethod, params: { key: ntb.documentKey, i: DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, updateData: { pa: 5 } } });
              const entry = await ntb.assertEntry();

              expect(result.isError).toBeUndefined();
              expect(entry.d?.pa).toBe(5);
            });

            it('reports a refused patch as a tool error naming the problem', async () => {
              const result = await callMcpMethod({ f, u: au, kind: 'destructive', method: entryMethod, params: { key: ntb.documentKey, i: DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, updateData: { iv: -5 } } });

              expect(result.isError).toBe(true);
              expect(JSON.stringify(result.content)).toContain('iv');
            });
          });
        });
      });

      describe('compact search', () => {
        it('finds the opt-out methods but hides the admin-only entry and run methods from a non-admin', async () => {
          const names = await visibleTaskBotMethods(u);

          expect(names.has(readOptOutsMethod)).toBe(true);
          expect(names.has(updateOptOutMethod)).toBe(true);
          expect(names.has(entryMethod)).toBe(false);
          expect(names.has(runMethod)).toBe(false);
        });

        demoAuthorizedUserAdminContext({ f }, (au) => {
          it('finds the entry and run methods for an admin', async () => {
            const names = await visibleTaskBotMethods(au);

            expect(names.has(entryMethod)).toBe(true);
            expect(names.has(runMethod)).toBe(true);
            expect(names.has(readOptOutsMethod)).toBe(true);
          });
        });
      });
    });
  });
});
