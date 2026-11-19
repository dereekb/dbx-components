import { type LlmReasoningConfig } from '@dereekb/llm';
import { type LlmOpenAiNestedReasoning } from '@dereekb/llm/openai';

/**
 * The OpenRouter `reasoning` mapper. Every other wire type (messages, content parts, the body, the completion, the
 * client) is `@dereekb/llm/openai`'s: OpenRouter speaks the OpenAI-compatible chat wire.
 */

// MARK: Reasoning
/**
 * Map a transport-agnostic {@link LlmReasoningConfig} onto the OpenRouter `reasoning` wire param — each field
 * conditionally spread so an unset knob never lands on the wire. The only rename is `maxTokens` → `max_tokens`.
 *
 * The OpenAI-compatible chat base hands it an already-normalized config (`normalizeLlmReasoningConfig`), so an OFF
 * config arrives as `{ enabled: false }` alone.
 *
 * @param reasoning - The resolved reasoning config.
 * @returns The OpenRouter `reasoning` param.
 *
 * @example
 * ```ts
 * llmOpenRouterReasoningOf({ effort: 'low', maxTokens: 512 }); // { effort: 'low', max_tokens: 512 }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenRouterReasoningOf(reasoning: LlmReasoningConfig): LlmOpenAiNestedReasoning {
  return {
    ...(reasoning.effort == null ? {} : { effort: reasoning.effort }),
    ...(reasoning.maxTokens == null ? {} : { max_tokens: reasoning.maxTokens }),
    ...(reasoning.exclude == null ? {} : { exclude: reasoning.exclude }),
    ...(reasoning.enabled == null ? {} : { enabled: reasoning.enabled })
  };
}
