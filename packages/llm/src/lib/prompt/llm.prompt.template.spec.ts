import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { LLM_PROMPT_LIVE_CONTEXT_MARKER, LLM_PROMPT_TEMPLATE_ROLES, type LlmPromptTemplate, type LlmPromptTemplateResolver, type LlmPromptTemplateTier, type LlmResolvedPromptTemplate, type LlmResolvedPromptTemplates, makeLlmTieredPromptTemplateResolver } from './llm.prompt.template';

function requestFor(capability: string): LlmDispatchRequest {
  return { capability, renderLiveContext: () => [] };
}

const TIERS: ReadonlyArray<LlmPromptTemplateTier> = [
  {
    source: 'defaults',
    templates: [
      { key: 'reply-protocol', role: 'reply-protocol', text: 'Reply with JSON.' },
      { key: 'instructions', role: 'instructions', text: 'Do the task.' },
      { key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize.' },
      { key: 'brand-voice', text: 'Be warm.' }
    ]
  },
  {
    source: 'app',
    templates: [
      { key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize briefly.' },
      { key: 'classify-context', role: 'context', capability: 'classify', text: `Labels: a, b.\n\n${LLM_PROMPT_LIVE_CONTEXT_MARKER}` }
    ]
  },
  {
    source: 'tenant',
    templates: [{ key: 'tenant-classify-context', role: 'context', capability: 'classify', text: 'Tenant labels.' }]
  }
];

/**
 * Resolve synchronously, failing the spec when the resolver returned a promise.
 *
 * @param resolver - The resolver.
 * @param capability - The capability to resolve for.
 * @returns The resolved templates.
 */
function resolveNow(resolver: LlmPromptTemplateResolver, capability: string): LlmResolvedPromptTemplates {
  const result = resolver({ request: requestFor(capability), descriptor: undefined });

  if (result instanceof Promise) {
    throw new TypeError('expected a synchronous result');
  }

  return result;
}

describe('makeLlmTieredPromptTemplateResolver()', () => {
  const resolver = makeLlmTieredPromptTemplateResolver({ tiers: TIERS });

  it('should prefer a capability-scoped template over a shared one', () => {
    expect(resolveNow(resolver, 'summarize').roles.instructions?.key).toBe('summarize-instructions');
    expect(resolveNow(resolver, 'extract').roles.instructions?.key).toBe('instructions');
  });

  it('should replace text and source when a higher tier redefines a key', () => {
    expect(resolveNow(resolver, 'summarize').roles.instructions).toEqual({ key: 'summarize-instructions', text: 'Summarize briefly.', source: 'app' });
  });

  it('should let a higher tier win under a different key', () => {
    expect(resolveNow(resolver, 'classify').roles.context).toEqual({ key: 'tenant-classify-context', text: 'Tenant labels.', source: 'tenant' });
  });

  it('should return any key by byKey, a role-less template included', () => {
    const templates = resolveNow(resolver, 'summarize');
    expect(templates.byKey('brand-voice')).toEqual({ key: 'brand-voice', text: 'Be warm.', source: 'defaults' });
    expect(templates.byKey('classify-context')?.source).toBe('app');
    expect(templates.byKey('nope')).toBeUndefined();
  });

  it('should leave a role absent when no candidate exists', () => {
    expect(resolveNow(resolver, 'summarize').roles.context).toBeUndefined();
  });

  it('should resolve no roles from empty tiers', () => {
    expect(resolveNow(makeLlmTieredPromptTemplateResolver({ tiers: [] }), 'summarize').roles).toEqual({});
  });

  it('should throw when one tier declares a key twice', () => {
    const tiers: ReadonlyArray<LlmPromptTemplateTier> = [
      {
        source: 'app',
        templates: [
          { key: 'k', text: 'one' },
          { key: 'k', text: 'two' }
        ]
      }
    ];
    expect(() => makeLlmTieredPromptTemplateResolver({ tiers })).toThrow("llm prompt templates: tier 'app' declares key 'k' twice.");
  });

  it('should resolve synchronously', () => {
    expect(resolver({ request: requestFor('summarize'), descriptor: undefined })).not.toBeInstanceOf(Promise);
  });
});

describe('LlmPromptTemplateResolver', () => {
  /**
   * A FIRST-BY-LAYER cascade behind the same interface: tiers merged with `Map.set` (an overridden key keeps its FIRST
   * insertion position), then the first candidate in insertion order wins per role, and `source` is the tier of the
   * key's last definition.
   *
   * @param tiers - The tiers, lowest first.
   * @returns The resolver.
   */
  function firstByLayerResolver(tiers: ReadonlyArray<LlmPromptTemplateTier>): LlmPromptTemplateResolver {
    const merged = new Map<string, { readonly template: LlmPromptTemplate; readonly source: string }>();
    tiers.forEach((tier) => tier.templates.forEach((template) => merged.set(template.key, { template, source: tier.source })));
    const resolvedOf = (entry: { readonly template: LlmPromptTemplate; readonly source: string }): LlmResolvedPromptTemplate => ({ key: entry.template.key, text: entry.template.text, source: entry.source });

    return ({ request }) => {
      const entries = Array.from(merged.values());
      const roles: Partial<Record<(typeof LLM_PROMPT_TEMPLATE_ROLES)[number], LlmResolvedPromptTemplate>> = {};

      for (const role of LLM_PROMPT_TEMPLATE_ROLES) {
        const match = entries.find((entry) => entry.template.role === role && entry.template.capability === request.capability) ?? entries.find((entry) => entry.template.role === role && entry.template.capability == null);

        if (match != null) {
          roles[role] = resolvedOf(match);
        }
      }

      return Promise.resolve({
        roles,
        byKey: (key) => {
          const entry = merged.get(key);
          return entry == null ? undefined : resolvedOf(entry);
        }
      });
    };
  }

  it('should carry a first-by-layer cascade through the same interface', async () => {
    const resolver = firstByLayerResolver(TIERS);
    const classify = await resolver({ request: requestFor('classify'), descriptor: undefined });
    const summarize = await resolver({ request: requestFor('summarize'), descriptor: undefined });

    // A later tier's different key for the same capability loses to the earlier-inserted one.
    expect(classify.roles.context?.key).toBe('classify-context');
    // An overridden key keeps its first position, with the text and source of its last definition.
    expect(summarize.roles.instructions).toEqual({ key: 'summarize-instructions', text: 'Summarize briefly.', source: 'app' });
  });
});

describe('LLM_PROMPT_LIVE_CONTEXT_MARKER', () => {
  it('should be the liveContext placeholder', () => {
    expect(LLM_PROMPT_LIVE_CONTEXT_MARKER).toBe('{{liveContext}}');
  });
});
