import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { createModelInfoTool, findModelEntry, MODEL_INFO_TOOL_NAME, type ModelInfoToolOutput } from './mcp.tool.model-info';

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function makeEntry(overrides: Partial<McpManifestModelEntry> = {}): McpManifestModelEntry {
  return {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    fields: [{ name: 'n', longName: 'name', optional: false, tsType: 'string' }],
    ...overrides
  };
}

function unwrap(result: CallToolResult): ModelInfoToolOutput {
  return result.structuredContent as unknown as ModelInfoToolOutput;
}

describe('createModelInfoTool', () => {
  describe('definition shape', () => {
    it('exposes the static tool with the expected metadata', () => {
      const tool = createModelInfoTool({ manifest: [] });

      expect(tool.name).toBe(MODEL_INFO_TOOL_NAME);
      expect(tool.dispatch).toEqual({ call: 'info', modelType: 'model' });
      expect(tool.staticHandler).toBeDefined();
      expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');

      if (tool.filterMetadata.visibilityKind === 'declarative') {
        expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
      }

      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    });

    it('mentions the manifest size in the description', () => {
      const tool = createModelInfoTool({ manifest: [makeEntry(), makeEntry({ modelType: 'profile', collectionPrefix: 'p', identityConst: 'profileIdentity' })] });
      expect(tool.description).toContain('2 models');
    });

    it('singularizes the description for one model', () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      expect(tool.description).toContain('1 model');
      expect(tool.description).not.toContain('1 models');
    });
  });

  describe('list mode (no `model` arg)', () => {
    it('returns a summary row per entry with fieldCount', async () => {
      const manifest = [
        makeEntry({ fields: [] }),
        makeEntry({
          modelType: 'profile',
          collectionPrefix: 'p',
          identityConst: 'profileIdentity',
          modelGroup: 'Profile',
          fields: [
            { name: 'a', longName: 'a', optional: false },
            { name: 'b', longName: 'b', optional: false }
          ]
        })
      ];
      const tool = createModelInfoTool({ manifest });

      const result = await tool.staticHandler!({}, makeCtx());
      const output = unwrap(result);

      expect(output.mode).toBe('list');
      if (output.mode !== 'list') return;
      expect(output.models).toHaveLength(2);
      expect(output.models[0]).toMatchObject({ modelType: 'guestbook', fieldCount: 0 });
      expect(output.models[1]).toMatchObject({ modelType: 'profile', modelGroup: 'Profile', fieldCount: 2 });
    });

    it('omits optional fields from summary rows when absent', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      const result = await tool.staticHandler!({}, makeCtx());
      const output = unwrap(result);

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect(output.models[0]).not.toHaveProperty('modelGroup');
      expect(output.models[0]).not.toHaveProperty('parentIdentityConst');
      expect(output.models[0]).not.toHaveProperty('description');
    });

    it('returns an empty list when the manifest is empty', async () => {
      const tool = createModelInfoTool({ manifest: [] });
      const result = await tool.staticHandler!({}, makeCtx());
      const output = unwrap(result);

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect(output.models).toEqual([]);
    });
  });

  describe('single mode (`model` arg)', () => {
    it('resolves by modelType', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      const result = await tool.staticHandler!({ model: 'guestbook' }, makeCtx());
      const output = unwrap(result);

      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model.modelType).toBe('guestbook');
      expect(output.model.fields).toHaveLength(1);
    });

    it('resolves by identityConst', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      const result = await tool.staticHandler!({ model: 'guestbookIdentity' }, makeCtx());
      const output = unwrap(result);

      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model.modelType).toBe('guestbook');
    });

    it('resolves by collectionPrefix', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      const result = await tool.staticHandler!({ model: 'gb' }, makeCtx());
      const output = unwrap(result);

      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model.modelType).toBe('guestbook');
    });

    it('surfaces an unknown model as a user-visible error', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      const result = await tool.staticHandler!({ model: 'no-such-model' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('no model matches');
    });

    it('rejects non-string and empty `model`', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });

      const wrong = await tool.staticHandler!({ model: 123 as unknown as string }, makeCtx());
      expect(wrong.isError).toBe(true);

      const empty = await tool.staticHandler!({ model: '   ' }, makeCtx());
      expect(empty.isError).toBe(true);
    });
  });
});

describe('findModelEntry', () => {
  const manifest: ReadonlyArray<McpManifestModelEntry> = [
    {
      modelType: 'guestbook',
      modelName: 'Guestbook',
      identityConst: 'guestbookIdentity',
      collectionPrefix: 'gb',
      sourcePackage: 'demo-firebase',
      sourceFile: 'x.ts',
      fields: []
    },
    {
      modelType: 'profile',
      modelName: 'Profile',
      identityConst: 'profileIdentity',
      collectionPrefix: 'p',
      sourcePackage: 'demo-firebase',
      sourceFile: 'y.ts',
      fields: []
    }
  ];

  it('matches by modelType', () => {
    expect(findModelEntry('profile', manifest)?.modelType).toBe('profile');
  });
  it('matches by identityConst', () => {
    expect(findModelEntry('profileIdentity', manifest)?.modelType).toBe('profile');
  });
  it('matches by collectionPrefix', () => {
    expect(findModelEntry('p', manifest)?.modelType).toBe('profile');
  });
  it('returns undefined when nothing matches', () => {
    expect(findModelEntry('nope', manifest)).toBeUndefined();
  });
});
