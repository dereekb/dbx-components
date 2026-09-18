import type { CallToolResult } from '@modelcontextprotocol/server';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { createModelDecodeTool, decodeFirestoreModelKey, MODEL_DECODE_TOOL_NAME, type ModelDecodeToolOutput } from './mcp.tool.model-decode';

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function unwrap(result: CallToolResult): ModelDecodeToolOutput {
  const content: unknown = result.structuredContent;
  return content as ModelDecodeToolOutput;
}

const MANIFEST: ReadonlyArray<McpManifestModelEntry> = [
  {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    fields: [],
    modelGroup: 'Guestbook'
  },
  {
    modelType: 'guestbookEntry',
    modelName: 'GuestbookEntry',
    identityConst: 'guestbookEntryIdentity',
    collectionPrefix: 'gbe',
    parentIdentityConst: 'guestbookIdentity',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbookEntry.ts',
    fields: []
  },
  {
    modelType: 'guestbookSummary',
    modelName: 'GuestbookSummary',
    identityConst: 'guestbookSummaryIdentity',
    collectionPrefix: 'gbs',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    fields: [],
    compositeKey: { from: ['Guestbook'], encoding: 'one-way' }
  },
  {
    modelType: 'notificationBox',
    modelName: 'NotificationBox',
    identityConst: 'notificationBoxIdentity',
    collectionPrefix: 'nb',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [],
    compositeKey: { from: '*', encoding: 'two-way' }
  }
];

