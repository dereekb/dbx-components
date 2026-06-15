import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type McpManifestEnum } from '../mcp.manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { createEnumInfoTool, resolveEnumInfoOutput, ENUM_INFO_TOOL_NAME, type EnumInfoToolOutput } from './mcp.tool.enum-info';

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function unwrap(result: CallToolResult): EnumInfoToolOutput {
  const content: unknown = result.structuredContent;
  return content as EnumInfoToolOutput;
}

const ENUMS: { readonly [name: string]: McpManifestEnum } = {
  JobWorkerTimesheetState: {
    name: 'JobWorkerTimesheetState',
    description: 'Timesheet state.',
    values: [
      { name: 'ACTIVE', value: 1, description: 'Active.' },
      { name: 'PAUSED', value: 2 },
      { name: 'ARCHIVED', value: 4 }
    ]
  },
  DayOfWeek: {
    name: 'DayOfWeek',
    values: [{ name: 'MON', value: 1 }]
  }
};

describe('createEnumInfoTool', () => {
  describe('definition shape', () => {
    it('exposes the static tool with the expected metadata', () => {
      const tool = createEnumInfoTool({ enums: ENUMS });

      expect(tool.name).toBe(ENUM_INFO_TOOL_NAME);
      expect(tool.dispatch).toEqual({ call: 'info', modelType: 'enum' });
      expect(tool.staticHandler).toBeDefined();
      expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');

      if (tool.filterMetadata.visibilityKind === 'declarative') {
        expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
      }

      expect(tool.inputSchema).toMatchObject({ type: 'object', required: ['enum'] });
      expect(tool.outputSchema).toMatchObject({ type: 'object', required: ['enums'] });
    });

    it('mentions the registered enum count, pluralized', () => {
      expect(createEnumInfoTool({ enums: ENUMS }).description).toContain('2 enums');
    });

    it('singularizes the description for one enum', () => {
      const tool = createEnumInfoTool({ enums: { DayOfWeek: ENUMS.DayOfWeek } });
      expect(tool.description).toContain('1 enum');
      expect(tool.description).not.toContain('1 enums');
    });
  });

  describe('handler', () => {
    it('resolves a single enum name to its value table', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const output = unwrap(await tool.staticHandler!({ enum: 'JobWorkerTimesheetState' }, makeCtx()));

      expect(output.enums).toHaveLength(1);
      expect(output.enums[0]).toEqual(ENUMS['JobWorkerTimesheetState']);
      expect(output).not.toHaveProperty('notFound');
    });

    it('resolves an array of enum names and reports misses in notFound', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const output = unwrap(await tool.staticHandler!({ enum: ['JobWorkerTimesheetState', 'Ghost'] }, makeCtx()));

      expect(output.enums.map((e) => e.name)).toEqual(['JobWorkerTimesheetState']);
      expect(output.notFound).toEqual(['Ghost']);
    });

    it('trims surrounding whitespace before matching', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const output = unwrap(await tool.staticHandler!({ enum: '  DayOfWeek  ' }, makeCtx()));

      expect(output.enums.map((e) => e.name)).toEqual(['DayOfWeek']);
    });

    it('errors on a missing enum arg', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const result = await tool.staticHandler!({}, makeCtx());

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('"enum" is required');
    });

    it('errors on an empty array', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const result = await tool.staticHandler!({ enum: [] }, makeCtx());

      expect(result.isError).toBe(true);
    });

    it('errors on non-string entries', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const result = await tool.staticHandler!({ enum: ['JobWorkerTimesheetState', 7] }, makeCtx());

      expect(result.isError).toBe(true);
    });

    it('errors on an empty string name', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const result = await tool.staticHandler!({ enum: '   ' }, makeCtx());

      expect(result.isError).toBe(true);
    });
  });
});

describe('resolveEnumInfoOutput', () => {
  it('returns matches without notFound when every name resolves', () => {
    const out = resolveEnumInfoOutput(['DayOfWeek', 'JobWorkerTimesheetState'], ENUMS);
    expect(out.enums.map((e) => e.name)).toEqual(['DayOfWeek', 'JobWorkerTimesheetState']);
    expect(out).not.toHaveProperty('notFound');
  });

  it('collects unmatched names into notFound, preserving request order', () => {
    const out = resolveEnumInfoOutput(['Nope', 'DayOfWeek'], ENUMS);
    expect(out.enums.map((e) => e.name)).toEqual(['DayOfWeek']);
    expect(out.notFound).toEqual(['Nope']);
  });
});
