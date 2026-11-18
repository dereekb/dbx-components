import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { hardenLlmResponseSchemaHint, normalizeLlmGeneratedSchema, projectLlmContractSchema, projectLlmResponseSchema } from './llm.capability.schema';

/**
 * Recursively assert that every `type: 'object'` node is hardened with `additionalProperties: false`, walking the real
 * child positions only.
 *
 * @param node - The schema node to check.
 */
function assertHardened(node: unknown): void {
  if (node != null && typeof node === 'object') {
    const schema = node as Record<string, unknown>;

    if (schema['type'] === 'object') {
      expect(schema['additionalProperties']).toBe(false);
    }

    const properties = schema['properties'];
    if (properties != null && typeof properties === 'object') {
      Object.values(properties as Record<string, unknown>).forEach(assertHardened);
    }

    assertHardened(schema['items']);
    ['anyOf', 'oneOf', 'allOf'].forEach((branch) => {
      const arms = schema[branch];
      if (Array.isArray(arms)) {
        arms.forEach(assertHardened);
      }
    });
  }
}

/**
 * Recursively assert that no node of a projection carries a `description`, walking the real child positions only (a
 * field NAMED `description` is not prose).
 *
 * @param node - The schema node to check.
 * @param path - The path walked so far (for the failure message).
 */
function assertNoDescriptions(node: unknown, path: string): void {
  if (node != null && typeof node === 'object') {
    const schema = node as Record<string, unknown>;
    expect(schema['description'], `${path} must carry no description`).toBeUndefined();

    const properties = schema['properties'];
    if (properties != null && typeof properties === 'object') {
      Object.entries(properties as Record<string, unknown>).forEach(([key, child]) => assertNoDescriptions(child, `${path}.${key}`));
    }

    assertNoDescriptions(schema['items'], `${path}[]`);
    ['anyOf', 'oneOf', 'allOf'].forEach((branch) => {
      const arms = schema[branch];
      if (Array.isArray(arms)) {
        arms.forEach((arm, index) => assertNoDescriptions(arm, `${path}.${branch}[${index}]`));
      }
    });
  }
}

/**
 * A deep copy of a projection with every `description` METADATA key removed. `properties` is a KEY SPACE, so a field
 * NAMED `description` survives.
 *
 * @param node - The schema node to copy.
 * @returns The copy, with schema-level descriptions dropped.
 */
function strippedOfDescriptions(node: unknown): unknown {
  let stripped: unknown;

  if (Array.isArray(node)) {
    stripped = node.map(strippedOfDescriptions);
  } else if (node != null && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>).filter(([key]) => key !== 'description');
    stripped = Object.fromEntries(
      entries.map(([key, value]) => {
        let mapped: unknown;

        if (key === 'properties' && value != null && typeof value === 'object') {
          mapped = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, strippedOfDescriptions(child)]));
        } else {
          mapped = strippedOfDescriptions(value);
        }

        return [key, mapped];
      })
    );
  } else {
    stripped = node;
  }

  return stripped;
}

