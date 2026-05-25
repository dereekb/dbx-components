import { type FirestoreModelIdentity } from '@dereekb/firebase';
import { type ModelAccessMultiReadResult } from '@dereekb/firebase-server';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createModelGetTool, MCP_MODEL_GET_BATCH_SIZE, MODEL_GET_TOOL_NAME } from './mcp.tool.model-get';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';

interface RecordedCall {
  readonly modelType: string;
  readonly keys: ReadonlyArray<string>;
}

function makeIdentity(modelType: string, collectionName: string, type: 'root' | 'nested' = 'root'): FirestoreModelIdentity {
  return {
    type,
    modelType,
    collectionName,
    collectionType: type === 'root' ? collectionName : `parent/${collectionName}`
  } as FirestoreModelIdentity;
}

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function unwrapStructured(result: CallToolResult): ModelAccessMultiReadResult {
  return result.structuredContent as unknown as ModelAccessMultiReadResult;
}

describe('createModelGetTool', () => {
  describe('definition shape', () => {
    it('exposes the static tool with the expected metadata', () => {
      const tool = createModelGetTool({
        readDocuments: async () => ({ results: [], errors: [] }),
        resolveIdentity: () => undefined
      });

      expect(tool.name).toBe(MODEL_GET_TOOL_NAME);
      expect(tool.dispatch).toEqual({ call: 'get', modelType: 'model' });
      expect(tool.staticHandler).toBeDefined();
      expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');
      expect(tool.filterMetadata.rule?.requireAuthenticated).toBe(true);
      expect(tool.inputSchema).toMatchObject({ type: 'object', required: ['modelType', 'keys'] });
      expect(tool.outputSchema).toMatchObject({ type: 'object', required: ['results', 'errors'] });
    });
  });

  describe('handler', () => {
    it('passes full keys through verbatim', async () => {
      const calls: RecordedCall[] = [];
      const tool = createModelGetTool({
        readDocuments: async (modelType, keys) => {
          calls.push({ modelType, keys });
          return { results: keys.map((key) => ({ key, data: { hello: key } })), errors: [] };
        },
        resolveIdentity: (_type, _auth) => makeIdentity('guestbook', 'gb')
      });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['gb/abc', 'gb/def'] }, makeCtx());

      expect(calls).toEqual([{ modelType: 'guestbook', keys: ['gb/abc', 'gb/def'] }]);
      expect(unwrapStructured(result).results).toHaveLength(2);
      expect(unwrapStructured(result).errors).toHaveLength(0);
    });

    it('synthesizes <collectionName>/<id> for bare ids on root models', async () => {
      const calls: RecordedCall[] = [];
      const tool = createModelGetTool({
        readDocuments: async (modelType, keys) => {
          calls.push({ modelType, keys });
          return { results: keys.map((key) => ({ key, data: null })), errors: [] };
        },
        resolveIdentity: (_type, _auth) => makeIdentity('guestbook', 'gb')
      });

      const result = await tool.staticHandler!({ modelType: 'guestbook', keys: ['abc', 'def'] }, makeCtx());

      expect(calls[0].keys).toEqual(['gb/abc', 'gb/def']);
      expect(result.isError).toBeUndefined();
    });

    it('rejects bare ids for subcollection (nested) models', async () => {
      const tool = createModelGetTool({
        readDocuments: async () => ({ results: [], errors: [] }),
        resolveIdentity: (_type, _auth) => makeIdentity('guestbookEntry', 'gbe', 'nested')
      });

      const result = await tool.staticHandler!({ modelType: 'guestbookEntry', keys: ['someBareId'] }, makeCtx());

      expect(result.isError).toBe(true);
      const message = result.content[0] as { text: string };
      expect(message.text).toContain('subcollection');
    });

    it('accepts full subcollection keys verbatim', async () => {
      const calls: RecordedCall[] = [];
      const tool = createModelGetTool({
        readDocuments: async (modelType, keys) => {
          calls.push({ modelType, keys });
          return { results: keys.map((key) => ({ key, data: null })), errors: [] };
        },
        resolveIdentity: (_type, _auth) => makeIdentity('guestbookEntry', 'gbe', 'nested')
      });

      await tool.staticHandler!({ modelType: 'guestbookEntry', keys: ['gb/abc/gbe/xyz'] }, makeCtx());

      expect(calls[0].keys).toEqual(['gb/abc/gbe/xyz']);
    });

    it('surfaces an unknown modelType as a user-visible error', async () => {
      const tool = createModelGetTool({
        readDocuments: async () => ({ results: [], errors: [] }),
        resolveIdentity: () => undefined
      });

      const result = await tool.staticHandler!({ modelType: 'unknown', keys: ['x'] }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Unknown modelType');
    });

    it('rejects missing/empty modelType or keys', async () => {
      const tool = createModelGetTool({
        readDocuments: async () => ({ results: [], errors: [] }),
        resolveIdentity: (_type, _auth) => makeIdentity('guestbook', 'gb')
      });

      const noModel = await tool.staticHandler!({ keys: ['x'] }, makeCtx());
      expect(noModel.isError).toBe(true);

      const emptyKeys = await tool.staticHandler!({ modelType: 'guestbook', keys: [] }, makeCtx());
      expect(emptyKeys.isError).toBe(true);

      const wrongKeyShape = await tool.staticHandler!({ modelType: 'guestbook', keys: [''] }, makeCtx());
      expect(wrongKeyShape.isError).toBe(true);
    });

    it('chunks keys past the batch size and merges results + errors across chunks', async () => {
      const calls: RecordedCall[] = [];
      const tool = createModelGetTool({
        readDocuments: async (modelType, keys) => {
          calls.push({ modelType, keys });
          return {
            results: keys.map((key) => ({ key, data: { ok: true } })),
            errors: [{ key: `${keys[0]}-err`, message: 'simulated' }]
          };
        },
        resolveIdentity: (_type, _auth) => makeIdentity('guestbook', 'gb')
      });

      const keys = Array.from({ length: MCP_MODEL_GET_BATCH_SIZE + 1 }, (_, i) => `gb/${i}`);
      const result = await tool.staticHandler!({ modelType: 'guestbook', keys }, makeCtx());

      expect(calls).toHaveLength(2);
      expect(calls[0].keys).toHaveLength(MCP_MODEL_GET_BATCH_SIZE);
      expect(calls[1].keys).toHaveLength(1);

      const merged = unwrapStructured(result);
      expect(merged.results).toHaveLength(MCP_MODEL_GET_BATCH_SIZE + 1);
      expect(merged.errors).toHaveLength(2);
    });
  });
});
