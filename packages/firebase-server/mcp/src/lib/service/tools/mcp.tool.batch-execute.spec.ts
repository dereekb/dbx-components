import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type FirebaseServerStorageService } from '@dereekb/firebase-server';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createBatchExecuteTool, batchOperationCoordKey, BATCH_EXECUTE_TOOL_NAME, type BatchExecuteToolResult, type BatchOperationAuthorization } from './mcp.tool.batch-execute';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';

interface FakeStorageState {
  readonly fileText: string;
  exists: boolean;
  deleteCount: number;
  lastPathString?: string;
}

/**
 * Builds a minimal {@link FirebaseServerStorageService} stand-in whose single file returns the
 * given text and records delete() calls. Only the members the tool touches are implemented.
 */
function makeStorageService(state: FakeStorageState): FirebaseServerStorageService {
  const service = {
    file(path: { pathString?: string } | string) {
      state.lastPathString = typeof path === 'string' ? path : path.pathString;
      return {
        exists: async () => state.exists,
        getBytes: async () => new TextEncoder().encode(state.fileText),
        delete: async () => {
          state.deleteCount += 1;
        }
      };
    }
  };

  return service as unknown as FirebaseServerStorageService;
}

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function unwrap(result: CallToolResult): BatchExecuteToolResult {
  return result.structuredContent as unknown as BatchExecuteToolResult;
}

const allowAll = (): BatchOperationAuthorization => ({ allowed: true });

