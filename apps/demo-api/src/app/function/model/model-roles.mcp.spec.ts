import { MODEL_ROLES_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { guestbookIdentity, guestbookEntryIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext } from '../../../test/fixture';
import { callMcpTool, callMcpToolAnonymous, listMcpTools } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Shape of the `model-roles` structured response.
 */
interface RolesResponse {
  readonly uid?: string;
  readonly targeted: boolean;
  readonly results: ReadonlyArray<{ readonly key: string; readonly exists: boolean; readonly fullAccess: boolean; readonly roles: ReadonlyArray<string> }>;
  readonly errors: ReadonlyArray<{ readonly key: string; readonly message: string }>;
}

/**
 * Integration coverage for the built-in `model-roles` MCP tool in apps/demo-api.
 *
 * The tool lives in `@dereekb/firebase-server/mcp` but the answers come from the demo app's real
 * `roleMapForModel()` delegates, so these exercise the full path (auth → makeModelContext →
 * roleMapForKey) against the demo guestbook rules, which conveniently cover every output shape:
 *
 * - A published guestbook grants `read` to any caller.
 * - An unpublished one grants a non-admin nothing — the `exists: true, roles: []` case that the tool
 *   exists to distinguish from a missing document (`exists: false, roles: []`).
 * - `grantFullAccessIfAdmin` short-circuits for an admin — the `fullAccess: true` case.
 *
 * Unlike `model-get`, resolving roles never requires holding them, so no caller here is granted the
 * admin role just to make the call succeed.
 *
 * `uid` targeting is gated by the app-supplied `MCP_MODEL_ROLES_TARGET_UID_PREDICATE`, which the demo
 * app wires to an admin check in `DemoMcpDependencyModule`.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserAdminContext({ f }, (au) => {
    demoAuthorizedUserContext({ f }, (u) => {
      describe('tools/list', () => {
        it('exposes model-roles with readOnly metadata', async () => {
          const tools = await listMcpTools(f, u);
          const tool = tools.find((t) => t.name === MODEL_ROLES_TOOL_NAME);
          expect(tool).toBeDefined();
          expect(tool?.description).toContain('roles');
          expect(tool?.inputSchema).toMatchObject({ type: 'object' });
          expect(tool?.annotations).toMatchObject({ readOnlyHint: true });
        });
      });

      describe(MODEL_ROLES_TOOL_NAME, () => {
        demoGuestbookContext({ f, name: 'RolesPublished', published: true }, (published) => {
          demoGuestbookContext({ f, name: 'RolesUnpublished', published: false }, (unpublished) => {
            it('resolves the read role a published guestbook grants every caller', async () => {
              const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [published.documentKey] } });

              expect(result.isError).toBeUndefined();
              const structured = result.structuredContent as unknown as RolesResponse;
              expect(structured.targeted).toBe(false);
              expect(structured.uid).toBe(u.uid);
              expect(structured.errors).toHaveLength(0);
              expect(structured.results).toHaveLength(1);
              expect(structured.results[0]).toEqual({ key: published.documentKey, exists: true, fullAccess: false, roles: ['read'] });
            });

            it('promotes a bare id to <collectionName>/<id> for a root model', async () => {
              const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [published.documentId] } });

              expect(result.isError).toBeUndefined();
              const structured = result.structuredContent as unknown as RolesResponse;
              expect(structured.results[0].key).toBe(`${guestbookIdentity.collectionName}/${published.documentId}`);
              expect(structured.results[0].roles).toEqual(['read']);
            });

            // The headline distinction: both come back with roles: [], and `exists` is the only thing
            // that separates "the document is not there" from "it is there and you may not touch it".
            it('separates an existing-but-inaccessible document from a missing one', async () => {
              const missingKey = `${guestbookIdentity.collectionName}/definitely-missing`;
              const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [unpublished.documentKey, missingKey] } });

              expect(result.isError).toBeUndefined();
              const structured = result.structuredContent as unknown as RolesResponse;
              // a missing document is NOT an error
              expect(structured.errors).toHaveLength(0);

              const forbidden = structured.results.find((x) => x.key === unpublished.documentKey);
              expect(forbidden).toEqual({ key: unpublished.documentKey, exists: true, fullAccess: false, roles: [] });

              const missing = structured.results.find((x) => x.key === missingKey);
              // REGRESSION: a missing document resolves through noAccessRoleMap() (`{ __EMPTY__: true }`),
              // whose marker key must not surface as a granted role name.
              expect(missing).toEqual({ key: missingKey, exists: false, fullAccess: false, roles: [] });
            });

            it('reports an admin short-circuit as fullAccess rather than an enumerated set', async () => {
              const result = await callMcpTool({ f, u: au, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [unpublished.documentKey] } });

              expect(result.isError).toBeUndefined();
              const structured = result.structuredContent as unknown as RolesResponse;
              expect(structured.results[0]).toEqual({ key: unpublished.documentKey, exists: true, fullAccess: true, roles: [] });
            });

            it('resolves a batch of keys in one call', async () => {
              const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [published.documentKey, unpublished.documentKey] } });

              expect(result.isError).toBeUndefined();
              const structured = result.structuredContent as unknown as RolesResponse;
              expect(structured.results).toHaveLength(2);
              expect(structured.results.find((x) => x.key === published.documentKey)?.roles).toEqual(['read']);
              expect(structured.results.find((x) => x.key === unpublished.documentKey)?.roles).toEqual([]);
            });
          });

          demoGuestbookEntryContext({ f, u, g: published, published: true }, (entry) => {
            it('rejects bare ids for subcollection model types', async () => {
              const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookEntryIdentity.modelType, keys: [entry.documentId] } });

              expect(result.isError).toBe(true);
              expect((result.content[0] as { text: string }).text).toContain('subcollection');
            });

            it('accepts a full subcollection key and resolves the owner-related grant', async () => {
              const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookEntryIdentity.modelType, keys: [entry.documentKey] } });

              expect(result.isError).toBeUndefined();
              const structured = result.structuredContent as unknown as RolesResponse;
              expect(structured.results).toHaveLength(1);
              expect(structured.results[0].key).toBe(entry.documentKey);
              expect(structured.results[0].exists).toBe(true);
              // the entry belongs to u, so grantFullAccessIfAuthUserRelated short-circuits
              expect(structured.results[0].fullAccess).toBe(true);
            });
          });
        });

        it('returns isError when an unknown modelType is requested', async () => {
          const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: 'not-a-real-model', keys: ['something/abc'] } });

          expect(result.isError).toBe(true);
          expect((result.content[0] as { text: string }).text).toContain('Unknown modelType');
        });
      });

      describe('uid targeting', () => {
        demoGuestbookContext({ f, name: 'RolesTargeted', published: false }, (unpublished) => {
          it('rejects a non-admin caller targeting another uid', async () => {
            const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [unpublished.documentKey], uid: au.uid } });

            expect(result.isError).toBe(true);
            expect((result.content[0] as { text: string }).text).toContain('elevated access');
          });

          it('allows any caller to pass their own uid', async () => {
            const result = await callMcpTool({ f, u, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [unpublished.documentKey], uid: u.uid } });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as unknown as RolesResponse;
            expect(structured.targeted).toBe(false);
            expect(structured.uid).toBe(u.uid);
          });

          // The admin resolves as the plain user, so the answer must be the TARGET's access (nothing on an
          // unpublished guestbook) rather than the caller's own admin full-access short-circuit.
          it('lets an admin resolve roles for another user', async () => {
            const result = await callMcpTool({ f, u: au, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [unpublished.documentKey], uid: u.uid } });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as unknown as RolesResponse;
            expect(structured.targeted).toBe(true);
            expect(structured.uid).toBe(u.uid);
            expect(structured.results[0]).toEqual({ key: unpublished.documentKey, exists: true, fullAccess: false, roles: [] });
          });

          it('returns isError when the target uid has no auth user', async () => {
            const result = await callMcpTool({ f, u: au, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [unpublished.documentKey], uid: 'no-such-user' } });

            expect(result.isError).toBe(true);
            expect((result.content[0] as { text: string }).text).toContain('No user exists');
          });
        });
      });

      describe('unauthenticated dispatch', () => {
        it('is isError when called anonymously', async () => {
          const result = await callMcpToolAnonymous({ f, name: MODEL_ROLES_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [`${guestbookIdentity.collectionName}/abc`] } });

          expect(result.isError).toBe(true);
        });
      });
    });
  });
});
