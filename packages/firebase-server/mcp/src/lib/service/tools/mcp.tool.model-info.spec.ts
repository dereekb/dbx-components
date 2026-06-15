import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { createModelInfoTool, findModelEntry, MODEL_INFO_TOOL_NAME, MODEL_INFO_GROUPS_HINT, MODEL_INFO_UNGROUPED_LABEL, type ModelInfoToolOutput } from './mcp.tool.model-info';

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

function profileEntry(overrides: Partial<McpManifestModelEntry> = {}): McpManifestModelEntry {
  return makeEntry({
    modelType: 'profile',
    modelName: 'Profile',
    identityConst: 'profileIdentity',
    collectionPrefix: 'p',
    modelGroup: 'Profile',
    fields: [
      { name: 'a', longName: 'a', optional: false },
      { name: 'b', longName: 'b', optional: false }
    ],
    ...overrides
  });
}

function unwrap(result: CallToolResult): ModelInfoToolOutput {
  const content: unknown = result.structuredContent;
  return content as ModelInfoToolOutput;
}

async function run(manifest: ReadonlyArray<McpManifestModelEntry>, args: Record<string, unknown>): Promise<ModelInfoToolOutput> {
  const tool = createModelInfoTool({ manifest });
  const result = await tool.staticHandler!(args, makeCtx());
  return unwrap(result);
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
      // MCP SDK's tools/list validator requires outputSchema.type === 'object' at the root.
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
    });

    it('mentions the manifest size in the description', () => {
      const tool = createModelInfoTool({ manifest: [makeEntry(), profileEntry()] });
      expect(tool.description).toContain('2 models');
    });

    it('singularizes the description for one model', () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      expect(tool.description).toContain('1 model');
      expect(tool.description).not.toContain('1 models');
    });

    it('documents the new params in the description', () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      expect(tool.description).toContain('modelGroup');
      expect(tool.description).toContain('all:true');
      expect(tool.description).toContain('fields');
    });
  });

  describe('groups mode (no args)', () => {
    it('returns groups + counts and a total, not the full model list', async () => {
      const manifest = [makeEntry({ modelGroup: 'Job' }), makeEntry({ modelType: 'jobAssignment', collectionPrefix: 'ja', identityConst: 'jobAssignmentIdentity', modelGroup: 'Job' }), profileEntry()];
      const output = await run(manifest, {});

      expect(output.mode).toBe('groups');
      if (output.mode !== 'groups') throw new Error('expected groups mode');
      expect(output.totalModels).toBe(3);
      // sorted by count desc, then name asc
      expect(output.groups).toEqual([
        { modelGroup: 'Job', modelCount: 2 },
        { modelGroup: 'Profile', modelCount: 1 }
      ]);
      expect(output.hint).toBe(MODEL_INFO_GROUPS_HINT);
    });

    it('buckets ungrouped models under the ungrouped label', async () => {
      const output = await run([makeEntry()], {});

      if (output.mode !== 'groups') throw new Error('expected groups mode');
      expect(output.groups).toEqual([{ modelGroup: MODEL_INFO_UNGROUPED_LABEL, modelCount: 1 }]);
      expect(output.totalModels).toBe(1);
    });

    it('returns an empty groups list when the manifest is empty', async () => {
      const output = await run([], {});

      if (output.mode !== 'groups') throw new Error('expected groups mode');
      expect(output.groups).toEqual([]);
      expect(output.totalModels).toBe(0);
    });
  });

  describe('single mode (`model` string)', () => {
    it('resolves by modelType and returns full field detail', async () => {
      const output = await run([makeEntry()], { model: 'guestbook' });

      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model.modelType).toBe('guestbook');
      expect((output.model as McpManifestModelEntry).fields).toHaveLength(1);
    });

    it('resolves by identityConst', async () => {
      const output = await run([makeEntry()], { model: 'guestbookIdentity' });
      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model.modelType).toBe('guestbook');
    });

    it('resolves by collectionPrefix', async () => {
      const output = await run([makeEntry()], { model: 'gb' });
      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model.modelType).toBe('guestbook');
    });

    it('suppresses field detail when `fields:false`', async () => {
      const output = await run([makeEntry()], { model: 'guestbook', fields: false });
      if (output.mode !== 'single') throw new Error('expected single mode');
      expect(output.model).not.toHaveProperty('fields');
      expect(output.model).toMatchObject({ modelType: 'guestbook', fieldCount: 1 });
    });

    it('surfaces an unknown model as a user-visible error', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });
      const result = await tool.staticHandler!({ model: 'no-such-model' }, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('no exact match');
    });

    it('suggests the group on a near-miss group name', async () => {
      const tool = createModelInfoTool({ manifest: [profileEntry()] });
      const result = await tool.staticHandler!({ model: 'Profile' }, makeCtx());

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('did you mean group:"Profile"');
      expect(text).toContain('modelGroup:"Profile"');
    });

    it('rejects non-string and empty `model`', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });

      const wrong = await tool.staticHandler!({ model: 123 }, makeCtx());
      expect(wrong.isError).toBe(true);

      const empty = await tool.staticHandler!({ model: '   ' }, makeCtx());
      expect(empty.isError).toBe(true);
    });
  });

  describe('multiple mode (`model` array)', () => {
    it('returns full detail per match and reports misses in `notFound`', async () => {
      const manifest = [makeEntry(), profileEntry()];
      const output = await run(manifest, { model: ['guestbook', 'profile', 'ghost'] });

      if (output.mode !== 'multiple') throw new Error('expected multiple mode');
      expect(output.models.map((m) => m.modelType)).toEqual(['guestbook', 'profile']);
      expect((output.models[0] as McpManifestModelEntry).fields).toBeDefined();
      expect(output.notFound).toHaveLength(1);
      expect(output.notFound?.[0].query).toBe('ghost');
      expect(output.notFound?.[0].message).toContain('no exact match for "ghost"');
    });

    it('omits `notFound` when every query matches', async () => {
      const output = await run([makeEntry(), profileEntry()], { model: ['guestbook', 'p'] });

      if (output.mode !== 'multiple') throw new Error('expected multiple mode');
      expect(output.models).toHaveLength(2);
      expect(output).not.toHaveProperty('notFound');
    });

    it('uses multiple mode even for a single-element array, and never throws on a full miss', async () => {
      const output = await run([makeEntry()], { model: ['nope'] });

      if (output.mode !== 'multiple') throw new Error('expected multiple mode');
      expect(output.models).toEqual([]);
      expect(output.notFound).toHaveLength(1);
    });

    it('emits summary rows when `fields:false`', async () => {
      const output = await run([makeEntry(), profileEntry()], { model: ['guestbook', 'profile'], fields: false });

      if (output.mode !== 'multiple') throw new Error('expected multiple mode');
      expect(output.models[0]).not.toHaveProperty('fields');
      expect(output.models[0]).toMatchObject({ modelType: 'guestbook', fieldCount: 1 });
    });

    it('rejects empty arrays and non-string entries', async () => {
      const tool = createModelInfoTool({ manifest: [makeEntry()] });

      const emptyArray = await tool.staticHandler!({ model: [] }, makeCtx());
      expect(emptyArray.isError).toBe(true);

      const badEntry = await tool.staticHandler!({ model: ['guestbook', 7] }, makeCtx());
      expect(badEntry.isError).toBe(true);
    });
  });

  describe('modelGroup filter (`mode: list`)', () => {
    it('returns the summary subset for a group', async () => {
      const manifest = [makeEntry({ modelGroup: 'Job' }), makeEntry({ modelType: 'jobAssignment', collectionPrefix: 'ja', identityConst: 'jobAssignmentIdentity', modelGroup: 'Job' }), profileEntry()];
      const output = await run(manifest, { modelGroup: 'Job' });

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect(output.modelGroup).toBe('Job');
      expect(output.models.map((m) => m.modelType)).toEqual(['guestbook', 'jobAssignment']);
      // summary rows by default — no full field arrays
      expect(output.models[0]).not.toHaveProperty('fields');
      expect(output.models[0]).toHaveProperty('fieldCount');
    });

    it('matches the group case-insensitively (the "Worker" papercut)', async () => {
      const output = await run([profileEntry({ modelGroup: 'Worker' })], { modelGroup: 'worker' });

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect(output.modelGroup).toBe('Worker');
      expect(output.models).toHaveLength(1);
    });

    it('forces full field detail when `fields:true`', async () => {
      const output = await run([profileEntry()], { modelGroup: 'Profile', fields: true });

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect((output.models[0] as McpManifestModelEntry).fields).toHaveLength(2);
    });

    it('errors with the available groups for an unknown group', async () => {
      const tool = createModelInfoTool({ manifest: [profileEntry()] });
      const result = await tool.staticHandler!({ modelGroup: 'Nope' }, makeCtx());

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('no model group matches "Nope"');
      expect(text).toContain('Profile (1)');
    });
  });

  describe('all mode (`all: true`)', () => {
    it('returns the full catalog as summary rows', async () => {
      const manifest = [makeEntry({ fields: [] }), profileEntry()];
      const output = await run(manifest, { all: true });

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect(output.models).toHaveLength(2);
      expect(output.models[0]).toMatchObject({ modelType: 'guestbook', fieldCount: 0 });
      expect(output.models[1]).toMatchObject({ modelType: 'profile', modelGroup: 'Profile', fieldCount: 2 });
      expect(output).not.toHaveProperty('modelGroup');
    });

    it('omits optional fields from summary rows when absent', async () => {
      const output = await run([makeEntry()], { all: true });

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect(output.models[0]).not.toHaveProperty('modelGroup');
      expect(output.models[0]).not.toHaveProperty('parentIdentityConst');
      expect(output.models[0]).not.toHaveProperty('description');
    });

    it('includes full field detail when `fields:true`', async () => {
      const output = await run([makeEntry()], { all: true, fields: true });

      if (output.mode !== 'list') throw new Error('expected list mode');
      expect((output.models[0] as McpManifestModelEntry).fields).toHaveLength(1);
      expect(output.models[0]).toHaveProperty('sourceFile');
    });

    it('prefers `model` over `all` when both are supplied', async () => {
      const output = await run([makeEntry(), profileEntry()], { model: 'guestbook', all: true });
      expect(output.mode).toBe('single');
    });
  });

  describe('enums section', () => {
    const ENUMS = {
      GuestbookState: {
        name: 'GuestbookState',
        values: [
          { name: 'OPEN', value: 1 },
          { name: 'CLOSED', value: 2 }
        ]
      },
      DayState: { name: 'DayState', values: [{ name: 'A', value: 1 }] },
      Unused: { name: 'Unused', values: [{ name: 'X', value: 9 }] }
    } as const;

    function enumEntry(): McpManifestModelEntry {
      return makeEntry({
        fields: [
          { name: 's', longName: 'state', optional: false, enumRef: 'GuestbookState' },
          { name: 'days', longName: 'days', optional: false, nestedIsArray: true, nestedFields: [{ name: 'ds', longName: 'dayState', optional: false, enumRef: 'DayState' }] }
        ]
      });
    }

    async function runWithEnums(args: Record<string, unknown>, enums: Record<string, { name: string; values: ReadonlyArray<{ name: string; value: number | string }> }> = ENUMS): Promise<ModelInfoToolOutput> {
      const tool = createModelInfoTool({ manifest: [enumEntry()], enums });
      return unwrap(await tool.staticHandler!(args, makeCtx()));
    }

    it('attaches value tables for enums referenced by a detailed single result, including nested fields', async () => {
      const output = await runWithEnums({ model: 'guestbook' });
      expect(output.mode).toBe('single');
      expect(output.enums?.map((e) => e.name).sort()).toEqual(['DayState', 'GuestbookState']);
    });

    it('attaches enums for multiple mode detailed results', async () => {
      const output = await runWithEnums({ model: ['guestbook'] });
      expect(output.mode).toBe('multiple');
      expect(output.enums?.map((e) => e.name).sort()).toEqual(['DayState', 'GuestbookState']);
    });

    it('attaches enums for list/all when fields:true', async () => {
      const output = await runWithEnums({ all: true, fields: true });
      expect(output.mode).toBe('list');
      expect(output.enums?.map((e) => e.name).sort()).toEqual(['DayState', 'GuestbookState']);
    });

    it('omits enums in the compact groups mode', async () => {
      const output = await runWithEnums({});
      expect(output.mode).toBe('groups');
      expect(output).not.toHaveProperty('enums');
    });

    it('omits enums for summary rows (fields:false)', async () => {
      const output = await runWithEnums({ model: 'guestbook', fields: false });
      expect(output).not.toHaveProperty('enums');
    });

    it('omits enums for the default summary list (all without fields)', async () => {
      const output = await runWithEnums({ all: true });
      expect(output).not.toHaveProperty('enums');
    });

    it('skips enumRefs with no registered table', async () => {
      const output = await runWithEnums({ model: 'guestbook' }, { GuestbookState: ENUMS.GuestbookState });
      expect(output.enums?.map((e) => e.name)).toEqual(['GuestbookState']);
    });

    it('attaches no enums when none of the referenced enums are registered', async () => {
      const output = await runWithEnums({ model: 'guestbook' }, { Unused: ENUMS.Unused });
      expect(output).not.toHaveProperty('enums');
    });

    it('omits the enums section entirely when no enum map is wired', async () => {
      const tool = createModelInfoTool({ manifest: [enumEntry()] });
      const output = unwrap(await tool.staticHandler!({ model: 'guestbook' }, makeCtx()));
      expect(output).not.toHaveProperty('enums');
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
