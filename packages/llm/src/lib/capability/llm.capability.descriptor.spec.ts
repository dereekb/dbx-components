import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { resolveLlmCapabilityModel } from '../model/llm.model.precedence';
import { compileLlmModelRouting } from '../model/llm.model.routing';
import { defineLlmCapability, type LlmCapabilityDescriptor, type LlmCapabilityDescriptorReader } from './llm.capability.descriptor';

interface HostTraits {
  readonly audience: string;
  readonly readerFacing?: boolean;
}

const SUMMARY_SCHEMA = type({ summary: 'string' });

const SUMMARIZE: LlmCapabilityDescriptor<{ readonly summary: string }, HostTraits> = {
  capability: 'summarize',
  tags: ['writing'],
  tier: 'strong',
  replyProtocol: 'json',
  frames: { 'brand-voice': 'context', disclaimer: 'off' },
  traits: { audience: 'staff', readerFacing: true },
  responseSchema: SUMMARY_SCHEMA,
  parseValue: (value) => {
    const parsed = SUMMARY_SCHEMA(value);
    return parsed instanceof type.errors ? undefined : parsed;
  },
  responseSchemaHint: () => ({ type: 'object' }),
  contractSchemaHint: () => ({ type: 'object' })
};

const CLASSIFY: LlmCapabilityDescriptor<unknown, HostTraits> = {
  capability: 'classify',
  responseSchema: type({ label: 'string' }),
  parseValue: (value) => value,
  responseSchemaHint: () => ({}),
  contractSchemaHint: () => ({})
};

describe('LlmCapabilityDescriptor', () => {
  it('should pass to compileLlmModelRouting as a capability ref and route by its tags', () => {
    const routes = compileLlmModelRouting({ routing: { rules: [{ tags: ['writing'], tier: 'fast' }] }, capabilities: [SUMMARIZE, CLASSIFY], tiers: { fast: 'model/fast', strong: 'model/strong' } });
    expect(routes.get('summarize')?.model).toBe('model/fast');
    expect(routes.has('classify')).toBe(false);
  });

  it('should pass to resolveLlmCapabilityModel as the descriptor and resolve by its tier', () => {
    const resolved = resolveLlmCapabilityModel({ descriptor: SUMMARIZE, tiers: { fast: 'model/fast', strong: 'model/strong' }, defaultTier: 'fast' });
    expect(resolved.model).toBe('model/strong');
    expect(resolved.source).toBe('descriptor-tier');
  });

  it('should carry typed traits and a slot-keyed frames policy', () => {
    const descriptorOf: LlmCapabilityDescriptorReader<LlmCapabilityDescriptor<unknown, HostTraits>> = (capability) => [SUMMARIZE, CLASSIFY].find((x) => x.capability === capability);
    const audience: string | undefined = descriptorOf('summarize')?.traits?.audience;

    expect(audience).toBe('staff');
    expect(descriptorOf('summarize')?.frames?.['brand-voice']).toBe('context');
    expect(descriptorOf('summarize')?.frames?.['disclaimer']).toBe('off');
    expect(descriptorOf('extract')).toBeUndefined();
    expect(SUMMARIZE.parseValue({ summary: 'ok' })).toEqual({ summary: 'ok' });
    expect(SUMMARIZE.parseValue({ summary: 1 })).toBeUndefined();
  });
});