describe('normalizeLlmGeneratedSchema', () => {
  it("strips arktype's $schema marker and hardens every object node", () => {
    const normalized = normalizeLlmGeneratedSchema(type({ outer: { 'inner?': 'string' } }).toJsonSchema());

    expect(normalized['$schema']).toBeUndefined();
    expect(normalized['additionalProperties']).toBe(false);
    expect((normalized['properties'] as Record<string, Record<string, unknown>>)['outer']?.['additionalProperties']).toBe(false);
  });

  it('folds a described literal union back to the undescribed emission plus one description', () => {
    const described = normalizeLlmGeneratedSchema(type({ k: type("'a'|'b'|'c'").describe('K prose') }).toJsonSchema());
    const bare = normalizeLlmGeneratedSchema(type({ k: "'a'|'b'|'c'" }).toJsonSchema());
    const node = (described['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(node?.['anyOf']).toBeUndefined();
    expect(described).toEqual({ ...bare, properties: { k: { ...((bare['properties'] as Record<string, unknown>)['k'] as object), description: 'K prose' } } });
  });

  it('hoists a repeated arm description off a heterogeneous union it cannot fold', () => {
    const described = normalizeLlmGeneratedSchema(type({ k: type('string').or('number').describe('either') }).toJsonSchema());
    const bare = normalizeLlmGeneratedSchema(type({ k: type('string').or('number') }).toJsonSchema());
    const node = (described['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(node?.['enum']).toBeUndefined();
    expect(described).toEqual({ ...bare, properties: { k: { ...((bare['properties'] as Record<string, unknown>)['k'] as object), description: 'either' } } });
  });

  it('hoists past an arm arktype left undescribed', () => {
    const described = normalizeLlmGeneratedSchema(type({ k: type('number | string | boolean | null').describe('the value') }).toJsonSchema());
    const bare = normalizeLlmGeneratedSchema(type({ k: 'number | string | boolean | null' }).toJsonSchema());
    const node = (described['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(
      ((node?.['anyOf'] ?? []) as ReadonlyArray<Record<string, unknown>>).some((arm) => arm['description'] != null),
      'no arm keeps a copy'
    ).toBe(false);
    expect(described).toEqual({ ...bare, properties: { k: { ...((bare['properties'] as Record<string, unknown>)['k'] as object), description: 'the value' } } });
  });

  it('leaves a union whose arms are documented SEPARATELY alone', () => {
    const node = normalizeLlmGeneratedSchema({
      anyOf: [
        { type: 'string', description: 'the slug form' },
        { type: 'integer', description: 'the raw id form' }
      ]
    });

    expect(node['description']).toBeUndefined();
    expect((node['anyOf'] as ReadonlyArray<Record<string, unknown>>)[0]?.['description']).toBe('the slug form');
  });

  it('leaves an object-or-boolean union untouched', () => {
    const union = normalizeLlmGeneratedSchema(type({ k: type({ 'label?': 'string' }).or('boolean') }).toJsonSchema());
    const node = (union['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(Array.isArray(node?.['anyOf'])).toBe(true);
    expect(node?.['enum']).toBeUndefined();
  });

  it('folds the const run of a MIXED union into one enum arm', () => {
    const node = normalizeLlmGeneratedSchema(type({ k: type("'a'|'b'|'c'").or(type("'a'|'b'|'c'").array()) }).toJsonSchema());
    const arms = (node['properties'] as Record<string, Record<string, unknown>>)['k']?.['anyOf'] as ReadonlyArray<Record<string, unknown>>;

    expect(arms.length, 'the array arm plus one folded enum arm').toBe(2);
    expect(arms.find((arm) => Array.isArray(arm['enum']))?.['enum']).toEqual(['a', 'b', 'c']);
    expect(arms.find((arm) => arm['type'] === 'array')?.['items']).toEqual({ enum: ['a', 'b', 'c'] });
  });

  it('leaves a single const arm beside a typed arm alone', () => {
    const node = normalizeLlmGeneratedSchema(type({ k: type("'auto'").or('number') }).toJsonSchema());
    const arms = (node['properties'] as Record<string, Record<string, unknown>>)['k']?.['anyOf'] as ReadonlyArray<Record<string, unknown>>;

    expect(arms.some((arm) => arm['const'] === 'auto')).toBe(true);
    expect(arms.some((arm) => Array.isArray(arm['enum']))).toBe(false);
  });

  it('does not fold arms whose descriptions disagree', () => {
    const node = normalizeLlmGeneratedSchema({
      anyOf: [
        { const: 'a', description: 'one' },
        { const: 'b', description: 'other' }
      ]
    });

    expect(node['enum']).toBeUndefined();
    expect(Array.isArray(node['anyOf'])).toBe(true);
  });

  it('does not mistake a field NAMED properties for schema structure', () => {
    const normalized = normalizeLlmGeneratedSchema(type({ properties: { 'weight?': 'number' } }).toJsonSchema());
    const map = normalized['properties'] as Record<string, unknown>;

    expect(Object.keys(map)).toEqual(['properties']);
    expect((map['properties'] as Record<string, unknown>)['additionalProperties']).toBe(false);
  });

  it('strips every description at every depth when asked', () => {
    const schema = type({ outer: type({ inner: type('string').describe('the inner') }).describe('the outer') });
    const stripped = JSON.stringify(normalizeLlmGeneratedSchema(schema.toJsonSchema(), { stripDescriptions: true }));

    expect(stripped).not.toContain('description');
    expect(JSON.stringify(normalizeLlmGeneratedSchema(schema.toJsonSchema()))).toContain('the inner');
  });

  it('is idempotent and leaves its input untouched', () => {
    const generated = type({ k: type("'a'|'b'").describe('K') }).toJsonSchema() as Record<string, unknown>;
    const source = JSON.stringify(generated);
    const once = normalizeLlmGeneratedSchema(generated);

    expect(normalizeLlmGeneratedSchema(once)).toEqual(once);
    expect(JSON.stringify(generated)).toBe(source);
  });
});

const DESCRIBED_SCHEMA = type({
  title: type('string').describe('the product title, as shown on the shelf'),
  description: type('string').describe('a field named description'),
  'tags?': type("'new'|'sale'").describe('a merchandising tag').array(),
  products: type({ sku: type('string').describe('the stock-keeping unit'), qty: 'number' }).array()
});

describe('hardenLlmResponseSchemaHint()', () => {
  it('strips descriptions by default and keeps them with describe: true', () => {
    const generated = DESCRIBED_SCHEMA.toJsonSchema();
    const stripped = hardenLlmResponseSchemaHint(generated);
    const described = hardenLlmResponseSchemaHint(generated, { describe: true });

    assertNoDescriptions(stripped, 'root');
    expect(JSON.stringify(described)).toContain('the product title, as shown on the shelf');
  });

  it('differs only by description between the two halves', () => {
    const generated = DESCRIBED_SCHEMA.toJsonSchema();
    expect(strippedOfDescriptions(hardenLlmResponseSchemaHint(generated, { describe: true }))).toEqual(hardenLlmResponseSchemaHint(generated));
  });

  it('is idempotent', () => {
    const once = hardenLlmResponseSchemaHint(DESCRIBED_SCHEMA.toJsonSchema());
    expect(hardenLlmResponseSchemaHint(once)).toEqual(once);
  });
});

describe('projectLlmResponseSchema()', () => {
  const projected = projectLlmResponseSchema(DESCRIBED_SCHEMA);

  it('drops $schema, hardens every object node and carries no descriptions', () => {
    expect(projected['$schema']).toBeUndefined();
    assertHardened(projected);
    assertNoDescriptions(projected, 'root');
  });

  it('keeps the required list at the root and on array items', () => {
    const products = (projected['properties'] as Record<string, Record<string, unknown>>)['products'];
    const items = products?.['items'] as Record<string, unknown>;

    expect(projected['required']).toEqual(expect.arrayContaining(['title', 'description', 'products']));
    expect(projected['required']).not.toContain('tags');
    expect(items['required']).toEqual(['qty', 'sku']);
  });

  it('keeps a field named description', () => {
    expect(Object.keys(projected['properties'] as object)).toContain('description');
  });

  it('throws on a narrowed schema (why defineLlmCapability takes a hintSchema)', () => {
    const narrowed = type({ pass: 'boolean' }).narrow(() => true);
    expect(() => projectLlmResponseSchema(narrowed)).toThrow();
  });
});

describe('projectLlmContractSchema()', () => {
  it('is the response projection plus the description keys', () => {
    expect(strippedOfDescriptions(projectLlmContractSchema(DESCRIBED_SCHEMA))).toEqual(projectLlmResponseSchema(DESCRIBED_SCHEMA));
    expect(JSON.stringify(projectLlmContractSchema(DESCRIBED_SCHEMA))).toContain('the stock-keeping unit');
  });
});
