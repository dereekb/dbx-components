/**
 * Prompt TEMPLATES — the authored text a prompt is assembled around — and the resolver interface that supplies them.
 *
 * An {@link LlmPromptTemplateResolver} runs ONCE per dispatch, before any contributor, and returns the dispatch's
 * templates per role ({@link LLM_PROMPT_TEMPLATE_ROLES}) plus a by-key lookup for contributors (a frame contributor
 * reads its frame text by key). It may be async; the assembly awaits it once and then works on the resolved set.
 *
 * It is an interface because cascades differ: {@link tieredLlmPromptTemplateResolver} is the library's (last
 * definition of a key wins, a capability-scoped template beats a shared one); a host whose cascade differs
 * (first-by-layer, per-user tiers, a role keyed by a host trait) supplies its own.
 */

import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmCapabilityKey } from '../model/llm.value';

/**
 * The live-context marker a `context` template splits at — the assembly places the body before the FIRST marker in
 * the `context-pre` slot and the rest in the `context-post` slot. Later markers stay literal.
 */
export const LLM_PROMPT_LIVE_CONTEXT_MARKER = '{{liveContext}}';

/**
 * The template roles the assembly places.
 *
 * - `reply-protocol` — the reply-protocol text (placed in the `reply-protocol` slot).
 * - `instructions` — the capability's instructions (placed in the `instructions` slot).
 * - `context` — ONE body the assembly splits at the first {@link LLM_PROMPT_LIVE_CONTEXT_MARKER} into the
 *   `context-pre` / `context-post` slots.
 */
export const LLM_PROMPT_TEMPLATE_ROLES = ['reply-protocol', 'instructions', 'context'] as const;

/**
 * One template role ({@link LLM_PROMPT_TEMPLATE_ROLES}).
 */
export type LlmPromptTemplateRole = (typeof LLM_PROMPT_TEMPLATE_ROLES)[number];

/**
 * One resolved template.
 */
export interface LlmResolvedPromptTemplate {
  /**
   * The template's editable identity — the placed segment's `key`.
   */
  readonly key: string;
  /**
   * The template's text.
   */
  readonly text: string;
  /**
   * The provenance — which tier / layer supplied the text. Absent when unattributed.
   */
  readonly source?: string;
}

/**
 * A dispatch's resolved templates, per role. A role with no template is absent.
 */
export type LlmResolvedPromptTemplatesByRole = Readonly<Partial<Record<LlmPromptTemplateRole, LlmResolvedPromptTemplate>>>;

/**
 * What an {@link LlmPromptTemplateResolver} returns for one dispatch.
 */
export interface LlmResolvedPromptTemplates {
  /**
   * What the assembly places, per role.
   */
  readonly roles: LlmResolvedPromptTemplatesByRole;
  /**
   * Any template by key — what a contributor reads (a frame's text).
   *
   * @param key - The template key.
   * @returns The template, or `undefined`.
   */
  readonly byKey: (key: string) => Maybe<LlmResolvedPromptTemplate>;
}

/**
 * The input of one {@link LlmPromptTemplateResolver} call.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 */
export interface LlmPromptTemplateResolverInput<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The request being dispatched.
   */
  readonly request: R;
  /**
   * The capability's descriptor, when it has one.
   */
  readonly descriptor: Maybe<D>;
}

/**
 * Resolve a dispatch's templates — once per dispatch, before any contributor runs. May be async.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 */
export type LlmPromptTemplateResolver<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> = (input: LlmPromptTemplateResolverInput<R, D>) => PromiseOrValue<LlmResolvedPromptTemplates>;

/**
 * One authored template.
 */
export interface LlmPromptTemplate {
  /**
   * The template's key — unique within one tier.
   */
  readonly key: string;
  /**
   * The role it fills; absent ⇒ reachable only by key (a frame text a contributor reads).
   */
  readonly role?: LlmPromptTemplateRole;
  /**
   * The capability it is scoped to; absent ⇒ shared by every capability.
   */
  readonly capability?: LlmCapabilityKey;
  /**
   * The template's text.
   */
  readonly text: string;
}

/**
 * One tier of templates — a named source.
 */
