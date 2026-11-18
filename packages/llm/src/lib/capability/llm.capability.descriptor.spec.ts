import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { resolveLlmCapabilityModel } from '../model/llm.model.precedence';
import { compileLlmModelRouting } from '../model/llm.model.routing';
import { defineLlmCapability, type LlmCapabilityDescriptor, type LlmCapabilityDescriptorOf } from './llm.capability.descriptor';

interface HostTraits {
  readonly voice: string;
  readonly readerFacing?: boolean;
}

const SUMMARY_SCHEMA = type({ summary: 'string' });

const SUMMARIZE: LlmCapabilityDescriptor<{ readonly summary: string }, HostTraits> = {
  capability: 'summarize',
  tags: ['writing'],
  tier: 'strong',
  replyProtocol: 'json',
  frames: { 'brand-voice': 'context', disclaimer: 'off' },
  traits: { voice: 'narrator', readerFacing: true },
  responseSchema: SUMMARY_SCHEMA,
  parseLever: (lever) => {
    const parsed = SUMMARY_SCHEMA(lever);
    return parsed instanceof type.errors ? undefined : parsed;
  },
  responseSchemaHint: () => ({ type: 'object' }),
  contractSchemaHint: () => ({ type: 'object' })
};

const CLASSIFY: LlmCapabilityDescriptor<unknown, HostTraits> = {
  capability: 'classify',
  responseSchema: type({ label: 'string' }),
  parseLever: (lever) => lever,
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
    const descriptorOf: LlmCapabilityDescriptorOf<LlmCapabilityDescriptor<unknown, HostTraits>> = (capability) => [SUMMARIZE, CLASSIFY].find((x) => x.capability === capability);
    const voice: string | undefined = descriptorOf('summarize')?.traits?.voice;

    expect(voice).toBe('narrator');
    expect(descriptorOf('summarize')?.frames?.['brand-voice']).toBe('context');
    expect(descriptorOf('summarize')?.frames?.['disclaimer']).toBe('off');
    expect(descriptorOf('extract')).toBeUndefined();
    expect(SUMMARIZE.parseLever({ summary: 'ok' })).toEqual({ summary: 'ok' });
    expect(SUMMARIZE.parseLever({ summary: 1 })).toBeUndefined();
  });
});

describe('defineLlmCapability()', () => {
  const DESCRIBED_SCHEMA = type({ title: type('string').describe('the product title'), 'tags?': type("'new'|'sale'").describe('a merchandising tag').array() });
  const parseLever = (lever: unknown) => {
    const parsed = DESCRIBED_SCHEMA(lever);
    return parsed instanceof type.errors ? undefined : parsed;
  };

  it('projects a hardened, undescribed responseSchemaHint and a described contractSchemaHint from responseSchema', () => {
    const descriptor = defineLlmCapability({ capability: 'draft-copy', responseSchema: DESCRIBED_SCHEMA, parseLever });
    const response = descriptor.responseSchemaHint() as Record<string, unknown>;
    const contract = descriptor.contractSchemaHint() as Record<string, unknown>;

    expect(response['$schema']).toBeUndefined();
    expect(response['additionalProperties']).toBe(false);
    expect(JSON.stringify(response)).not.toContain('description');
    expect(JSON.stringify(contract)).toContain('the product title');
  });

  it('memoizes each hint', () => {
    const descriptor = defineLlmCapability({ capability: 'draft-copy', responseSchema: DESCRIBED_SCHEMA, parseLever });

    expect(descriptor.responseSchemaHint()).toBe(descriptor.responseSchemaHint());
    expect(descriptor.contractSchemaHint()).toBe(descriptor.contractSchemaHint());
  });

  it('keeps the prose in responseSchemaHint when describeResponseSchemaHint is set', () => {
    const descriptor = defineLlmCapability({ capability: 'draft-copy', responseSchema: DESCRIBED_SCHEMA, parseLever, describeResponseSchemaHint: true });
    expect(descriptor.responseSchemaHint()).toEqual(descriptor.contractSchemaHint());
  });

  describe('hintSchema', () => {
    const base = type({ pass: 'boolean', 'feedback?': 'string' });
    const narrowed = base.narrow((value) => value.pass || value.feedback != null);

    it('defines a narrowed schema without projecting, and projects both hints from hintSchema', () => {
      const descriptor = defineLlmCapability({ capability: 'classify-intent', responseSchema: narrowed, hintSchema: base, parseLever: (lever) => lever });

      expect(descriptor.responseSchemaHint()).toEqual({ type: 'object', properties: { pass: { type: 'boolean' }, feedback: { type: 'string' } }, required: ['pass'], additionalProperties: false });
      expect(descriptor.contractSchemaHint()).toEqual(descriptor.responseSchemaHint());
    });

    it('throws only when a narrowed schema without hintSchema is first projected', () => {
      const descriptor = defineLlmCapability({ capability: 'classify-intent', responseSchema: narrowed, parseLever: (lever) => lever });

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
      traits: { voice: 'narrator' },
      responseSchema: DESCRIBED_SCHEMA,
      parseLever
    });

    expect(descriptor).toMatchObject({ capability: 'summarize', tags: ['writing'], tier: 'strong', replyProtocol: 'json-envelope', mustResolve: true, rawJsonContext: true, frames: { 'brand-voice': 'context' }, traits: { voice: 'narrator' } });
    expect(descriptor.parseLever).toBe(parseLever);
    expect(descriptor.responseSchema).toBe(DESCRIBED_SCHEMA);
    expect('hintSchema' in descriptor).toBe(false);
    expect('describeResponseSchemaHint' in descriptor).toBe(false);

    const routes = compileLlmModelRouting({ routing: { rules: [{ tags: ['writing'], tier: 'fast' }] }, capabilities: [descriptor], tiers: { fast: 'model/fast', strong: 'model/strong' } });
    expect(routes.get('summarize')?.model).toBe('model/fast');
    expect(resolveLlmCapabilityModel({ descriptor, tiers: { fast: 'model/fast', strong: 'model/strong' }, defaultTier: 'fast' }).model).toBe('model/strong');
  });
});