describe('defineLlmCapability()', () => {
  const DESCRIBED_SCHEMA = type({ title: type('string').describe('the product title'), 'tags?': type("'new'|'sale'").describe('a merchandising tag').array() });
  const parseValue = (value: unknown) => {
    const parsed = DESCRIBED_SCHEMA(value);
    return parsed instanceof type.errors ? undefined : parsed;
  };

  it('projects a hardened, undescribed responseSchemaHint and a described contractSchemaHint from responseSchema', () => {
    const descriptor = defineLlmCapability({ capability: 'draft-copy', responseSchema: DESCRIBED_SCHEMA, parseValue });
    const response = descriptor.responseSchemaHint() as Record<string, unknown>;
    const contract = descriptor.contractSchemaHint() as Record<string, unknown>;

    expect(response['$schema']).toBeUndefined();
    expect(response['additionalProperties']).toBe(false);
    expect(JSON.stringify(response)).not.toContain('description');
    expect(JSON.stringify(contract)).toContain('the product title');
  });

  it('memoizes each hint', () => {
    const descriptor = defineLlmCapability({ capability: 'draft-copy', responseSchema: DESCRIBED_SCHEMA, parseValue });

    expect(descriptor.responseSchemaHint()).toBe(descriptor.responseSchemaHint());
    expect(descriptor.contractSchemaHint()).toBe(descriptor.contractSchemaHint());
  });

  it('keeps the prose in responseSchemaHint when describeResponseSchemaHint is set', () => {
    const descriptor = defineLlmCapability({ capability: 'draft-copy', responseSchema: DESCRIBED_SCHEMA, parseValue, describeResponseSchemaHint: true });
    expect(descriptor.responseSchemaHint()).toEqual(descriptor.contractSchemaHint());
  });

  describe('hintSchema', () => {
    const STRICT = type({ kind: type("'scene'|'beat'").describe('what the reply builds'), title: 'string' });
    const TOLERANT = type({ 'kind?': "'scene'|'beat'", title: 'string' });
    const parseTolerant = (value: unknown) => {
      const parsed = TOLERANT(value);
      return parsed instanceof type.errors ? undefined : parsed;
    };

    it('projects both hints from the strict hintSchema while the tolerant responseSchema is enforced', () => {
      const descriptor = defineLlmCapability({ capability: 'build-scene', responseSchema: TOLERANT, hintSchema: STRICT, parseValue: parseTolerant });
      const response = descriptor.responseSchemaHint() as { readonly required?: ReadonlyArray<string> };
      const contract = descriptor.contractSchemaHint() as { readonly required?: ReadonlyArray<string> };

      expect(response.required).toContain('kind');
      expect(contract.required).toContain('kind');
      expect(JSON.stringify(response)).not.toContain('what the reply builds');
      expect(JSON.stringify(contract)).toContain('what the reply builds');
      expect(descriptor.responseSchema).toBe(TOLERANT);
      expect(descriptor.parseValue({ title: 'no kind' })).toEqual({ title: 'no kind' });
      expect('hintSchema' in descriptor).toBe(false);
    });

    it("keeps the hint schema's descriptions in responseSchemaHint when describeResponseSchemaHint is set", () => {
      const descriptor = defineLlmCapability({ capability: 'build-scene', responseSchema: TOLERANT, hintSchema: STRICT, parseValue: parseTolerant, describeResponseSchemaHint: true });

      expect(JSON.stringify(descriptor.responseSchemaHint())).toContain('what the reply builds');
      expect(descriptor.responseSchemaHint()).toEqual(descriptor.contractSchemaHint());
    });
  });

  describe('narrowed schemas', () => {
    const base = type({ pass: 'boolean', 'feedback?': 'string' });
    const narrowed = base.narrow((value) => value.pass || value.feedback != null);

    it('projects both hints of a narrowed responseSchema from its JSON base', () => {
      const descriptor = defineLlmCapability({ capability: 'classify-intent', responseSchema: narrowed, parseValue: (value) => value });

      expect(descriptor.responseSchemaHint()).toEqual({ type: 'object', properties: { pass: { type: 'boolean' }, feedback: { type: 'string' } }, required: ['pass'], additionalProperties: false });
      expect(descriptor.contractSchemaHint()).toEqual(descriptor.responseSchemaHint());
      expect(descriptor.responseSchemaHint()).toEqual(defineLlmCapability({ capability: 'classify-intent', responseSchema: base, parseValue: (value) => value }).responseSchemaHint());
    });

    it('throws on the first projection of a type with no JSON form, and again on the next (not cached)', () => {
      const descriptor = defineLlmCapability({ capability: 'classify-intent', responseSchema: type({ at: 'Date' }), parseValue: (value) => value });

      expect(() => descriptor.responseSchemaHint()).toThrow();
      expect(() => descriptor.responseSchemaHint()).toThrow();
      expect(() => descriptor.contractSchemaHint()).toThrow();
    });
  });

  it('passes every other field through', () => {
    const descriptor = defineLlmCapability<{ readonly title: string }, HostTraits>({
      capability: 'summarize',
      tags: ['writing'],
      tier: 'strong',
      replyProtocol: 'json-envelope',
      mustResolve: true,
      rawJsonContext: true,
      frames: { 'brand-voice': 'context' },
      traits: { audience: 'staff' },
      responseSchema: DESCRIBED_SCHEMA,
      parseValue
    });

    expect(descriptor).toMatchObject({ capability: 'summarize', tags: ['writing'], tier: 'strong', replyProtocol: 'json-envelope', mustResolve: true, rawJsonContext: true, frames: { 'brand-voice': 'context' }, traits: { audience: 'staff' } });
    expect(descriptor.parseValue).toBe(parseValue);
    expect(descriptor.responseSchema).toBe(DESCRIBED_SCHEMA);
    expect('describeResponseSchemaHint' in descriptor).toBe(false);

    const routes = compileLlmModelRouting({ routing: { rules: [{ tags: ['writing'], tier: 'fast' }] }, capabilities: [descriptor], tiers: { fast: 'model/fast', strong: 'model/strong' } });
    expect(routes.get('summarize')?.model).toBe('model/fast');
    expect(resolveLlmCapabilityModel({ descriptor, tiers: { fast: 'model/fast', strong: 'model/strong' }, defaultTier: 'fast' }).model).toBe('model/strong');
  });
});
