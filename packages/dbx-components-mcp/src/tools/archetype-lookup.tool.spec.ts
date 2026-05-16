import { describe, expect, it } from 'vitest';
import { archetypeLookupTool } from './archetype-lookup.tool.js';

function runLookup(args: Record<string, unknown>) {
  const result = archetypeLookupTool.run(args);
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

  it('renders a v3 archetype', () => {
    const { text } = runLookup({ slug: 'root-entity' });
    expect(text).toContain('# Archetype: `root-entity`');
  });

  it('resolves entity-private alias to single-item-sub with deprecation note', () => {
    const { text } = runLookup({ slug: 'entity-private' });
    expect(text).toContain('# Archetype: `single-item-sub`');
    expect(text).toContain('Deprecated alias `entity-private`');
  });

  it('resolves subcollection-entity alias to sub-collection-entity', () => {
    const { text } = runLookup({ slug: 'subcollection-entity' });
    expect(text).toContain('# Archetype: `sub-collection-entity`');
    expect(text).toContain('Deprecated alias `subcollection-entity`');
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
