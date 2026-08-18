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

/**
 * A prompt defined in CODE rather than published to Firestore.
 *
 * This is the backup half of prompt resolution: an app ships its prompts as definitions, so a fresh
 * environment — a new emulator, a test, a project that has never been seeded — can serve them without a
 * manual seeding step first. Once the same prompt is published to Firestore the stored version takes
 * over, which is what keeps prompt authoring a runtime concern rather than a deploy-shaped one.
 *
 * A definition IS an {@link OpenRouterResolvedPrompt}, so serving one needs no conversion. The extra
 * fields are the authoring metadata a seeder needs to create the stored prompt from this same value,
 * rather than restating the name and description alongside it.
 */
export interface OpenRouterPromptDefinition extends OpenRouterResolvedPrompt {
  /**
   * The version this code ships.
   *
   * Compared against the stored prompt's active version to decide which one wins, so this is the one
   * knob that controls drift: bump it when the definition's text or config changes and the definition
   * takes over again, even from an environment that was already seeded at a lower version.
   */
  readonly version: OpenRouterPromptVersionNumber;
  /**
   * Human-readable name, used when this definition is published to Firestore.
   */
  readonly name: string;
  /**
   * What this prompt is for, used when this definition is published to Firestore.
   */
  readonly description?: Maybe<string>;
}
