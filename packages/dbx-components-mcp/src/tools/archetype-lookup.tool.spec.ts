import { describe, expect, it } from 'vitest';
import { ARCHETYPE_LOOKUP_TOOL } from './archetype-lookup.tool.js';

function runLookup(args: Record<string, unknown>) {
  const result = ARCHETYPE_LOOKUP_TOOL.run(args);
  if (result instanceof Promise) throw new Error('expected synchronous result');
  return { result, text: result.content.map((c) => c.text).join('\n') };
}

describe('dbx_model_archetype_lookup', () => {
  it('renders the catalog when slug = "list"', () => {
    const { text } = runLookup({ slug: 'list' });
    expect(text).toContain('# Model archetypes');
    expect(text).toContain('standalone-entity');
    expect(text).toContain('denormalised-aggregate');
  });

  it('renders an archetype', () => {
    const { text } = runLookup({ slug: 'root-entity' });
    expect(text).toContain('# Archetype: `root-entity`');
  });

  it('reports unknown slug', () => {
    const { result, text } = runLookup({ slug: 'not-a-real-archetype' });
    expect(result.isError).toBe(true);
    expect(text).toContain('No archetype matched');
  });

  it('shows axes section for archetypes with axes', () => {
    const { text } = runLookup({ slug: 'single-item-sub' });
    expect(text).toContain('subPurpose');
  });
});
