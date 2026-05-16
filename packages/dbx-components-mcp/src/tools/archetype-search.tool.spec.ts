import { describe, expect, it } from 'vitest';
import { archetypeSearchTool } from './archetype-search.tool.js';

async function runSearch(args: Record<string, unknown>) {
  const result = await archetypeSearchTool.run(args);
  return { result, text: result.content.map((c) => c.text).join('\n') };
}

describe('dbx_model_archetype_search', () => {
  it('rejects unknown archetype slugs', async () => {
    const { result, text } = await runSearch({ archetype: 'not-real' });
    expect(result.isError).toBe(true);
    expect(text).toContain('Unknown archetype slug');
  });

  it('reports zero peers gracefully when none match', async () => {
    const { text } = await runSearch({ archetype: 'audit-log', scope: 'upstream' });
    expect(text).toContain('# Peer models for `audit-log`');
  });

  it('resolves alias to the v3 slug in the header', async () => {
    const { text } = await runSearch({ archetype: 'entity-private', scope: 'upstream' });
    expect(text).toContain('alias `entity-private` → `single-item-sub`');
  });
});
