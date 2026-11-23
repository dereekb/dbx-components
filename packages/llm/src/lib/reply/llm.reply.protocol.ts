/**
 * The reply-protocol vocabulary — how a capability's reply is shaped — and the one precedence every reader of it
 * shares (the prompt assembly, the dispatcher and the critique input). The keys a `json-envelope` reply carries are
 * `LlmReplyEnvelopeKeys` (`llm.reply.envelope.ts`), whose readers read every protocol; only `json-envelope` declines.
 */

import { type Maybe } from '@dereekb/util';

/**
 * Every reply protocol the library reads, in no particular order.
 *
 * - `json` — the reply is the JSON object itself (the value), described by the prompt's output contract.
 * - `json-envelope` — the reply is a JSON envelope whose configured key carries the value (`LlmReplyEnvelopeKeys`),
 *   and which can decline — the only protocol that does.
 * - `line` — the reply is one bare line of prose: no JSON and no output contract; the value is synthesized from it.
 */
export const LLM_REPLY_PROTOCOLS = ['json', 'json-envelope', 'line'] as const;

/**
 * One reply protocol ({@link LLM_REPLY_PROTOCOLS}). Closed: the library reads exactly these.
 */
export type LlmReplyProtocol = (typeof LLM_REPLY_PROTOCOLS)[number];

/**
 * The reply protocol assumed when neither the request, the descriptor nor the host names one.
 */
export const DEFAULT_LLM_REPLY_PROTOCOL: LlmReplyProtocol = 'json';

/**
 * Something that may name a reply protocol — a request or a capability descriptor, read structurally so this module
 * imports neither.
 */
export interface LlmReplyProtocolSource {
  /**
   * The protocol it names, when any.
   */
  readonly replyProtocol?: Maybe<LlmReplyProtocol>;
}

/**
 * Config for {@link resolveLlmReplyProtocol}.
 */
export interface ResolveLlmReplyProtocolConfig {
  /**
   * The request being dispatched — its protocol wins.
   */
  readonly request?: Maybe<LlmReplyProtocolSource>;
  /**
   * The capability's descriptor — its protocol applies when the request names none.
   */
  readonly descriptor?: Maybe<LlmReplyProtocolSource>;
  /**
   * The host's default protocol (e.g. `json-envelope` for a host whose capabilities all answer in an envelope).
   * Unset ⇒ {@link DEFAULT_LLM_REPLY_PROTOCOL}.
   */
  readonly defaultReplyProtocol?: Maybe<LlmReplyProtocol>;
}

/**
 * Resolve the effective reply protocol of one call — the request's, else the descriptor's, else the host default,
 * else {@link DEFAULT_LLM_REPLY_PROTOCOL}.
 *
 * @param config - The request, the descriptor and the host default.
 * @returns The effective protocol.
 *
 * @example
 * ```ts
 * resolveLlmReplyProtocol({ request: { replyProtocol: 'line' }, descriptor: { replyProtocol: 'json' } }); // 'line'
 * resolveLlmReplyProtocol({ defaultReplyProtocol: 'json-envelope' }); // 'json-envelope'
 * ```
 */
export function resolveLlmReplyProtocol(config: ResolveLlmReplyProtocolConfig): LlmReplyProtocol {
  const { request, descriptor, defaultReplyProtocol } = config;
  return request?.replyProtocol ?? descriptor?.replyProtocol ?? defaultReplyProtocol ?? DEFAULT_LLM_REPLY_PROTOCOL;
}
