/**
 * A scripted completion {@link LlmStrategy} — answers every call from a script, makes no network call and bills nothing.
 *
 * One strategy covers the three shapes a spec usually needs: an ordered list of replies, replies per capability, and a
 * respond function for anything conditional. An `Error` reply is THROWN, which is how a spec drives a transport failure
 * (and a dispatcher's retry ladder) without a transport.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityKey, type LlmCompletion, type LlmRequest, type LlmStrategy, type LlmStrategyId } from '@dereekb/llm';

/**
 * The default instance id AND the kind of every {@link makeLlmScriptedStrategy} strategy.
 */
export const LLM_SCRIPTED_STRATEGY_ID: LlmStrategyId = 'scripted';

/**
 * A full reply: `text` plus any completion field to set. Its fields override the defaults the strategy fills in.
 */
export type LlmScriptedCompletion = Partial<LlmCompletion> & { readonly text: string };

/**
 * One scripted reply: a text, a completion spec, or an `Error` the call THROWS (a transport failure).
 */
export type LlmScriptedReply = string | LlmScriptedCompletion | Error;

/**
 * An ordered list of scripted replies. The LAST entry repeats once the list is spent; an empty list is "no reply".
 */
export type LlmScriptedReplies = ReadonlyArray<LlmScriptedReply>;

/**
 * Answers one call. Returning `undefined` falls through to `byCapability`, then `replies`.
 *
 * @param request - The request being answered.
 * @param call - The 0-based index of this call over EVERY call the strategy received.
 * @returns The reply, or `undefined` to fall through.
 */
export type LlmScriptedRespondFunction = (request: LlmRequest, call: number) => Maybe<LlmScriptedReply>;

/**
 * Config for {@link makeLlmScriptedStrategy}. Per call, the first source that answers wins:
 *
 * 1. {@link respond} — `respond(request, call)`; `undefined` falls through.
 * 2. {@link byCapability} — the entry for `request.capability`: one reply, or a list indexed by THAT capability's own
 *    call count (its last entry repeats).
 * 3. {@link replies} — indexed by the number of calls that fell through to it (its last entry repeats).
 * 4. Nothing answered ⇒ the call throws `scripted strategy '<id>' has no reply for capability '<capability>' (call <n>)`.
 */
export interface LlmScriptedStrategyConfig {
  /**
   * The instance id; defaults to {@link LLM_SCRIPTED_STRATEGY_ID}.
   */
  readonly id?: Maybe<LlmStrategyId>;
  /**
   * Answers a call first; `undefined` falls through.
   */
  readonly respond?: Maybe<LlmScriptedRespondFunction>;
  /**
   * Replies per capability. A list keeps its own counter and never consumes {@link replies}.
   */
  readonly byCapability?: Maybe<Readonly<Record<LlmCapabilityKey, LlmScriptedReply | LlmScriptedReplies>>>;
  /**
   * Replies answered in order to every call nothing else answered; the LAST repeats once spent.
   */
  readonly replies?: Maybe<LlmScriptedReplies>;
  /**
   * A sink: every request is pushed here BEFORE it is answered (an `Error` reply still records its request).
   */
  readonly requests?: Maybe<LlmRequest[]>;
  /**
   * The strategy's description; defaults to a line saying it bills nothing.
   */
  readonly describe?: Maybe<string>;
}

/**
 * Pick the reply at `index` from a list whose last entry repeats.
 *
 * @param replies - The list.
 * @param index - The 0-based position.
 * @returns The reply, or `undefined` for an empty list.
 */
function scriptedReplyAt(replies: LlmScriptedReplies, index: number): Maybe<LlmScriptedReply> {
  return replies.length === 0 ? undefined : replies[Math.min(index, replies.length - 1)];
}

/**
 * Build a scripted completion strategy — see {@link LlmScriptedStrategyConfig} for the answer order.
 *
 * The completion is `{ strategyId, strategyKind: 'scripted', capability, model?, meta?, text }` with the request's
 * `model` and `meta` echoed, overridden by any field a {@link LlmScriptedCompletion} sets. No default `usage`: a spec
 * adds it per reply.
 *
 * @param config - The script.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const requests: LlmRequest[] = [];
 * const strategy = makeLlmScriptedStrategy({ byCapability: { classify: ['{"label":"a"}', new Error('503')] }, replies: ['fallback'], requests });
 * ```
 */
export function makeLlmScriptedStrategy(config: LlmScriptedStrategyConfig): LlmStrategy {
  const id = config.id ?? LLM_SCRIPTED_STRATEGY_ID;
  const replies = config.replies ?? [];
  const capabilityCalls = new Map<LlmCapabilityKey, number>();
  let calls = 0;
  let fallthroughCalls = 0;

  const replyOf = (request: LlmRequest, call: number): Maybe<LlmScriptedReply> => {
    let reply = config.respond?.(request, call);

    if (reply == null) {
      const entry = config.byCapability?.[request.capability];

      if (entry != null) {
        if (Array.isArray(entry)) {
          const index = capabilityCalls.get(request.capability) ?? 0;
          capabilityCalls.set(request.capability, index + 1);
          reply = scriptedReplyAt(entry as LlmScriptedReplies, index);
        } else {
          reply = entry as LlmScriptedReply;
        }
      }
    }

    if (reply == null) {
      reply = scriptedReplyAt(replies, fallthroughCalls);
      fallthroughCalls += 1;
    }

    return reply;
  };

  return {
    id,
    kind: LLM_SCRIPTED_STRATEGY_ID,
    describe: config.describe ?? 'scripted: answers from its script; makes no network call and bills nothing',
    caching: 'none',
    async complete(request: LlmRequest): Promise<LlmCompletion> {
      const call = calls;
      calls += 1;
      config.requests?.push(request);
      const reply = replyOf(request, call);

      if (reply == null) {
        throw new Error(`scripted strategy '${id}' has no reply for capability '${request.capability}' (call ${call})`);
      }

      if (reply instanceof Error) {
        throw reply;
      }

      const spec: LlmScriptedCompletion = typeof reply === 'string' ? { text: reply } : reply;
      return {
        strategyId: id,
        strategyKind: LLM_SCRIPTED_STRATEGY_ID,
        capability: request.capability,
        ...(request.model == null ? {} : { model: request.model }),
        ...(request.meta == null ? {} : { meta: request.meta }),
        ...spec
      };
    }
  };
}
