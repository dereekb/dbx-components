import { type CallToolResult, type Tool } from '@modelcontextprotocol/server';
import { buildMcpToolName, MCP_ALWAYS_LOAD_META_KEY, MCP_DOCS_READ_TOOL_NAME, MODEL_GET_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { type DocsSearchResult } from '@dereekb/firebase-server';
import { guestbookIdentity, type EntryDetailsGuestbookEntryResult } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoAuthorizedUserContextFactory, demoGuestbookContext, demoGuestbookEntryContext, type DemoApiAuthorizedUserTestContextFixture } from '../../../test/fixture';
import { callMcpMethod, callMcpTool, describeMcpMethod, listMcpTools, mcpCompactToolNames, searchMcpMethods } from '../../../test/mcp';
import { DEMO_MCP_API_STATUS_TOOL_NAME, type DemoMcpApiStatus } from './mcp.module';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

/**
 * A user who never finished onboarding: holds no demo role, so only `any` docs are visible to them.
 */
const demoAuthorizedNotOnboardedUserContext = demoAuthorizedUserContextFactory({ onboarded: false });

/**
 * Admin-only methods (declarative `requiredRoles: [admin]`) used to prove hidden methods stay hidden.
 */
const ADMIN_ONLY_TASKBOT_METHODS = ['notificationTaskBot.update.run', 'notificationTaskBot.update.entry'];

/**
 * The lms-gated (per-function `requiredScope: 'lms'`) read invoke.
 */
const LMS_GATED_METHOD = 'guestbookEntry.invoke.allPublishedEntries';

/**
 * Returns the text of a `CallToolResult`'s content blocks.
 *
 * @param result - The tool result.
 * @returns The joined text.
 */
function resultText(result: CallToolResult): string {
  return result.content.map((x) => (x.type === 'text' ? x.text : '')).join('\n');
}

/**
 * Returns the "Did you mean" suggestions half of an unknown-method error (empty when there are none).
 *
 * @param result - The tool result.
 * @returns The suggestions text.
 */
function suggestionsText(result: CallToolResult): string {
  return resultText(result).split('Did you mean')[1] ?? '';
}

/**
 * Runs the documentation search tool and returns the distinct doc ids it found.
 *
 * @param f - The function fixture.
 * @param u - The calling user.
 * @param query - The search query.
 * @returns The distinct doc ids.
 */
async function searchDocIds(f: DemoApiFunctionContextFixture, u: DemoApiAuthorizedUserTestContextFixture, query: string): Promise<Set<string>> {
  const result = await callMcpTool({ f, u, name: mcpCompactToolNames(f).documentation, args: { query, limit: 50 } });
  expect(result.isError).toBeUndefined();
  return new Set((result.structuredContent as unknown as DocsSearchResult).results.map((x) => x.id));
}

