import { type, type Type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { clearable } from './type';
import { arktypeToJsonSchemaForExport, asJsonSchemaNode, pruneFalseUnionBranches, readJsonSchemaProperties, readJsonSchemaRequired, toStrictJsonSchema } from './type.json.schema';

describe('pruneFalseUnionBranches()', () => {
  it('drops `false` entries from anyOf', () => {
    const schema = { anyOf: [{ type: 'string' }, false, { type: 'null' }] };
    expect(pruneFalseUnionBranches(schema)).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
  });

  it('drops `false` entries from oneOf', () => {
    const schema = { oneOf: [false, { type: 'string' }] };
    expect(pruneFalseUnionBranches(schema)).toEqual({ oneOf: [{ type: 'string' }] });
  });

  it('removes the anyOf key entirely if all branches were false', () => {
    const schema = { type: 'object', properties: { value: { anyOf: [false] } } };
    expect(pruneFalseUnionBranches(schema)).toEqual({ type: 'object', properties: { value: {} } });
  });

  it('recurses into nested anyOf inside properties', () => {
    const schema = {
      type: 'object',
      properties: {
        flag: { anyOf: [{ type: 'boolean' }, false] }
      }
    };
    expect(pruneFalseUnionBranches(schema)).toEqual({
      type: 'object',
      properties: {
        flag: { anyOf: [{ type: 'boolean' }] }
      }
    });
  });

  it('returns primitives unchanged', () => {
    expect(pruneFalseUnionBranches('hello')).toBe('hello');
    expect(pruneFalseUnionBranches(42)).toBe(42);
    expect(pruneFalseUnionBranches(null)).toBe(null);
  });
});

describe('arktypeToJsonSchemaForExport()', () => {
  it('exports a narrowed string base instead of an empty {} schema', () => {
    const narrowed = type('string > 0').narrow(() => true) as unknown as Type<unknown>;
    const result = arktypeToJsonSchemaForExport(narrowed) as { type?: string; minLength?: number };

    expect(result.type).toBe('string');
    expect(result.minLength).toBe(1);
  });

  it('removes the undefined branch from clearable() unions', () => {
    const schema = type({ value: clearable('string > 0') });
    const result = arktypeToJsonSchemaForExport(schema as unknown as Type<unknown>) as {
      properties?: { value?: { anyOf?: ReadonlyArray<unknown> } };
    };

    const branches = result.properties?.value?.anyOf;
    expect(branches).toBeDefined();
    // Should have exactly the string base + null branch (the undefined branch is pruned).
    expect(branches?.length).toBe(2);
    expect(branches).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'string', minLength: 1 }), expect.objectContaining({ type: 'null' })]));
    // No empty-object junk branch.
    expect(branches?.some((b) => b !== null && typeof b === 'object' && Object.keys(b).length === 0)).toBe(false);
  });
});

describe('arktypeToJsonSchemaForExport() with strict', () => {
  it('exports a narrowed object from its JSON base and keeps its description', () => {
    const base = type({ pass: 'boolean', 'feedback?': 'string' });
    const narrowed = base.narrow(() => true).describe('the verdict');

    expect(arktypeToJsonSchemaForExport(narrowed, { strict: true })).toEqual({ ...(base.toJsonSchema() as object), description: 'the verdict' });
  });

  it('exports a narrowed field from its JSON base and keeps its description', () => {
    const narrowed = type({
      title: type('string')
        .narrow((s) => s.length > 0)
        .describe('the title')
    });
    const result = arktypeToJsonSchemaForExport(narrowed, { strict: true }) as { properties: Record<string, unknown> };

    expect(result.properties['title']).toEqual({ type: 'string', description: 'the title' });
  });

  it('exports a morph from its input base', () => {
    const result = arktypeToJsonSchemaForExport(type({ k: 'string.numeric.parse' }), { strict: true }) as { properties: Record<string, Record<string, unknown>> };
    expect(result.properties['k']?.['type']).toBe('string');
  });

  it('throws on a Date field', () => {
    expect(() => arktypeToJsonSchemaForExport(type({ d: 'Date' }), { strict: true })).toThrow();
  });

  it('throws on an undefined union arm', () => {
    expect(() => arktypeToJsonSchemaForExport(type({ k: 'string | undefined' }), { strict: true })).toThrow();
    expect(() => arktypeToJsonSchemaForExport(type({ k: clearable('string') }), { strict: true })).toThrow();
  });

  it('throws on a symbol field', () => {
    expect(() => arktypeToJsonSchemaForExport(type({ s: 'symbol' }), { strict: true })).toThrow();
  });

  it('exports a JSON-shaped schema exactly as bare toJsonSchema() does', () => {
    const schema = type({ a: 'string', 'b?': 'number[]', pair: ['string', 'number'], e: "'x'|'y'", n: 'number.integer >= 0' });
    expect(arktypeToJsonSchemaForExport(schema, { strict: true })).toEqual(schema.toJsonSchema());
  });

  it('keeps the non-strict default for a Date field', () => {
    const result = arktypeToJsonSchemaForExport(type({ d: 'Date' }) as unknown as Type<unknown>) as { properties: Record<string, unknown> };
    expect(result.properties['d']).toBe(false);
  });
});

