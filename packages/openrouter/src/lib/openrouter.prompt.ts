import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfig } from './openrouter.config';
import { type OpenRouterInputRole } from './openrouter.input';
import { type OpenRouterPromptKey, type OpenRouterPromptVersionNumber } from './openrouter.type';

/**
 * A seed message stored on a prompt version.
 *
 * These are the STATIC half of a prompt — the part that is identical on every call. They are emitted
 * before the caller's dynamic input so a prompt-cache prefix hit stays possible.
 */
export interface OpenRouterPromptSeedMessage {
  readonly role: OpenRouterInputRole;
  readonly content: string;
}

/**
 * A prompt version resolved to everything needed to build a request.
 *
 * This is the replacement for an OpenAI `pmpt_…` id: instead of a dashboard-hosted object referenced
 * by an opaque id, the content, the model, and the output format are values we hold.
 *
 * There is deliberately NO variables model. Dynamic content is passed as `input` from typed
 * TypeScript — which is what OpenRouter requires (no server-side substitution) and what OpenAI's own
 * migration guide prescribes: "Replace prompt variables with function arguments."
 */
export interface OpenRouterResolvedPrompt {
  /**
   * The prompt this was resolved from.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * The version that was resolved — either the caller's pin, or the prompt's active version.
   *
   * Recorded on every run so a result can always be traced back to the exact prompt text that
   * produced it, and so a historical run can be replayed against it.
   */
  readonly version: OpenRouterPromptVersionNumber;
  /**
   * System prompt.
   */
  readonly instructions?: Maybe<string>;
  /**
   * Static seed messages.
   */
  readonly messages?: Maybe<OpenRouterPromptSeedMessage[]>;
  /**
   * The version's model config.
   */
  readonly config: OpenRouterModelConfig;
}
