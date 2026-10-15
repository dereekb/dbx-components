import { describe, expect, it } from 'vitest';
import { type McpMethod } from '../mcp.method';
import { MCP_DESTRUCTIVE_TOOL_DESCRIPTION_PREFIX, MCP_WRITE_TOOL_DESCRIPTION_PREFIX } from '../mcp.tool-generator';
import { MCP_METHOD_SUMMARY_MAX_LENGTH, mcpMethodOneLineSummary } from './mcp.tool.compact-search';

function methodWithDescription(description: string): McpMethod {
  return { id: 'x.create', aliases: [], kind: 'write', source: 'callModel', definition: { description } } as unknown as McpMethod;
}

describe('mcpMethodOneLineSummary()', () => {
  it('should return the whole first sentence of a hard-wrapped description', () => {
    const summary = mcpMethodOneLineSummary(methodWithDescription('Self-service create: the authenticated, not-yet-affiliated caller creates an organization and\nbecomes its owner. Fails when already affiliated.'));
    expect(summary).toBe('Self-service create: the authenticated, not-yet-affiliated caller creates an organization and becomes its owner.');
  });

  it('should render {@link} tags as text', () => {
    expect(mcpMethodOneLineSummary(methodWithDescription('Queries {@link OpenRouterPrompt}s for the {@link Profile.uid}. More.'))).toBe('Queries OpenRouterPrompts for the Profile.uid.');
  });

  it('should strip the write and destructive markers', () => {
    expect(mcpMethodOneLineSummary(methodWithDescription(`${MCP_WRITE_TOOL_DESCRIPTION_PREFIX}Creates a thing. More.`))).toBe('Creates a thing.');
    expect(mcpMethodOneLineSummary(methodWithDescription(`${MCP_DESTRUCTIVE_TOOL_DESCRIPTION_PREFIX}Deletes a thing. More.`))).toBe('Deletes a thing.');
  });

  it('should cap a long sentence', () => {
    const summary = mcpMethodOneLineSummary(methodWithDescription(`${'word '.repeat(100)}end.`));
    expect(summary.length).toBeLessThanOrEqual(MCP_METHOD_SUMMARY_MAX_LENGTH);
    expect(summary.endsWith('…')).toBe(true);
  });
});
