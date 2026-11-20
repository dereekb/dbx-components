/**
 * The ONE capability-rule compiler: a host's ordered rules (each targeting capability keys and/or tags) compiled into a
 * per-capability map, validated FAIL-LOUD at startup. Model routing (`compileLlmModelRouting`) and the critique policy
 * (`compileLlmCritiquePolicy`) are thin callers of it.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityKey, type LlmCapabilityTag } from './llm.value';

/**
 * The capability view a rule compiler validates and matches against — structural (key + tags), so this leaf module never
 * imports a capability registry.
 */
export interface LlmModelRoutingCapabilityRef {
  /**
   * The capability key.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The capability's declared tags, when any.
   */
  readonly tags?: ReadonlyArray<LlmCapabilityTag>;
}

/**
 * What every capability rule targets: capability keys and/or tags. A capability-key match beats any tag match; within a
 * level the first matching rule (array order) wins.
 */
export interface LlmCapabilityRuleTarget {
  /**
   * The exact capability keys the rule applies to.
   */
  readonly capabilities?: Maybe<ReadonlyArray<LlmCapabilityKey>>;
  /**
   * The capability tags the rule applies to.
   */
  readonly tags?: Maybe<ReadonlyArray<LlmCapabilityTag>>;
}

/**
 * Where a rule sits, for its error messages.
 */
export interface LlmCapabilityRuleContext {
  /**
   * The rule's error prefix: `${label} rule #${index + 1}`.
   */
  readonly label: string;
  /**
   * The rule's index in the array.
   */
  readonly index: number;
}

/**
 * A capability no rule may name, and why.
 */
export interface LlmCapabilityRuleExclusion {
  readonly capability: LlmCapabilityKey;
  /**
   * Thrown as `${ruleLabel}: ${reason}` when a rule names the capability.
   */
  readonly reason: string;
}

/**
 * Config for {@link compileLlmCapabilityRules}.
 */
export interface CompileLlmCapabilityRulesConfig<R extends LlmCapabilityRuleTarget, V> {
  /**
   * The ordered rules. Absent or empty ⇒ an empty map, nothing validated.
   */
  readonly rules: Maybe<ReadonlyArray<R>>;
  /**
   * The known capability refs (key + tags), in the order the map is built.
   */
  readonly capabilities: ReadonlyArray<LlmModelRoutingCapabilityRef>;
  /**
   * The error-message prefix, already defaulted by the caller.
   */
  readonly label: string;
  /**
   * Capabilities no rule may name and no tag rule may match. Their tags still count as known.
   */
  readonly exclude?: Maybe<ReadonlyArray<LlmCapabilityRuleExclusion>>;
  /**
   * A caller's own per-rule check, run right after the no-target check.
   */
  readonly validateRule?: Maybe<(rule: R, context: LlmCapabilityRuleContext) => void>;
  /**
   * The value a rule compiles to. Called eagerly, once per rule, after the rule validated — even when nothing matches it,
   * so a bad rule fails at startup.
   */
  readonly readValue: (rule: R, context: LlmCapabilityRuleContext) => V;
}

/**
 * Compile ordered capability rules into a per-capability map — validated FAIL-LOUD (a target-less rule, an excluded or
 * unknown capability key and a tag no capability carries each throw), with the precedence pre-applied: a rule naming a
 * capability key beats any tag-matching rule; within each level the first matching rule (array order) wins.
 *
 * @param config - The rules, the known capability refs, the label, the exclusions and the per-rule hooks.
 * @returns The capability → value map, in capability order (empty when there are no rules).
 * @throws {Error} When a rule fails validation.
 */
export function compileLlmCapabilityRules<R extends LlmCapabilityRuleTarget, V>(config: CompileLlmCapabilityRulesConfig<R, V>): ReadonlyMap<LlmCapabilityKey, V> {
  const { capabilities, label, validateRule, readValue } = config;
  const rules = config.rules ?? [];
  const compiled = new Map<LlmCapabilityKey, V>();

  if (rules.length > 0) {
    const excluded = new Map((config.exclude ?? []).map((exclusion) => [exclusion.capability, exclusion.reason]));
    const knownCapabilities = new Set(capabilities.map((ref) => ref.capability));
    const knownTags = new Set(capabilities.flatMap((ref) => ref.tags ?? []));

    // Validate and pre-compile every rule once (fail-loud), independent of whether anything matches it.
    const values = rules.map((rule, index): V => {
      const context: LlmCapabilityRuleContext = { label: `${label} rule #${index + 1}`, index };
      const ruleLabel = context.label;

      if ((rule.capabilities == null || rule.capabilities.length === 0) && (rule.tags == null || rule.tags.length === 0)) {
        throw new Error(`${ruleLabel}: declares no target; set 'capabilities' and/or 'tags'.`);
      }

      validateRule?.(rule, context);

      for (const capability of rule.capabilities ?? []) {
        const exclusionReason = excluded.get(capability);

        if (exclusionReason != null) {
          throw new Error(`${ruleLabel}: ${exclusionReason}`);
        }

        if (!knownCapabilities.has(capability)) {
          throw new Error(`${ruleLabel}: unknown capability '${capability}'.`);
        }
      }

      for (const tag of rule.tags ?? []) {
        if (!knownTags.has(tag)) {
          throw new Error(`${ruleLabel}: no capability carries the tag '${tag}' (have: ${Array.from(knownTags).join(', ') || 'none'}).`);
        }
      }

      return readValue(rule, context);
    });

    // Resolve each known capability: the capability-key level first, then the tag level. Excluded refs never match.
    for (const ref of capabilities) {
      if (!excluded.has(ref.capability)) {
        let matchIndex = rules.findIndex((rule) => rule.capabilities?.includes(ref.capability));
        const tags = ref.tags;

        if (matchIndex === -1 && tags != null && tags.length > 0) {
          matchIndex = rules.findIndex((rule) => rule.tags?.some((tag) => tags.includes(tag)));
        }

        if (matchIndex !== -1) {
          compiled.set(ref.capability, values[matchIndex]);
        }
      }
    }
  }

  return compiled;
}
