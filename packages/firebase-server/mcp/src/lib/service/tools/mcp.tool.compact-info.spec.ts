import { buildModelManifestCatalog, resolveModelManifestInfoOutput, type ModelManifest, type ModelManifestEnums, type ModelManifestInfoOutput } from '@dereekb/firebase/manifest';
import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { MCP_TOOL_NAME_PREFIX_MAX_LENGTH } from '../mcp.compact';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { buildMcpCompactInfoHints, createMcpCompactInfoTool } from './mcp.tool.compact-info';

const MODELS: ModelManifest = [
  {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    modelGroup: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    description: 'A guestbook that people sign.',
    sourcePackage: 'demo-firebase',
    sourceFile: 'guestbook.ts',
    fields: [{ name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date' }]
  },
  {
    modelType: 'notification',
    modelName: 'Notification',
    modelGroup: 'Notification',
    identityConst: 'notificationIdentity',
    collectionPrefix: 'nbn',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'notification.ts',
    fields: [
      { name: 'ts', longName: 'textSendState', optional: false, enumRef: 'NotificationSendState' },
      { name: 'es', longName: 'emailSendState', optional: false, enumRef: 'NotificationSendState' }
    ]
  }
];

const ENUMS: ModelManifestEnums = {
  NotificationSendState: { name: 'NotificationSendState', description: 'Send state.', values: [{ name: 'QUEUED', value: 0 }] }
};

const CATALOG = buildModelManifestCatalog({ models: MODELS, enums: ENUMS });
const NAME = 'demo_api_info';

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

async function call(args: Record<string, unknown>): Promise<CallToolResult> {
  const tool = createMcpCompactInfoTool({ name: NAME, app: 'demo', catalog: CATALOG });
  return tool.staticHandler!(args, makeCtx());
}

function unwrap(result: CallToolResult): ModelManifestInfoOutput {
  const content: unknown = result.structuredContent;
  return content as ModelManifestInfoOutput;
}

describe('createMcpCompactInfoTool()', () => {
  it('should build a read-only tool with the catalog dispatch and no reason param', () => {
    const tool = createMcpCompactInfoTool({ name: NAME, app: 'demo', catalog: CATALOG });

    expect(tool.name).toBe(NAME);
    expect(tool.dispatch).toEqual({ call: 'info', modelType: 'catalog' });
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
    expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    expect(JSON.stringify(tool.inputSchema)).not.toContain('"reason"');

    if (tool.filterMetadata.visibilityKind === 'declarative') {
      expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
    }
  });

  it('should keep the description short with a max-length app and examples', () => {
    const app = 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH);
    const tool = createMcpCompactInfoTool({ name: `${app}_api_info`, app, catalog: CATALOG, examples: { modelTypes: ['notificationSummary'], enumName: 'NotificationSendState' } });

    expect(tool.description.length).toBeLessThanOrEqual(650);
    expect(tool.description).toContain('e.g. "NotificationSendState"');
    expect(tool.description).toContain('(2 models, 1 enum)');
  });

  it('should use generic wording without examples', () => {
    const tool = createMcpCompactInfoTool({ name: NAME, app: 'demo', catalog: CATALOG });

    expect(tool.description).not.toContain('e.g.');
    expect(JSON.stringify(tool.inputSchema)).not.toContain('e.g.');
  });

  describe('handler', () => {
    it('should return the overview with no arguments', async () => {
      const output = unwrap(await call({}));
      expect(output.mode).toBe('overview');
      expect(output.mode === 'overview' && output.totalModels).toBe(2);
    });

    it('should return search hits for a query', async () => {
      const output = unwrap(await call({ query: 'guestbook' }));
      expect(output.mode).toBe('search');
      expect(output.mode === 'search' && output.hits[0]).toMatchObject({ kind: 'model', modelType: 'guestbook' });
    });

    it('should return a model entry with its referenced enums', async () => {
      const output = unwrap(await call({ model: 'nbn' }));
      expect(output.mode).toBe('model');
      expect(output.mode === 'model' && output.models.map((x) => x.modelType)).toEqual(['notification']);
      expect(output.mode === 'model' && output.enums?.map((x) => x.name)).toEqual(['NotificationSendState']);
    });

    it('should return an enum with usedBy', async () => {
      const output = unwrap(await call({ enum: ['NotificationSendState', 'Ghost'] }));
      expect(output.mode).toBe('enum');

      if (output.mode === 'enum') {
        expect(output.enums[0].usedBy.map((x) => x.field)).toEqual(['ts', 'es']);
        expect(output.notFound).toEqual(['Ghost']);
        expect(output.hint).toBe(buildMcpCompactInfoHints(NAME).enumNotFound);
      }
    });

    it('should return an error for a bad combination', async () => {
      const result = await call({ query: 'guestbook', model: 'guestbook' });
      expect(result.isError).toBe(true);
    });

    it('should return the shared resolver output as structuredContent', async () => {
      const args = { query: 'send state', kind: 'field' };
      const result = await call(args);
      const expected = resolveModelManifestInfoOutput({ catalog: CATALOG, input: args as never, hints: buildMcpCompactInfoHints(NAME) });

      expect(result.structuredContent).toEqual(expected);
      expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(expected);
    });
  });
});
