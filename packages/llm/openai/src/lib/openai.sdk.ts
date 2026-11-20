/**
 * The single boundary between the `@dereekb/llm` family and the `openai` SDK — `/openrouter` reaches it only through
 * `@dereekb/llm/openai`'s chat base. It is reached only through `import type` and `import()`, so importing the entry
 * never evaluates the SDK, and every export here is typed with local structural types, so no emitted declaration names
 * the SDK.
 */
import { type Maybe, type Milliseconds, type WebsiteUrl } from '@dereekb/util';
import { type LlmOpenAiChatClient } from './openai.chat';

/**
 * What {@link loadLlmOpenAiChatClient} builds the real client from.
 */
export interface LlmOpenAiChatClientConfig {
  /**
   * The OpenAI-compatible API key.
   */
  readonly apiKey: string;
  /**
   * The OpenAI-compatible base URL the client is pointed at.
   */
  readonly baseUrl: WebsiteUrl;
  /**
   * The client-level request timeout.
   */
  readonly timeoutMs: Milliseconds;
  /**
   * Passed through to the SDK, which refuses to run in a browser without it. Only set it for a browser app that
   * holds the user's OWN key — never a shared secret.
   */
  readonly dangerouslyAllowBrowser?: Maybe<boolean>;
}

/**
 * Lazily construct the real `openai` SDK client — a dynamic `import('openai')`, so the SDK is never loaded on the
 * network-free (injected-seam) paths.
 *
 * - `maxRetries: 0` — the DISPATCHER owns retries; the SDK's default of 2 silent retries would triple the worst-case
 *   wall time of a hung call before the dispatcher ever saw it. The per-request abort signal is the hard wall.
 * - `apiKey` and `baseURL` are always passed and `organization` / `project` are `null`, so the SDK never fills them from
 *   `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID` or `OPENAI_PROJECT_ID`: the key and endpoint are the host's, and
 *   those ids must not reach a third-party gateway.
 * - The SDK still reads two variables on Node. `OPENAI_CUSTOM_HEADERS` becomes default headers on every request this
 *   client sends, to whatever gateway `baseUrl` names; no option of a key + base-URL client turns that read off.
 *   `OPENAI_LOG` sets the SDK's log level (this client passes no `logLevel`). A host that needs org / project ids or
 *   controlled headers injects its own client, built with `maxRetries: 0`.
 * - `dangerouslyAllowBrowser` is `true` only when set `true` (the browser rule: user-held keys only); the SDK reads
 *   it with `!`, so `false` is the same as absent.
 *
 * @param config - The key, base URL, timeout and browser flag.
 * @returns The client, cast onto the structural surface the strategy uses.
 */
export async function loadLlmOpenAiChatClient(config: LlmOpenAiChatClientConfig): Promise<LlmOpenAiChatClient> {
  const { apiKey, baseUrl, timeoutMs, dangerouslyAllowBrowser } = config;
  const { default: OpenAI } = await import('openai');
  return new OpenAI({ apiKey, baseURL: baseUrl, timeout: timeoutMs, maxRetries: 0, organization: null, project: null, dangerouslyAllowBrowser: dangerouslyAllowBrowser === true }) as unknown as LlmOpenAiChatClient;
}
