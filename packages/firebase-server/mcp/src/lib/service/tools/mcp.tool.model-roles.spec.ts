import { type FirestoreModelIdentity } from '@dereekb/firebase';
import { type ModelAccessMultiRoleMapResult, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { createModelRolesTool, MCP_MODEL_ROLES_MAX_KEYS, MODEL_ROLES_TOOL_NAME, type CreateModelRolesToolDeps } from './mcp.tool.model-roles';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';

interface RecordedCall {
  readonly modelType: string;
  readonly keys: ReadonlyArray<string>;
  readonly targetUid?: string;
}

function makeIdentity(modelType: string, collectionName: string, type: 'root' | 'nested' = 'root'): FirestoreModelIdentity {
  return {
    type,
    modelType,
    collectionName,
    collectionType: type === 'root' ? collectionName : `parent/${collectionName}`
  };
}

function makeCtx(uid?: string): McpStaticToolHandlerContext {
  const base = { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
  return uid == null ? base : { ...base, auth: { uid } as FirebaseServerAuthData };
}

function unwrapStructured(result: CallToolResult): ModelAccessMultiRoleMapResult {
  const content: unknown = result.structuredContent;
  return content as ModelAccessMultiRoleMapResult;
}

function isErrorResult(result: CallToolResult): boolean {
  return result.isError === true;
}

function errorText(result: CallToolResult): string {
  return JSON.stringify(result.content);
}

/**
 * Builds a tool whose `readRoleMaps` records its calls and echoes a granted role set back, so the
 * tests assert on what the handler forwarded rather than on a live permission resolution.
 */
function makeTool(overrides?: Partial<CreateModelRolesToolDeps>): { readonly tool: ReturnType<typeof createModelRolesTool>; readonly calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const tool = createModelRolesTool({
    readRoleMaps: async ({ modelType, keys, targetUid }) => {
      calls.push({ modelType, keys, ...(targetUid == null ? {} : { targetUid }) });

      return {
        ...(targetUid == null ? {} : { uid: targetUid }),
        targeted: targetUid != null,
        results: keys.map((key) => ({ key, exists: true, fullAccess: false, roles: ['read'] })),
        errors: []
      };
    },
    resolveIdentity: () => makeIdentity('guestbook', 'gb'),
    ...overrides
  });

  return { tool, calls };
}

describe('createModelRolesTool', () => {
  describe('definition shape', () => {
    it('exposes the static tool with the expected metadata', () => {
      const { tool } = makeTool();

      expect(tool.name).toBe(MODEL_ROLES_TOOL_NAME);
      expect(tool.dispatch).toEqual({ call: 'roles', modelType: 'model' });
      expect(tool.staticHandler).toBeDefined();
      expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
      expect(tool.annotations).toEqual({ readOnlyHint: true });
      expect(tool.staticWireEntry.annotations).toEqual({ readOnlyHint: true });
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');

      if (tool.filterMetadata.visibilityKind === 'declarative') {
        expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
      }

      expect(tool.inputSchema).toMatchObject({ type: 'object', required: ['modelType', 'keys'] });
      expect(tool.outputSchema).toMatchObject({ type: 'object', required: ['targeted', 'results', 'errors'] });
    });
  });

  describe('handler', () => {
    it('passes full keys through verbatim and resolves as the caller by default', async () => {
      const { tool, calls } = makeTool();

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc', 'gb/def'] }, makeCtx('caller'));

      expect(calls).toEqual([{ modelType: 'guestbook', keys: ['gb/abc', 'gb/def'] }]);
      expect(unwrapStructured(result).targeted).toBe(false);
      expect(unwrapStructured(result).results).toHaveLength(2);
    });

    it('promotes bare ids to full keys for root models', async () => {
      const { tool, calls } = makeTool();

      await tool.staticHandler!({ modelType: 'guestbook', keys: ['abc'] }, makeCtx('caller'));

      expect(calls[0].keys).toEqual(['gb/abc']);
    });

    it('rejects bare ids for subcollection models', async () => {
      const { tool } = makeTool({ resolveIdentity: () => makeIdentity('guestbookEntry', 'gbe', 'nested') });

      const result = await tool.staticHandler!({ modelType: 'guestbookEntry', keys: ['abc'] }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(true);
      expect(errorText(result)).toContain('subcollection');
    });

    it('accepts full subcollection keys verbatim', async () => {
      const { tool, calls } = makeTool({ resolveIdentity: () => makeIdentity('guestbookEntry', 'gbe', 'nested') });

      await tool.staticHandler!({ modelType: 'guestbookEntry', keys: ['gb/abc/gbe/xyz'] }, makeCtx('caller'));

      expect(calls[0].keys).toEqual(['gb/abc/gbe/xyz']);
    });

    it('errors on an unknown modelType', async () => {
      const { tool } = makeTool({ resolveIdentity: () => undefined });

      const result = await tool.staticHandler!({ modelType: 'nope', keys: ['gb/abc'] }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(true);
      expect(errorText(result)).toContain('Unknown modelType');
    });

    it('rejects missing/empty modelType or keys', async () => {
      const { tool, calls } = makeTool();

      const noModel = await tool.staticHandler!({ keys: ['gb/abc'] }, makeCtx('caller'));
      expect(isErrorResult(noModel)).toBe(true);

      const emptyModel = await tool.staticHandler!({ modelType: '', keys: ['gb/abc'] }, makeCtx('caller'));
      expect(isErrorResult(emptyModel)).toBe(true);

      const noKeys = await tool.staticHandler!({ modelType: 'guestbook' }, makeCtx('caller'));
      expect(isErrorResult(noKeys)).toBe(true);

      const emptyKeys = await tool.staticHandler!({ modelType: 'guestbook', keys: [] }, makeCtx('caller'));
      expect(isErrorResult(emptyKeys)).toBe(true);

      const emptyKeyString = await tool.staticHandler!({ modelType: 'guestbook', keys: [''] }, makeCtx('caller'));
      expect(isErrorResult(emptyKeyString)).toBe(true);

      // none of the rejected shapes should have reached the role resolver
      expect(calls).toHaveLength(0);
    });

    it('rejects more keys than the per-call cap', async () => {
      const { tool } = makeTool();
      const keys = Array.from({ length: MCP_MODEL_ROLES_MAX_KEYS + 1 }, (_, i) => `gb/${i}`);

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(true);
      expect(errorText(result)).toContain('at most');
    });

    it('surfaces a missing document as exists:false rather than an error', async () => {
      const { tool } = makeTool({
        readRoleMaps: async ({ keys }) => ({
          targeted: false,
          results: keys.map((key) => ({ key, exists: false, fullAccess: false, roles: [] })),
          errors: []
        })
      });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/missing'] }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(false);
      expect(unwrapStructured(result).results[0]).toEqual({ key: 'gb/missing', exists: false, fullAccess: false, roles: [] });
      expect(unwrapStructured(result).errors).toHaveLength(0);
    });

    it('surfaces per-key failures in errors without failing the whole call', async () => {
      const { tool } = makeTool({
        readRoleMaps: async ({ keys }) => ({
          targeted: false,
          results: [{ key: keys[0], exists: true, fullAccess: false, roles: ['read'] }],
          errors: [{ key: keys[1], message: 'permission denied', code: 'FORBIDDEN' }]
        })
      });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/ok', 'gb/nope'] }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(false);
      expect(unwrapStructured(result).results).toHaveLength(1);
      expect(unwrapStructured(result).errors).toEqual([{ key: 'gb/nope', message: 'permission denied', code: 'FORBIDDEN' }]);
    });

    it('reports the full-access marker as fullAccess', async () => {
      const { tool } = makeTool({
        readRoleMaps: async ({ keys }) => ({
          targeted: false,
          results: keys.map((key) => ({ key, exists: true, fullAccess: true, roles: [] })),
          errors: []
        })
      });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'] }, makeCtx('admin'));

      expect(unwrapStructured(result).results[0].fullAccess).toBe(true);
    });
  });

  describe('uid targeting', () => {
    it('forwards the target uid when the predicate allows it', async () => {
      const { tool, calls } = makeTool({ canTargetOtherUids: () => true });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: 'other' }, makeCtx('admin'));

      expect(calls[0].targetUid).toBe('other');
      expect(unwrapStructured(result).targeted).toBe(true);
      expect(unwrapStructured(result).uid).toBe('other');
    });

    it('awaits an async predicate', async () => {
      const { tool, calls } = makeTool({ canTargetOtherUids: async () => true });

      await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: 'other' }, makeCtx('admin'));

      expect(calls[0].targetUid).toBe('other');
    });

    it('passes the calling auth to the predicate', async () => {
      const seen: Array<string | undefined> = [];
      const { tool } = makeTool({
        canTargetOtherUids: (auth) => {
          seen.push(auth?.uid);
          return true;
        }
      });

      await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: 'other' }, makeCtx('admin'));

      expect(seen).toEqual(['admin']);
    });

    it('denies the target uid when the predicate returns false', async () => {
      const { tool, calls } = makeTool({ canTargetOtherUids: () => false });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: 'other' }, makeCtx('nonadmin'));

      expect(isErrorResult(result)).toBe(true);
      expect(errorText(result)).toContain('elevated access');
      expect(calls).toHaveLength(0);
    });

    it('fails closed when no predicate is configured', async () => {
      const { tool, calls } = makeTool();

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: 'other' }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(true);
      expect(errorText(result)).toContain('elevated access');
      expect(calls).toHaveLength(0);
    });

    it('allows a caller to pass their own uid without the predicate', async () => {
      const { tool, calls } = makeTool();

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: 'caller' }, makeCtx('caller'));

      expect(isErrorResult(result)).toBe(false);
      expect(calls[0].targetUid).toBeUndefined();
      expect(unwrapStructured(result).targeted).toBe(false);
    });

    it('rejects an empty uid', async () => {
      const { tool } = makeTool({ canTargetOtherUids: () => true });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc'], uid: '' }, makeCtx('admin'));

      expect(isErrorResult(result)).toBe(true);
      expect(errorText(result)).toContain('uid');
      expect(errorText(result)).toContain('non-empty string');
    });
  });
});
