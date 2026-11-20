/**
 * **Chat-client fake** — a network-free stand-in for the OpenAI-compatible chat client (`LlmOpenAiChatClient` from
 * `@dereekb/llm/openai`) the chat strategies call. It records each request body and its per-request options and answers
 * with a canned completion.
 *
 * `@dereekb/llm/test` may not import a provider entry, so the client surface here is a STRUCTURAL MIRROR built from root
 * types (`RawLlmUsage`, `LlmGenerationId`). Every spec that passes the fake where an `LlmOpenAiChatClient` is expected is
 * the compile-time check that the two still agree.
 */

import { type Maybe, type Milliseconds, filterMaybeValues } from '@dereekb/util';
import { type LlmGenerationId, type RawLlmUsage } from '@dereekb/llm';

/**
 * The reply text a fake completion carries when none is configured.
 */
export const DEFAULT_LLM_OPENAI_CHAT_CLIENT_FAKE_REPLY = 'fake-reply';

/**
 * The completion a fake answers with — mirrors `LlmOpenAiChatCompletion`.
 */
export interface LlmOpenAiChatClientFakeCompletion {
  readonly id?: LlmGenerationId;
  readonly choices: ReadonlyArray<{ readonly message?: { readonly content?: Maybe<string> }; readonly finish_reason?: Maybe<string>; readonly native_finish_reason?: Maybe<string> }>;
  readonly model?: string;
  readonly provider?: Maybe<string>;
  readonly usage?: Maybe<RawLlmUsage>;
}

/**
 * The per-request options a fake records — mirrors `LlmOpenAiRequestOptions`.
 */
export interface LlmOpenAiChatClientFakeRequestOptions {
  readonly signal?: AbortSignal;
  readonly timeout?: Milliseconds;
}

/**
 * The client surface a fake exposes — mirrors `LlmOpenAiChatClient` (`chat.completions.create`).
 */
export interface LlmOpenAiChatClientFakeClient {
  readonly chat: {
    readonly completions: {
      create(body: unknown, options?: LlmOpenAiChatClientFakeRequestOptions): Promise<LlmOpenAiChatClientFakeCompletion>;
    };
  };
}

/**
 * The recorded body subset the assertions read: the union of what the openai and openrouter strategy specs check. A
 * spec may narrow it with the fake's type parameter.
 */
export interface LlmOpenAiChatClientFakeBody {
  readonly model: string;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly content: unknown }>;
  readonly response_format?: unknown;
  readonly max_tokens?: number;
  readonly max_completion_tokens?: number;
  readonly reasoning_effort?: unknown;
  readonly reasoning?: unknown;
  readonly usage?: unknown;
}

/**
 * Configures the canned completion a fake answers with.
 */
export interface LlmOpenAiChatClientFakeConfig {
  /**
   * The first choice's message text. Defaults to {@link DEFAULT_LLM_OPENAI_CHAT_CLIENT_FAKE_REPLY}.
   */
  readonly reply?: Maybe<string>;
  /**
   * The served model the completion echoes.
   */
  readonly model?: Maybe<string>;
  /**
   * The upstream provider the completion echoes (OpenRouter's routing echo).
   */
  readonly provider?: Maybe<string>;
  /**
   * The provider-shaped usage block the completion carries.
   */
  readonly usage?: Maybe<RawLlmUsage>;
  /**
   * Set `false` to omit `model` from the completion, to exercise the omission path. Defaults to `true`.
   */
  readonly includeModel?: Maybe<boolean>;
  /**
   * Set `false` to omit `usage` from the completion, to exercise the omission path. Defaults to `true`.
   */
  readonly includeUsage?: Maybe<boolean>;
  /**
   * The generation id the completion carries.
   */
  readonly id?: Maybe<LlmGenerationId>;
  /**
   * The first choice's `finish_reason`.
   */
  readonly finishReason?: Maybe<string>;
  /**
   * The first choice's `native_finish_reason` (OpenRouter's).
   */
  readonly nativeFinishReason?: Maybe<string>;
  /**
   * A whole completion to answer with verbatim. When set, every other field is ignored.
   */
  readonly completion?: Maybe<LlmOpenAiChatClientFakeCompletion>;
}

/**
 * A fake: its client plus what it received.
 */
export interface LlmOpenAiChatClientFake<B = LlmOpenAiChatClientFakeBody> {
  readonly client: LlmOpenAiChatClientFakeClient;
  /**
   * Every request body received, in order.
   */
  readonly bodies: B[];
  /**
   * The per-request options of every call, in order (`{}` when a call passed none).
   */
  readonly options: LlmOpenAiChatClientFakeRequestOptions[];
}

/**
 * Builds the completion a fake answers with.
 *
 * @param config - The fake's config.
 * @returns The completion.
 */
function makeLlmOpenAiChatClientFakeCompletion(config: LlmOpenAiChatClientFakeConfig): LlmOpenAiChatClientFakeCompletion {
  const choice = filterMaybeValues({
    message: { content: config.reply ?? DEFAULT_LLM_OPENAI_CHAT_CLIENT_FAKE_REPLY },
    finish_reason: config.finishReason,
    native_finish_reason: config.nativeFinishReason
  });

  return filterMaybeValues({
    choices: [choice],
    id: config.id,
    model: config.includeModel === false ? undefined : config.model,
    provider: config.provider,
    usage: config.includeUsage === false ? undefined : config.usage
  });
}

/**
 * **Build a chat-client fake.** It records each request body and its options, then answers with the configured
 * completion: `config.completion` verbatim when given, otherwise one choice carrying `reply` (default `'fake-reply'`)
 * plus whichever of `id`, `model`, `provider`, `usage` and the finish reasons are set.
 *
 * @param config - The canned completion.
 * @returns The fake client and its recordings.
 *
 * @example
 * ```ts
 * const fake = makeLlmOpenAiChatClientFake({ reply: '{"ok":true}', model: 'gpt-4o-mini' });
 * const strategy = makeLlmOpenAiStrategy({ client: fake.client, defaultModel: 'gpt-4o-mini' });
 * await strategy.complete({ prompt: 'hi' });
 * fake.bodies[0]?.model; // 'gpt-4o-mini'
 * ```
 */
export function makeLlmOpenAiChatClientFake<B = LlmOpenAiChatClientFakeBody>(config: LlmOpenAiChatClientFakeConfig = {}): LlmOpenAiChatClientFake<B> {
  const completion = config.completion ?? makeLlmOpenAiChatClientFakeCompletion(config);
  const bodies: B[] = [];
  const options: LlmOpenAiChatClientFakeRequestOptions[] = [];
  const client: LlmOpenAiChatClientFakeClient = {
    chat: {
      completions: {
        create: async (body, requestOptions) => {
          bodies.push(body as B);
          options.push(requestOptions ?? {});
          return completion;
        }
      }
    }
  };

  return { client, bodies, options };
}
