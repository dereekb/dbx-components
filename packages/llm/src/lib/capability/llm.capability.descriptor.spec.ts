import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { resolveLlmCapabilityModel } from '../model/llm.model.precedence';
import { compileLlmModelRouting } from '../model/llm.model.routing';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorOf } from './llm.capability.descriptor';

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