export interface LlmPromptTemplateTier {
  /**
   * The tier's name — recorded as each of its templates' `source`.
   */
  readonly source: string;
  /**
   * The tier's templates.
   */
  readonly templates: ReadonlyArray<LlmPromptTemplate>;
}

/**
 * Config for {@link tieredLlmPromptTemplateResolver}.
 */
export interface TieredLlmPromptTemplateResolverConfig {
  /**
   * The tiers, LOWEST precedence first.
   */
  readonly tiers: ReadonlyArray<LlmPromptTemplateTier>;
}

/**
 * One merged template plus where it came from and its rank.
 */
interface LlmMergedPromptTemplate {
  readonly template: LlmPromptTemplate;
  readonly source: string;
  readonly tierIndex: number;
  readonly position: number;
}

/**
 * Whether merged template `a` outranks `b` — the higher tier, then the later position in its tier.
 *
 * @param a - One merged template.
 * @param b - The other.
 * @returns Whether `a` outranks `b`.
 */
function outranks(a: LlmMergedPromptTemplate, b: LlmMergedPromptTemplate): boolean {
  return a.tierIndex === b.tierIndex ? a.position > b.position : a.tierIndex > b.tierIndex;
}

/**
 * The library's template resolver — tiers merged by key, LAST definition wins.
 *
 * 1. Each key keeps the template and `source` of its LAST definition (the highest tier defining it).
 * 2. Per role, the candidates are the merged templates with that `role` and either the request's capability or no
 *    capability. A capability-scoped template beats a shared one; among equally specific candidates the highest rank
 *    (tier, then position) wins — so a higher tier wins even under a different key.
 * 3. `byKey` returns any merged template (role or not).
 *
 * Built once at construction; resolution is synchronous. The descriptor is ignored — a host that keys a role by a
 * descriptor trait writes its own resolver.
 *
 * @param config - The tiers, lowest precedence first.
 * @returns The resolver.
 * @throws {Error} When one tier declares the same key twice.
 *
 * @example
 * ```ts
 * const resolver = tieredLlmPromptTemplateResolver({
 *   tiers: [
 *     { source: 'defaults', templates: [{ key: 'instructions', role: 'instructions', text: 'Summarize the input.' }] },
 *     { source: 'app', templates: [{ key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize in two sentences.' }] }
 *   ]
 * });
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function tieredLlmPromptTemplateResolver(config: TieredLlmPromptTemplateResolverConfig): LlmPromptTemplateResolver {
  const merged = new Map<string, LlmMergedPromptTemplate>();

  config.tiers.forEach((tier, tierIndex) => {
    const seen = new Set<string>();

    tier.templates.forEach((template, position) => {
      if (seen.has(template.key)) {
        throw new Error(`llm prompt templates: tier '${tier.source}' declares key '${template.key}' twice.`);
      }

      seen.add(template.key);
      merged.delete(template.key);
      merged.set(template.key, { template, source: tier.source, tierIndex, position });
    });
  });

  const all = Array.from(merged.values());
  const resolvedOf = (entry: LlmMergedPromptTemplate): LlmResolvedPromptTemplate => ({ key: entry.template.key, text: entry.template.text, source: entry.source });
  const byKey = (key: string): Maybe<LlmResolvedPromptTemplate> => {
    const entry = merged.get(key);
    return entry == null ? undefined : resolvedOf(entry);
  };

  return ({ request }) => {
    const roles: Partial<Record<LlmPromptTemplateRole, LlmResolvedPromptTemplate>> = {};

    for (const role of LLM_PROMPT_TEMPLATE_ROLES) {
      let best: Maybe<LlmMergedPromptTemplate>;
      let bestScoped = false;

      for (const entry of all) {
        const { template } = entry;

        if (template.role === role && (template.capability == null || template.capability === request.capability)) {
          const scoped = template.capability != null;

          if (best == null || (scoped && !bestScoped) || (scoped === bestScoped && outranks(entry, best))) {
            best = entry;
            bestScoped = scoped;
          }
        }
      }

      if (best != null) {
        roles[role] = resolvedOf(best);
      }
    }

    return { roles, byKey };
  };
}
