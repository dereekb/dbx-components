import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { hardenLlmResponseSchemaHint, projectLlmContractSchema, projectLlmResponseSchema } from './llm.capability.schema';

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

  it('projects a narrowed schema from its JSON base', () => {
    const base = type({ pass: 'boolean', 'feedback?': 'string' });
    const narrowed = base.narrow(() => true);
    expect(projectLlmResponseSchema(narrowed)).toEqual(projectLlmResponseSchema(base));
  });

  it('throws on a type with no JSON form (Date)', () => {
    expect(() => projectLlmResponseSchema(type({ at: 'Date' }))).toThrow();
  });

  it('closes the objects inside a tuple (prefixItems)', () => {
    expect(projectLlmResponseSchema(type({ pair: [{ a: 'string' }, { b: 'number' }] }))).toEqual({
      type: 'object',
      properties: {
        pair: {
          type: 'array',
          minItems: 2,
          prefixItems: [
            { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false },
            { type: 'object', properties: { b: { type: 'number' } }, required: ['b'], additionalProperties: false }
          ],
          items: false
        }
      },
      required: ['pair'],
      additionalProperties: false
    });
  });

  it('strips the descriptions inside a tuple and keeps them in the contract projection', () => {
    const schema = type({ pair: [type({ a: type('string').describe('the a') }).describe('the first'), { b: 'number' }] });

    expect(JSON.stringify(projectLlmResponseSchema(schema))).not.toContain('description');
    expect(projectLlmResponseSchema(schema)).toEqual(projectLlmResponseSchema(type({ pair: [{ a: 'string' }, { b: 'number' }] })));
    expect(JSON.stringify(projectLlmContractSchema(schema))).toContain('the first');
  });

  it('closes the objects inside $defs for a cyclic scope and strips their descriptions', () => {
    const tree = type.scope({ node: { name: type('string').describe('the node name'), 'children?': 'node[]' } }).export();
    const schema = type({ tree: tree.node });
    const projected = projectLlmResponseSchema(schema);
    const defs = Object.values(projected['$defs'] as Record<string, Record<string, unknown>>);
    const objects = defs.filter((def) => def['type'] === 'object');

    expect(projected['$ref']).toEqual(expect.any(String));
    expect(objects.length, 'the root object and the node object').toBe(2);
    expect(objects.map((def) => def['additionalProperties'])).toEqual([false, false]);
    expect(JSON.stringify(projected)).not.toContain('description');
    expect(JSON.stringify(projectLlmContractSchema(schema))).toContain('the node name');
  });
});

describe('projectLlmContractSchema()', () => {
  it('is the response projection plus the description keys', () => {
    expect(strippedOfDescriptions(projectLlmContractSchema(DESCRIBED_SCHEMA))).toEqual(projectLlmResponseSchema(DESCRIBED_SCHEMA));
    expect(JSON.stringify(projectLlmContractSchema(DESCRIBED_SCHEMA))).toContain('the stock-keeping unit');
  });
});