describe('toStrictJsonSchema()', () => {
  it("strips arktype's $schema marker and hardens every object node", () => {
    const normalized = toStrictJsonSchema(type({ outer: { 'inner?': 'string' } }).toJsonSchema());

    expect(normalized['$schema']).toBeUndefined();
    expect(normalized['additionalProperties']).toBe(false);
    expect((normalized['properties'] as Record<string, Record<string, unknown>>)['outer']?.['additionalProperties']).toBe(false);
  });

  it('folds a described literal union back to the undescribed emission plus one description', () => {
    const described = toStrictJsonSchema(type({ k: type("'a'|'b'|'c'").describe('K prose') }).toJsonSchema());
    const bare = toStrictJsonSchema(type({ k: "'a'|'b'|'c'" }).toJsonSchema());
    const node = (described['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(node?.['anyOf']).toBeUndefined();
    expect(described).toEqual({ ...bare, properties: { k: { ...((bare['properties'] as Record<string, unknown>)['k'] as object), description: 'K prose' } } });
  });

  it('hoists a repeated arm description off a heterogeneous union it cannot fold', () => {
    const described = toStrictJsonSchema(type({ k: type('string').or('number').describe('either') }).toJsonSchema());
    const bare = toStrictJsonSchema(type({ k: type('string').or('number') }).toJsonSchema());
    const node = (described['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(node?.['enum']).toBeUndefined();
    expect(described).toEqual({ ...bare, properties: { k: { ...((bare['properties'] as Record<string, unknown>)['k'] as object), description: 'either' } } });
  });

  it('hoists past an arm arktype left undescribed', () => {
    const described = toStrictJsonSchema(type({ k: type('number | string | boolean | null').describe('the value') }).toJsonSchema());
    const bare = toStrictJsonSchema(type({ k: 'number | string | boolean | null' }).toJsonSchema());
    const node = (described['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(
      ((node?.['anyOf'] ?? []) as ReadonlyArray<Record<string, unknown>>).some((arm) => arm['description'] != null),
      'no arm keeps a copy'
    ).toBe(false);
    expect(described).toEqual({ ...bare, properties: { k: { ...((bare['properties'] as Record<string, unknown>)['k'] as object), description: 'the value' } } });
  });

  it('leaves a union whose arms are documented SEPARATELY alone', () => {
    const node = toStrictJsonSchema({
      anyOf: [
        { type: 'string', description: 'the slug form' },
        { type: 'integer', description: 'the raw id form' }
      ]
    });

    expect(node['description']).toBeUndefined();
    expect((node['anyOf'] as ReadonlyArray<Record<string, unknown>>)[0]?.['description']).toBe('the slug form');
  });

  it('leaves an object-or-boolean union untouched', () => {
    const union = toStrictJsonSchema(type({ k: type({ 'label?': 'string' }).or('boolean') }).toJsonSchema());
    const node = (union['properties'] as Record<string, Record<string, unknown>>)['k'];

    expect(Array.isArray(node?.['anyOf'])).toBe(true);
    expect(node?.['enum']).toBeUndefined();
  });

  it('folds the const run of a MIXED union into one enum arm', () => {
    const node = toStrictJsonSchema(type({ k: type("'a'|'b'|'c'").or(type("'a'|'b'|'c'").array()) }).toJsonSchema());
    const arms = (node['properties'] as Record<string, Record<string, unknown>>)['k']?.['anyOf'] as ReadonlyArray<Record<string, unknown>>;

    expect(arms.length, 'the array arm plus one folded enum arm').toBe(2);
    expect(arms.find((arm) => Array.isArray(arm['enum']))?.['enum']).toEqual(['a', 'b', 'c']);
    expect(arms.find((arm) => arm['type'] === 'array')?.['items']).toEqual({ enum: ['a', 'b', 'c'] });
  });

  it('leaves a single const arm beside a typed arm alone', () => {
    const node = toStrictJsonSchema(type({ k: type("'auto'").or('number') }).toJsonSchema());
    const arms = (node['properties'] as Record<string, Record<string, unknown>>)['k']?.['anyOf'] as ReadonlyArray<Record<string, unknown>>;

    expect(arms.some((arm) => arm['const'] === 'auto')).toBe(true);
    expect(arms.some((arm) => Array.isArray(arm['enum']))).toBe(false);
  });

  it('does not fold arms whose descriptions disagree', () => {
    const node = toStrictJsonSchema({
      anyOf: [
        { const: 'a', description: 'one' },
        { const: 'b', description: 'other' }
      ]
    });

    expect(node['enum']).toBeUndefined();
    expect(Array.isArray(node['anyOf'])).toBe(true);
  });

  it('does not mistake a field NAMED properties for schema structure', () => {
    const normalized = toStrictJsonSchema(type({ properties: { 'weight?': 'number' } }).toJsonSchema());
    const map = normalized['properties'] as Record<string, unknown>;

    expect(Object.keys(map)).toEqual(['properties']);
    expect((map['properties'] as Record<string, unknown>)['additionalProperties']).toBe(false);
  });

  it('strips every description at every depth when asked', () => {
    const schema = type({ outer: type({ inner: type('string').describe('the inner') }).describe('the outer') });
    const stripped = JSON.stringify(toStrictJsonSchema(schema.toJsonSchema(), { stripDescriptions: true }));

    expect(stripped).not.toContain('description');
    expect(JSON.stringify(toStrictJsonSchema(schema.toJsonSchema()))).toContain('the inner');
  });

  it('is idempotent and leaves its input untouched', () => {
    const generated = type({ k: type("'a'|'b'").describe('K') }).toJsonSchema() as Record<string, unknown>;
    const source = JSON.stringify(generated);
    const once = toStrictJsonSchema(generated);

    expect(toStrictJsonSchema(once)).toEqual(once);
    expect(JSON.stringify(generated)).toBe(source);
  });
});

describe('asJsonSchemaNode()', () => {
  it('returns an object value as the node', () => {
    const node = { type: 'string' };
    expect(asJsonSchemaNode(node)).toBe(node);
  });

  it('reads a boolean, null or primitive value as an empty node', () => {
    expect(asJsonSchemaNode(false)).toEqual({});
    expect(asJsonSchemaNode(true)).toEqual({});
    expect(asJsonSchemaNode(null)).toEqual({});
    expect(asJsonSchemaNode(undefined)).toEqual({});
    expect(asJsonSchemaNode('string')).toEqual({});
  });
});

describe('readJsonSchemaProperties()', () => {
  it('returns the properties in insertion order', () => {
    const node = { type: 'object', properties: { b: { type: 'number' }, a: { type: 'string' } } };
    expect(readJsonSchemaProperties(node)).toEqual([
      ['b', { type: 'number' }],
      ['a', { type: 'string' }]
    ]);
  });

  it('reads a non-object property value as an empty node', () => {
    expect(readJsonSchemaProperties({ properties: { k: false } })).toEqual([['k', {}]]);
  });

  it('returns none when properties is absent or not an object', () => {
    expect(readJsonSchemaProperties({ type: 'object' })).toEqual([]);
    expect(readJsonSchemaProperties({ properties: 'x' })).toEqual([]);
  });
});

describe('readJsonSchemaRequired()', () => {
  it('returns the string entries of required', () => {
    expect(readJsonSchemaRequired({ required: ['a', 1, 'b'] })).toEqual(['a', 'b']);
  });

  it('returns none when required is absent or not an array', () => {
    expect(readJsonSchemaRequired({})).toEqual([]);
    expect(readJsonSchemaRequired({ required: 'a' })).toEqual([]);
  });
});