describe('createModelDecodeTool', () => {
  describe('definition shape', () => {
    it('exposes the static tool with the expected metadata', () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });

      expect(tool.name).toBe(MODEL_DECODE_TOOL_NAME);
      expect(tool.dispatch).toEqual({ call: 'decode', modelType: 'model' });
      expect(tool.staticHandler).toBeDefined();
      expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
      expect(tool.annotations).toEqual({ readOnlyHint: true });
      expect(tool.staticWireEntry.annotations).toEqual({ readOnlyHint: true });
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');

      if (tool.filterMetadata.visibilityKind === 'declarative') {
        expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
      }

      expect(tool.inputSchema).toMatchObject({ type: 'object', required: ['key'] });
      expect(tool.outputSchema).toMatchObject({ type: 'object', required: ['key', 'leaf', 'ancestors', 'unresolvedPrefixes', 'derivedKeys'] });
    });
  });

  describe('composite keys', () => {
    it('lists the composite-key models derived from the decoded key with ready-to-use keys', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: 'gb/abc123' }, makeCtx());
      const output = unwrap(result);

      expect(output.derivedKeys).toEqual([
        { key: 'gbs/gbabc123', modelType: 'guestbookSummary', modelName: 'GuestbookSummary', collectionPrefix: 'gbs', encoding: 'one-way' },
        { key: 'nb/gb_abc123', modelType: 'notificationBox', modelName: 'NotificationBox', collectionPrefix: 'nb', encoding: 'two-way' }
      ]);
      expect(output.compositeSource).toBeUndefined();
    });

    it('flattens the full subcollection path for a derived key', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const output = unwrap(await tool.staticHandler!({ key: 'gb/abc/gbe/xyz' }, makeCtx()));

      // GuestbookSummary is derived from Guestbook only; the wildcard NotificationBox still applies.
      expect(output.derivedKeys).toEqual([{ key: 'nb/gb_abc_gbe_xyz', modelType: 'notificationBox', modelName: 'NotificationBox', collectionPrefix: 'nb', encoding: 'two-way' }]);
    });

    it('never derives a model from its own key', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const output = unwrap(await tool.staticHandler!({ key: 'nb/gb_abc123' }, makeCtx()));

      expect(output.derivedKeys).toEqual([]);
    });

    it('recovers and decodes the source key behind a two-way composite-key leaf', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const output = unwrap(await tool.staticHandler!({ key: 'nb/gb_abc_gbe_xyz' }, makeCtx()));

      expect(output.leaf.modelType).toBe('notificationBox');
      expect(output.compositeSource?.key).toBe('gb/abc/gbe/xyz');
      expect(output.compositeSource?.leaf).toMatchObject({ prefix: 'gbe', id: 'xyz', modelType: 'guestbookEntry' });
      expect(output.compositeSource?.ancestors).toHaveLength(1);
      expect(output.compositeSource?.unresolvedPrefixes).toEqual([]);
    });

    it('omits compositeSource for a one-way leaf and for an id that is not a flattened key', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });

      expect(unwrap(await tool.staticHandler!({ key: 'gbs/gbabc123' }, makeCtx())).compositeSource).toBeUndefined();
      expect(unwrap(await tool.staticHandler!({ key: 'nb/plainid' }, makeCtx())).compositeSource).toBeUndefined();
      expect(unwrap(await tool.staticHandler!({ key: 'nb/gb_abc_gbe' }, makeCtx())).compositeSource).toBeUndefined();
    });

    it('returns no derived keys for an unresolved leaf prefix', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const output = unwrap(await tool.staticHandler!({ key: 'zz/abc' }, makeCtx()));

      expect(output.derivedKeys).toEqual([]);
    });
  });

  describe('handler', () => {
    it('decodes a root key by prefix', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: 'gb/abc123' }, makeCtx());
      const output = unwrap(result);

      expect(output.key).toBe('gb/abc123');
      expect(output.ancestors).toEqual([]);
      expect(output.unresolvedPrefixes).toEqual([]);
      expect(output.leaf).toMatchObject({
        prefix: 'gb',
        id: 'abc123',
        modelType: 'guestbook',
        modelName: 'Guestbook',
        modelGroup: 'Guestbook',
        identityConst: 'guestbookIdentity'
      });
    });

    it('decodes a subcollection path with parent ancestor', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: 'gb/abc/gbe/xyz' }, makeCtx());
      const output = unwrap(result);

      expect(output.leaf.modelType).toBe('guestbookEntry');
      expect(output.leaf.parentIdentityConst).toBe('guestbookIdentity');
      expect(output.ancestors).toHaveLength(1);
      expect(output.ancestors[0]).toMatchObject({ prefix: 'gb', id: 'abc', modelType: 'guestbook' });
      expect(output.unresolvedPrefixes).toEqual([]);
    });

    it('lists unresolved prefixes without throwing', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: 'zz/abc' }, makeCtx());
      const output = unwrap(result);

      expect(result.isError).toBeUndefined();
      expect(output.leaf).toEqual({ prefix: 'zz', id: 'abc' });
      expect(output.unresolvedPrefixes).toEqual(['zz']);
    });

    it('trims surrounding whitespace before parsing', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: '   gb/abc   ' }, makeCtx());
      const output = unwrap(result);

      expect(output.key).toBe('gb/abc');
      expect(output.leaf.modelType).toBe('guestbook');
    });

    it('errors on missing key', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({}, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('"key" is required');
    });

    it('errors on empty trimmed key', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: '   ' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('key is empty');
    });

    it('errors on odd-segment paths', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: 'gb/abc/gbe' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Expected an even number of segments');
    });

    it('errors on single-segment input', async () => {
      const tool = createModelDecodeTool({ manifest: MANIFEST });
      const result = await tool.staticHandler!({ key: 'gb' }, makeCtx());

      expect(result.isError).toBe(true);
    });
  });
});

describe('decodeFirestoreModelKey', () => {
  it('drops empty segments produced by leading/trailing slashes', () => {
    const output = decodeFirestoreModelKey('/gb/abc/', MANIFEST);
    expect(output.leaf).toMatchObject({ prefix: 'gb', id: 'abc', modelType: 'guestbook' });
  });

  it('preserves order of ancestors root-first', () => {
    const output = decodeFirestoreModelKey('gb/abc/gbe/xyz', MANIFEST);
    expect(output.ancestors.map((a) => a.prefix)).toEqual(['gb']);
    expect(output.leaf.prefix).toBe('gbe');
  });
});
