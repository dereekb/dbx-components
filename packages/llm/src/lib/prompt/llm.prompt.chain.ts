/**
 * The prompt CHAIN — the chained follow-up delta as ONE instance. {@link makeLlmPromptChain} returns an instance that
 * fires a fresh root, or chains a follow-up onto an executed handle whose message is the instance's continuation lead
 * plus only the live blocks that CHANGED since the thread last saw them ({@link llmChainedFollowUpBody}).
 *
 * The delta base is what each handle SENT, held by the instance in a private `WeakMap` keyed by the executed handle —
 * weak, so a dropped chain frees its blocks. The base is the capability's OWN render, caught from the root's
 * `renderLiveContext` as the dispatcher renders it (never a second render); contributed live blocks are merged later by
 * the assembly and are never part of it, so they are never re-sent on a follow-up.
 *
 * ONE instance per host: a handle chained through a different instance has no base there and sends its whole live
 * context. The dispatcher is passed per call, so one instance spans differently scoped dispatchers
 * (`withLlmPromptSite`).
 */

import { type Maybe } from '@dereekb/util';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { droppedLlmLiveContextBlockKeys, llmChainedFollowUpBody, mergeLlmChainedFollowUpBase, type LlmLiveContextBlock } from './llm.prompt.live.context';
import { type ExecutedLlmPrompt } from './llm.prompt.thread';

/**
 * The default continuation lead prepended to a chained follow-up's live-context delta. It invites cross-item coherence
 * WITHOUT licensing duplication: the follow-up rides the same exchanged thread, so the model already sees its prior
 * answers; this sentence tells it to build on them and resolve only the next item. A host passes its own wording as
 * {@link LlmPromptChainConfig.lead} (or per call).
 */
export const DEFAULT_LLM_PROMPT_CHAIN_LEAD = 'Next item: build on what you resolved above and keep continuity; do not repeat or restate an earlier item. Resolve only this next item:';

/**
 * Config for {@link makeLlmPromptChain}.
 */
export interface LlmPromptChainConfig {
  /**
   * The instance's continuation lead; nullish ⇒ {@link DEFAULT_LLM_PROMPT_CHAIN_LEAD}. An empty lead sends the delta
   * body alone.
   */
  readonly lead?: Maybe<string>;
}

/**
 * Params for {@link LlmPromptChain.dispatch}.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 */
export interface LlmPromptChainDispatchParams<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The dispatcher that prepares a ROOT; unused for a follow-up (it rides {@link previous}'s chain).
   */
  readonly dispatcher: Pick<LlmDispatcher<R, X>, 'preparePrompt'>;
  /**
   * The capability request — the root assembles from it; a follow-up renders its live context and inherits its
   * `validate`, `maxAttempts` and `responseSchemaHint` (nothing else).
   */
  readonly request: R;
  /**
   * The executed parent to chain onto; absent ⇒ a fresh root.
   */
  readonly previous?: Maybe<ExecutedLlmPrompt<R, X>>;
  /**
   * A per-call override of the instance's lead (a turn that is not "the next item" words its own).
   */
  readonly lead?: Maybe<string>;
}

/**
 * One chained-follow-up instance.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 */
export interface LlmPromptChain<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * Dispatch a request as a fresh ROOT (no `previous`) or as a chained FOLLOW-UP onto `previous`, and remember what the
   * executed handle sent so the next follow-up re-sends only what changed. A rejected execution records nothing.
   *
   * @param params - The dispatcher, the request, the parent handle and the per-call lead.
   * @returns The executed handle — the chain cursor the next item advances from.
   */
  dispatch(params: LlmPromptChainDispatchParams<R, X>): Promise<ExecutedLlmPrompt<R, X>>;
}

/**
 * What one executed handle's thread holds, for the next follow-up's delta.
 */
interface LlmPromptChainSentBlocks {
  /**
   * CUMULATIVE along the chain — every block any item sent, latest bytes by key.
   */
  readonly held: ReadonlyArray<LlmLiveContextBlock>;
  /**
   * This handle's own render — what the dropped-block line compares against.
   */
  readonly own: ReadonlyArray<LlmLiveContextBlock>;
}

/**
 * Mint one chained-follow-up instance. It owns its sent-blocks map and its default lead, so two instances never share
 * state.
 *
 * With no `previous`, `dispatch` is `dispatcher.preparePrompt(request).execute()` — byte-identical to
 * `dispatcher.dispatch(request)` — and catches the root's live-context render as the base. With a `previous`, the
 * follow-up message is `${lead}\n\n${delta}` (the body alone when the lead is empty), replayed after the parent's
 * thread so the provider serves the shared prefix warm. The chain's framing rides the replayed thread, so a follow-up
 * is only sound when it shares the root's framing (same capability, same templates) — the caller's adjacency policy
 * enforces that. A host stamps anything else (a parent call context) on the request before calling.
 *
 * @param config - The instance's default lead.
 * @returns The instance.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 *
 * @example
 * ```ts
 * const chain = makeLlmPromptChain();
 * const first = await chain.dispatch({ dispatcher, request: itemRequest(items[0]) });
 * // `second` replays `first`'s thread and sends the lead plus only the live blocks that changed.
 * const second = await chain.dispatch({ dispatcher, request: itemRequest(items[1]), previous: first });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmPromptChain<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult>(config?: Maybe<LlmPromptChainConfig>): LlmPromptChain<R, X> {
  const defaultLead = config?.lead ?? DEFAULT_LLM_PROMPT_CHAIN_LEAD;
  const sentBlocks = new WeakMap<ExecutedLlmPrompt<R, X>, LlmPromptChainSentBlocks>();

  return {
    async dispatch(params: LlmPromptChainDispatchParams<R, X>): Promise<ExecutedLlmPrompt<R, X>> {
      const { dispatcher, request, previous } = params;
      const lead = params.lead ?? defaultLead;
      let sent: Maybe<LlmPromptChainSentBlocks>;
      let executed: ExecutedLlmPrompt<R, X>;

      if (previous == null) {
        const recording: R = {
          ...request,
          renderLiveContext: () => {
            const blocks = request.renderLiveContext();
            sent = { held: blocks, own: blocks };
            return blocks;
          }
        };
        executed = await dispatcher.preparePrompt(recording).execute();
      } else {
        const blocks = request.renderLiveContext();
        const parent = sentBlocks.get(previous);
        // CUMULATIVE base: the thread still holds every block an earlier item sent, so a disjoint block set must not
        // wipe the earlier blocks from the base the next item diffs against.
        sent = { held: mergeLlmChainedFollowUpBase(parent?.held, blocks, droppedLlmLiveContextBlockKeys(blocks, parent?.own)), own: blocks };
        const body = llmChainedFollowUpBody(blocks, parent?.held, parent?.own);
        executed = await previous
          .followUp({
            content: lead === '' ? body : `${lead}\n\n${body}`,
            ...(request.validate == null ? {} : { validate: request.validate }),
            ...(request.maxAttempts == null ? {} : { maxAttempts: request.maxAttempts }),
            ...(request.responseSchemaHint == null ? {} : { responseSchemaHint: request.responseSchemaHint })
          })
          .execute();
      }

      if (sent != null) {
        sentBlocks.set(executed, sent);
      }

      return executed;
    }
  };
}
