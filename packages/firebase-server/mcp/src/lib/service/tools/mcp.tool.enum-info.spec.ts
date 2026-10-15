import type { CallToolResult } from '@modelcontextprotocol/server';
import { type McpManifestEnum } from '../mcp.manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { createEnumInfoTool, resolveEnumInfoListOutput, resolveEnumInfoOutput, ENUM_INFO_NOT_FOUND_HINT, ENUM_INFO_TOOL_NAME, type EnumInfoToolListOutput, type EnumInfoToolLookupOutput } from './mcp.tool.enum-info';

function makeCtx(): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function unwrap(result: CallToolResult): EnumInfoToolLookupOutput {
  const content: unknown = result.structuredContent;
  return content as EnumInfoToolLookupOutput;
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
      expect(tool.annotations).toEqual({ readOnlyHint: true });
      expect(tool.staticWireEntry.annotations).toEqual({ readOnlyHint: true });
      expect(tool.filterMetadata.visibilityKind).toBe('declarative');

      if (tool.filterMetadata.visibilityKind === 'declarative') {
        expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
      }

      expect(tool.inputSchema).toMatchObject({ type: 'object' });
      expect(tool.inputSchema).not.toHaveProperty('required');
      expect(tool.outputSchema).toMatchObject({ type: 'object', anyOf: [{ required: ['enums'] }, { required: ['names'] }] });
    });

    it('mentions the registered enum count, pluralized', () => {
      expect(createEnumInfoTool({ enums: ENUMS }).description).toContain('2 enums');
    });

    it('singularizes the description for one enum', () => {
      const tool = createEnumInfoTool({ enums: { DayOfWeek: ENUMS['DayOfWeek'] } });
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
      expect(output.hint).toBe(ENUM_INFO_NOT_FOUND_HINT);
    });

    it('trims surrounding whitespace before matching', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const output = unwrap(await tool.staticHandler!({ enum: '  DayOfWeek  ' }, makeCtx()));

      expect(output.enums.map((e) => e.name)).toEqual(['DayOfWeek']);
    });

    it('lists the sorted enum names when no enum arg is passed', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const result = await tool.staticHandler!({}, makeCtx());
      const output = result.structuredContent as unknown as EnumInfoToolListOutput;

      expect(result.isError).toBeFalsy();
      expect(output.names).toEqual(Object.keys(ENUMS).sort((a, b) => a.localeCompare(b)));
      expect(output.total).toBe(Object.keys(ENUMS).length);
    });

    it('lists the enum names when enum is null', async () => {
      const tool = createEnumInfoTool({ enums: ENUMS });
      const result = await tool.staticHandler!({ enum: null }, makeCtx());
      expect((result.structuredContent as unknown as EnumInfoToolListOutput).total).toBe(Object.keys(ENUMS).length);
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

describe('createEnumInfoTool text', () => {
  it('mentions the list mode in the description', () => {
    expect(createEnumInfoTool({ enums: ENUMS }).description).toContain('Call with no arguments to list the registered enum names.');
  });

  it('uses no example name by default', () => {
    const tool = createEnumInfoTool({ enums: ENUMS });
    expect(tool.description).not.toContain('e.g.');
    expect(JSON.stringify(tool.inputSchema)).not.toContain('e.g.');
  });

  it('uses the configured example name', () => {
    const tool = createEnumInfoTool({ enums: ENUMS, examples: { enumName: 'DayOfWeek' } });
    expect(tool.description).toContain('e.g. "DayOfWeek"');
    expect(JSON.stringify(tool.inputSchema)).toContain(String.raw`e.g. \"DayOfWeek\"`);
  });
});

describe('resolveEnumInfoListOutput', () => {
  it('returns the sorted names and total', () => {
    const out = resolveEnumInfoListOutput({ b: ENUMS['DayOfWeek'], a: ENUMS['DayOfWeek'] });
    expect(out).toEqual({ names: ['a', 'b'], total: 2 });
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