describe('createBatchExecuteTool', () => {
  describe('definition shape', () => {
    it('exposes the static tool with write-capable, auth-gated metadata', () => {
      const tool = createBatchExecuteTool({
        storageService: makeStorageService({ fileText: '', exists: true, deleteCount: 0 }),
        dispatch: async () => undefined,
        authorizeOperation: allowAll
      });

      expect(tool.name).toBe(BATCH_EXECUTE_TOOL_NAME);
      expect(tool.staticHandler).toBeDefined();
      expect(tool.filterMetadata.effectiveReadOnly).toBe(false);
      expect(tool.annotations).toEqual({ readOnlyHint: false, destructiveHint: true });
      expect(tool.staticWireEntry.annotations).toEqual({ readOnlyHint: false, destructiveHint: true });
      expect(tool.description.startsWith('[WRITE] ')).toBe(true);
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');

      if (tool.filterMetadata.visibilityKind === 'declarative') {
        expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
      }

      expect(tool.inputSchema).toMatchObject({ type: 'object', required: ['uploadPath'] });
    });
  });

  describe('coordinate key', () => {
    it('treats absent and empty specifier identically and isolates segments', () => {
      expect(batchOperationCoordKey({ call: 'update', modelType: 'worker' })).toBe(batchOperationCoordKey({ call: 'update', modelType: 'worker', specifier: undefined }));
      expect(batchOperationCoordKey({ call: 'update', modelType: 'worker', specifier: 'x' })).not.toBe(batchOperationCoordKey({ call: 'update', modelType: 'workerx' }));
    });
  });

  describe('handler', () => {
    const NDJSON_THREE = ['{"call":"update","modelType":"worker","data":{"id":"a"}}', '{"call":"update","modelType":"worker","data":{"id":"b"}}', '{"call":"update","modelType":"worker","data":{"id":"c"}}'].join('\n');

    it('runs every authorized operation and deletes the upload on full success', async () => {
      const dispatched: OnCallTypedModelParams[] = [];
      const state: FakeStorageState = { fileText: NDJSON_THREE, exists: true, deleteCount: 0 };
      const tool = createBatchExecuteTool({
        storageService: makeStorageService(state),
        dispatch: async (operation) => {
          dispatched.push(operation);
        },
        authorizeOperation: allowAll
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/ops.ndjson' }, makeCtx());
      const summary = unwrap(result);

      expect(result.isError).toBeUndefined();
      expect(dispatched).toHaveLength(3);
      expect(summary).toMatchObject({ total: 3, successCount: 3, failureCount: 0, skippedCount: 0, uploadDeleted: true });
      expect(state.deleteCount).toBe(1);
    });

    it('parses a top-level JSON array when format=json', async () => {
      const dispatched: OnCallTypedModelParams[] = [];
      const fileText = JSON.stringify([
        { call: 'create', modelType: 'worker', data: { id: 'a' } },
        { call: 'create', modelType: 'worker', data: { id: 'b' } }
      ]);
      const tool = createBatchExecuteTool({
        storageService: makeStorageService({ fileText, exists: true, deleteCount: 0 }),
        dispatch: async (operation) => {
          dispatched.push(operation);
        },
        authorizeOperation: allowAll
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/ops.json', format: 'json' }, makeCtx());

      expect(unwrap(result)).toMatchObject({ total: 2, successCount: 2 });
      expect(dispatched).toHaveLength(2);
    });

    it('aborts the whole batch (nothing dispatched, file kept) when any operation is unauthorized', async () => {
      const dispatched: OnCallTypedModelParams[] = [];
      const state: FakeStorageState = { fileText: NDJSON_THREE, exists: true, deleteCount: 0 };
      const tool = createBatchExecuteTool({
        storageService: makeStorageService(state),
        dispatch: async (operation) => {
          dispatched.push(operation);
        },
        // deny the second operation only
        authorizeOperation: (operation) => ((operation.data as { id?: string })?.id === 'b' ? { allowed: false, reason: 'hidden' } : { allowed: true })
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/ops.ndjson' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('pre-flight');
      expect(dispatched).toHaveLength(0);
      expect(state.deleteCount).toBe(0);
    });

    it('best-effort: reports the failed operation by index, keeps the upload, attempts all', async () => {
      const state: FakeStorageState = { fileText: NDJSON_THREE, exists: true, deleteCount: 0 };
      const tool = createBatchExecuteTool({
        storageService: makeStorageService(state),
        dispatch: async (operation) => {
          if ((operation.data as { id?: string })?.id === 'b') {
            throw new Error('boom-b');
          }
        },
        authorizeOperation: allowAll
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/ops.ndjson' }, makeCtx());
      const summary = unwrap(result);

      expect(summary).toMatchObject({ total: 3, successCount: 2, failureCount: 1, skippedCount: 0, uploadDeleted: false });
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0]).toMatchObject({ index: 1, modelType: 'worker', message: 'boom-b' });
      expect(state.deleteCount).toBe(0);
    });

    it('stopOnError: halts at the first failure and records the rest as skipped', async () => {
      const dispatched: OnCallTypedModelParams[] = [];
      const tool = createBatchExecuteTool({
        storageService: makeStorageService({ fileText: NDJSON_THREE, exists: true, deleteCount: 0 }),
        dispatch: async (operation) => {
          dispatched.push(operation);
          if ((operation.data as { id?: string })?.id === 'a') {
            throw new Error('boom-a');
          }
        },
        authorizeOperation: allowAll
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/ops.ndjson', stopOnError: true }, makeCtx());
      const summary = unwrap(result);

      expect(dispatched).toHaveLength(1);
      expect(summary).toMatchObject({ total: 3, successCount: 0, failureCount: 1, skippedCount: 2 });
    });

    it('errors when the file does not exist', async () => {
      const tool = createBatchExecuteTool({
        storageService: makeStorageService({ fileText: '', exists: false, deleteCount: 0 }),
        dispatch: async () => undefined,
        authorizeOperation: allowAll
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/missing.ndjson' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('not found');
    });

    it('rejects a malformed operation without dispatching anything', async () => {
      const dispatched: OnCallTypedModelParams[] = [];
      const tool = createBatchExecuteTool({
        storageService: makeStorageService({ fileText: '{"call":"update","data":{}}', exists: true, deleteCount: 0 }),
        dispatch: async (operation) => {
          dispatched.push(operation);
        },
        authorizeOperation: allowAll
      });

      const result = await tool.staticHandler!({ uploadPath: 'uploads/ops.ndjson' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('modelType');
      expect(dispatched).toHaveLength(0);
    });
  });
});