/**
 * End-to-end coverage for demo-api's compact, Stripe-like MCP surface (`toolNamePrefix: 'demo'`, compact only):
 * `demo_api_search` → `demo_api_details` → `demo_api_read` / `demo_api_write` / `demo_api_destructive`, the token and
 * documentation tools, and
 * the app-supplied `demo_api_status` tool, all driven through the real dispatch chain.
 *
 * The security invariant under test: the compact tools resolve methods against the caller's VISIBLE view only. A
 * method hidden by a scope or a role is unknown — no details, no kind hint, no suggestion — exactly as if it did not
 * exist, because the callModel dispatch behind the router re-checks only the OIDC scope.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('compact MCP surface', () => {
    describe('admin caller', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        describe('tools/list', () => {
          let tools: ReadonlyArray<Tool>;

          beforeEach(async () => {
            tools = await listMcpTools(f, u);
          });

          it('lists the compact tools under the demo prefix, marked alwaysLoad', () => {
            const names = mcpCompactToolNames(f);
            const byName = new Map(tools.map((x) => [x.name, x]));

            expect(names.search).toBe('demo_api_search');
            expect(names.details).toBe('demo_api_details');
            expect(names.read).toBe('demo_api_read');
            expect(names.write).toBe('demo_api_write');
            expect(names.destructive).toBe('demo_api_destructive');
            expect(names.documentation).toBe('search_demo_documentation');

            for (const name of [names.search, names.details, names.read, names.write, names.destructive]) {
              const tool = byName.get(name);
              expect(tool).toBeDefined();
              expect((tool as { readonly _meta?: Record<string, unknown> })._meta?.[MCP_ALWAYS_LOAD_META_KEY]).toBe(true);
            }

            expect(byName.get(names.read)?.annotations?.readOnlyHint).toBe(true);
            expect(byName.get(names.write)?.annotations).toEqual({ readOnlyHint: false, destructiveHint: false });
            expect(byName.get(names.destructive)?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
          });

          it('never lists a method as its own legacy tool (compact only)', () => {
            const names = new Set(tools.map((x) => x.name));

            expect(names.has(buildMcpToolName(guestbookIdentity.modelType, 'create'))).toBe(false);
            expect(names.has(MODEL_GET_TOOL_NAME)).toBe(false);
          });

          it('answers a call to a legacy tool name with the compact method to use instead', async () => {
            const result = await callMcpTool({ f, u, name: buildMcpToolName(guestbookIdentity.modelType, 'create'), args: { name: 'neverCreated' } });

            expect(result.isError).toBe(true);
            expect(resultText(result)).toContain('It is now a method');
            expect(resultText(result)).toContain(mcpCompactToolNames(f).write);
            expect(resultText(result)).toContain('guestbook.create');
          });

          it('lists the documentation tool and the app-supplied demo_api_status tool', () => {
            const names = new Set(tools.map((x) => x.name));

            expect(names.has(mcpCompactToolNames(f).documentation)).toBe(true);
            expect(names.has(DEMO_MCP_API_STATUS_TOOL_NAME)).toBe(true);
          });

          it('never advertises the same name twice', () => {
            const names = tools.map((x) => x.name);
            expect(new Set(names).size).toBe(names.length);
          });
        });

        describe('search → details → write → read', () => {
          it('finds guestbook.create as a write method', async () => {
            const found = await searchMcpMethods({ f, u, query: 'create guestbook', limit: 20 });
            const entry = found.methods.find((x) => x.method === 'guestbook.create');

            expect(entry).toBeDefined();
            expect(entry?.kind).toBe('write');
            expect(entry?.model).toBe(guestbookIdentity.modelType);
            expect(entry?.params).toContain('name');
          });

          it('describes guestbook.create with its schema, router and legacy alias', async () => {
            const { result, details } = await describeMcpMethod({ f, u, method: 'guestbook.create' });
            const legacyName = buildMcpToolName(guestbookIdentity.modelType, 'create');

            expect(result.isError).toBeUndefined();
            expect(details?.kind).toBe('write');
            expect(details?.invokeWith).toBe(mcpCompactToolNames(f).write);
            expect(details?.tool).toBeUndefined();
            expect(details?.aliases).toContain(legacyName);
            expect(details?.inputSchema).toMatchObject({ properties: { name: expect.anything() } });
          });

          it('resolves a legacy tool name as an alias of the method', async () => {
            const { details } = await describeMcpMethod({ f, u, method: buildMcpToolName(guestbookIdentity.modelType, 'create') });
            expect(details?.method).toBe('guestbook.create');
          });

          it('creates a guestbook through the write tool, then reads it back through the read tool', async () => {
            const created = await callMcpMethod({ f, u, kind: 'write', method: 'guestbook.create', params: { name: 'compactFlow' } });
            expect(created.isError).toBeUndefined();

            const createdKey = (created.structuredContent as { readonly modelKeys: readonly string[] }).modelKeys[0];
            expect(createdKey).toBeDefined();

            const read = await callMcpMethod({ f, u, kind: 'read', method: MODEL_GET_TOOL_NAME, params: { modelType: guestbookIdentity.modelType, keys: [createdKey] } });
            expect(read.isError).toBeUndefined();

            const structured = read.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string; readonly data: { readonly name: string } }> };
            expect(structured.results).toHaveLength(1);
            expect(structured.results[0].data.name).toBe('compactFlow');
          });

          it('accepts params sent as a JSON object string', async () => {
            const created = await callMcpMethod({ f, u, kind: 'write', method: 'guestbook.create', params: { name: 'compactJson' } });
            const createdKey = (created.structuredContent as { readonly modelKeys: readonly string[] }).modelKeys[0];

            const read = await callMcpMethod({ f, u, kind: 'read', method: MODEL_GET_TOOL_NAME, params: JSON.stringify({ modelType: guestbookIdentity.modelType, keys: [createdKey] }) });
            expect(read.isError).toBeUndefined();
          });
        });

        describe('read / write / destructive permission boundary', () => {
          it('rejects a write method called through the read tool, naming the write tool', async () => {
            const result = await callMcpMethod({ f, u, kind: 'read', method: 'guestbook.create', params: { name: 'neverCreated' } });

            expect(result.isError).toBe(true);
            expect(resultText(result)).toContain('is a write method');
            expect(resultText(result)).toContain(mcpCompactToolNames(f).write);
          });

          it('rejects a read method called through the write tool, naming the read tool', async () => {
            const result = await callMcpMethod({ f, u, kind: 'write', method: MODEL_GET_TOOL_NAME, params: { modelType: guestbookIdentity.modelType, keys: ['guestbook/missing'] } });

            expect(result.isError).toBe(true);
            expect(resultText(result)).toContain('is a read method');
            expect(resultText(result)).toContain(mcpCompactToolNames(f).read);
          });

          it('rejects a destructive method called through the write tool before dispatch, naming the destructive tool', async () => {
            const result = await callMcpMethod({ f, u, kind: 'write', method: 'profile.delete', params: { key: 'profile/none' } });

            expect(result.isError).toBe(true);
            expect(resultText(result)).toContain('is a destructive method');
            expect(resultText(result)).toContain(mcpCompactToolNames(f).destructive);
          });

          it('rejects a write method called through the destructive tool, naming the write tool', async () => {
            const result = await callMcpMethod({ f, u, kind: 'destructive', method: 'guestbook.create', params: { name: 'neverCreated' } });

            expect(result.isError).toBe(true);
            expect(resultText(result)).toContain('is a write method');
            expect(resultText(result)).toContain(mcpCompactToolNames(f).write);
          });

          it('refuses a call that sets an escalating param through the write tool, naming the param', async () => {
            const names = mcpCompactToolNames(f);
            const probe = await callMcpMethod({ f, u, kind: 'write', method: 'notificationUser.invoke.healthCheck', params: { key: `notificationUser/${u.uid}`, sendProbe: true } });
            const restart = await callMcpMethod({ f, u, kind: 'write', method: 'storageFile.update.process', params: { key: 'storageFile/missing', forceRestartProcessing: true } });

            expect(probe.isError).toBe(true);
            expect(resultText(probe)).toContain('`sendProbe`');
            expect(resultText(probe)).toContain(names.destructive);
            expect(restart.isError).toBe(true);
            expect(resultText(restart)).toContain('`forceRestartProcessing`');
          });

          it('lists destructive methods, including one a param makes destructive', async () => {
            const found = await searchMcpMethods({ f, u, query: '', kind: 'destructive', limit: 50 });
            const ids = found.methods.map((x) => x.method);
            const healthCheck = found.methods.find((x) => x.method === 'notificationUser.invoke.healthCheck');

            expect(ids).toContain('profile.delete');
            expect(ids).not.toContain('guestbook.create');
            expect(healthCheck?.escalatingParams).toEqual({ sendProbe: 'destructive' });
          });

          it('classifies the mcp.readOnly invokes as read methods', async () => {
            const entryDetails = await describeMcpMethod({ f, u, method: 'guestbookEntry.invoke.entryDetails' });
            const allPublished = await describeMcpMethod({ f, u, method: LMS_GATED_METHOD });

            expect(entryDetails.details?.kind).toBe('read');
            expect(entryDetails.details?.annotations?.readOnlyHint).toBe(true);
            expect(allPublished.details?.kind).toBe('read');
          });

          it('keeps notificationUser.invoke.healthCheck a write method whose `sendProbe` makes a call destructive', async () => {
            const names = mcpCompactToolNames(f);
            const { details } = await describeMcpMethod({ f, u, method: 'notificationUser.invoke.healthCheck' });
            const sendProbeSchema = (details?.inputSchema as { readonly properties?: Record<string, { readonly description?: string }> } | undefined)?.properties?.['sendProbe'];

            expect(details?.kind).toBe('write');
            expect(details?.invokeWith).toBe(names.write);
            expect(details?.escalatingParams?.['sendProbe']).toEqual({ kind: 'destructive', invokeWith: names.destructive, hints: { openWorld: true } });
            expect(sendProbeSchema?.description).toContain(names.destructive);
            expect(details?.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: true });
          });

          describe('readOnly invoke through the read tool', () => {
            demoGuestbookContext({ f, name: 'CompactReadBook', published: true }, (g) => {
              demoGuestbookEntryContext({ f, u, g, published: true }, (e) => {
                it('runs guestbookEntry.invoke.entryDetails through the read tool', async () => {
                  const result = await callMcpMethod({ f, u, kind: 'read', method: 'guestbookEntry.invoke.entryDetails', params: { key: e.documentKey } });
                  expect(result.isError).toBeUndefined();

                  const structured = result.structuredContent as unknown as EntryDetailsGuestbookEntryResult;
                  expect(structured.key).toBe(e.documentKey);
                  expect(structured.published).toBe(true);
                });
              });
            });
          });
        });

        describe('admin-only methods (positive control)', () => {
          it('describes and finds the admin-only taskbot methods for an admin', async () => {
            const found = await searchMcpMethods({ f, u, query: '', model: 'notificationTaskBot', limit: 50 });
            const ids = found.methods.map((x) => x.method);

            for (const method of ADMIN_ONLY_TASKBOT_METHODS) {
              expect(ids).toContain(method);
              const { details } = await describeMcpMethod({ f, u, method });
              expect(details?.kind).toBe('destructive');
            }
          });

          it('describes the run trigger param of notificationTaskBot.update.run', async () => {
            const { details } = await describeMcpMethod({ f, u, method: 'notificationTaskBot.update.run' });
            const inputSchema = details?.inputSchema as { readonly properties?: Record<string, unknown>; readonly required?: readonly string[] };

            expect(details?.model?.type).toBe('notificationTaskBot');
            expect(inputSchema.required).toEqual(expect.arrayContaining(['i', 'key']));
            expect(inputSchema.properties?.['trigger']).toBeDefined();
          });
        });

        describe('app-supplied tool', () => {
          it('runs demo_api_status as its own tool', async () => {
            const result = await callMcpTool({ f, u, name: DEMO_MCP_API_STATUS_TOOL_NAME, args: {} });
            expect(result.isError).toBeUndefined();

            const status = result.structuredContent as unknown as DemoMcpApiStatus;
            expect(status.app).toBe('demo-api');
            expect(status.uid).toBe(u.uid);
          });

          it('runs demo_api_status as a read method (expose: both)', async () => {
            const found = await searchMcpMethods({ f, u, query: 'api status', limit: 20 });
            expect(found.methods.find((x) => x.method === DEMO_MCP_API_STATUS_TOOL_NAME)?.kind).toBe('read');

            const result = await callMcpMethod({ f, u, kind: 'read', method: DEMO_MCP_API_STATUS_TOOL_NAME });
            expect(result.isError).toBeUndefined();
            expect((result.structuredContent as unknown as DemoMcpApiStatus).uid).toBe(u.uid);
          });
        });

        describe('documentation tool', () => {
          it('finds the admin, user and any docs for an admin', async () => {
            const ids = await searchDocIds(f, u, 'guestbook');

            expect(ids.has('admin/managing-guestbooks')).toBe(true);
            expect(ids.has('guestbook/signing')).toBe(true);
          });

          it('finds the user-audience task bot doc', async () => {
            const ids = await searchDocIds(f, u, 'task bot opt out');
            expect(ids.has('notification/task-bots')).toBe(true);
          });

          it('reads an admin doc through docs-read on the read tool', async () => {
            const result = await callMcpMethod({ f, u, kind: 'read', method: MCP_DOCS_READ_TOOL_NAME, params: { id: 'admin/managing-guestbooks' } });

            expect(result.isError).toBeUndefined();
            expect((result.structuredContent as { readonly content: string }).content).toContain('Moderating entries');
          });
        });
      });
    });

    describe('non-admin caller', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        it('is offered the compact read, write and destructive tools (positive control)', async () => {
          const names = new Set((await listMcpTools(f, u)).map((x) => x.name));
          const compactNames = mcpCompactToolNames(f);

          expect(names.has(compactNames.search)).toBe(true);
          expect(names.has(compactNames.read)).toBe(true);
          expect(names.has(compactNames.write)).toBe(true);
          expect(names.has(compactNames.destructive)).toBe(true);
        });

        it('never finds the admin-only taskbot methods through search', async () => {
          const found = await searchMcpMethods({ f, u, query: 'notification task bot run entry', limit: 50 });
          const ids = found.methods.map((x) => x.method);

          for (const method of ADMIN_ONLY_TASKBOT_METHODS) {
            expect(ids).not.toContain(method);
          }
        });

        it('treats an admin-only method as unknown: no details, no kind hint, no suggestion', async () => {
          for (const method of ADMIN_ONLY_TASKBOT_METHODS) {
            const { result } = await describeMcpMethod({ f, u, method });

            expect(result.isError).toBe(true);
            expect(resultText(result)).toContain('Unknown method');

            for (const hidden of ADMIN_ONLY_TASKBOT_METHODS) {
              expect(suggestionsText(result)).not.toContain(hidden);
            }
          }
        });

        it('cannot run an admin-only method through the destructive tool', async () => {
          const result = await callMcpMethod({ f, u, kind: 'destructive', method: 'notificationTaskBot.update.run', params: { key: 'notificationTaskBot/missing' } });

          expect(result.isError).toBe(true);
          expect(resultText(result)).toContain('Unknown method');
          expect(resultText(result)).not.toContain('is a destructive method');
        });

        describe('documentation tool', () => {
          it('finds the user doc but never the admin doc', async () => {
            const ids = await searchDocIds(f, u, 'guestbook');

            expect(ids.has('guestbook/signing')).toBe(true);
            expect(ids.has('admin/managing-guestbooks')).toBe(false);
          });

          it('finds the user-audience task bot doc', async () => {
            const ids = await searchDocIds(f, u, 'task bot opt out');
            expect(ids.has('notification/task-bots')).toBe(true);
          });

          it('refuses to read the admin doc exactly as it refuses a missing doc', async () => {
            const hidden = await callMcpMethod({ f, u, kind: 'read', method: MCP_DOCS_READ_TOOL_NAME, params: { id: 'admin/managing-guestbooks' } });
            const missing = await callMcpMethod({ f, u, kind: 'read', method: MCP_DOCS_READ_TOOL_NAME, params: { id: 'admin/does-not-exist' } });

            expect(hidden.isError).toBe(true);
            expect(missing.isError).toBe(true);
            expect(resultText(hidden).replace('admin/managing-guestbooks', '<id>')).toBe(resultText(missing).replace('admin/does-not-exist', '<id>'));
          });
        });
      });
    });

    describe('OIDC caller without the lms scope', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        const WITHOUT_LMS = 'model.read model.invoke';
        const WITH_LMS = `${WITHOUT_LMS} lms`;

        it('sees the lms-gated read invoke once it holds lms (positive control)', async () => {
          const { details } = await describeMcpMethod({ f, u, method: LMS_GATED_METHOD, scopes: WITH_LMS });
          expect(details?.kind).toBe('read');
        });

        it('treats the lms-gated method as unknown without lms', async () => {
          const { result } = await describeMcpMethod({ f, u, method: LMS_GATED_METHOD, scopes: WITHOUT_LMS });
          const called = await callMcpMethod({ f, u, kind: 'read', method: LMS_GATED_METHOD, params: { limit: 10 }, scopes: WITHOUT_LMS });
          const found = await searchMcpMethods({ f, u, query: 'all published entries', limit: 50, scopes: WITHOUT_LMS });

          expect(result.isError).toBe(true);
          expect(resultText(result)).toContain('Unknown method');
          expect(called.isError).toBe(true);
          expect(resultText(called)).toContain('Unknown method');
          expect(found.methods.map((x) => x.method)).not.toContain(LMS_GATED_METHOD);
        });
      });
    });

    describe('caller who never finished onboarding', () => {
      demoAuthorizedNotOnboardedUserContext({ f }, (u) => {
        it('is offered the documentation tool for the `any` docs', async () => {
          const names = new Set((await listMcpTools(f, u)).map((x) => x.name));
          expect(names.has(mcpCompactToolNames(f).documentation)).toBe(true);
        });

        it('finds only the `any` docs', async () => {
          const ids = await searchDocIds(f, u, 'guestbook');

          expect(ids.has('getting-started')).toBe(true);
          expect(ids.has('guestbook/signing')).toBe(false);
          expect(ids.has('admin/managing-guestbooks')).toBe(false);
        });

        it('never finds the user-audience task bot doc', async () => {
          const ids = await searchDocIds(f, u, 'task bot opt out');
          expect(ids.has('notification/task-bots')).toBe(false);
        });
      });
    });
  });
});
