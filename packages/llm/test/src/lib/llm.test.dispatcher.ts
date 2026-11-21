/**
 * **Dispatcher fake** — a dispatcher double over a bare dispatch function, for specs that drive code taking an
 * `LlmDispatcher` without building a real dispatcher, strategy registry or model config.
 */

import { joinLlmLiveContextBlocks, makeLlmPromptFactory, type LlmDispatcher, type LlmDispatchRequest, type LlmDispatchResult } from '@dereekb/llm';

/**
 * Wrap a bare dispatch function as an `LlmDispatcher` — a dispatcher double over a bare dispatch function. `dispatch`
 * is the function; `preparePrompt` (and `resumePrompt`'s follow-ups) route every execution (root or follow-up) through it
 * too, reporting the root's sent turn as its joined live context and a follow-up's as the follow-up's content.
 *
 * @param dispatch - The dispatch function.
 * @returns The dispatcher.
 *
 * @example
 * ```ts
 * const fake = makeLlmDispatcherFake(async (request) => ({ text: '{}', strategyId: 'fake', capability: request.capability }));
 * ```
 */
export function makeLlmDispatcherFake<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult>(dispatch: (request: R) => Promise<X>): LlmDispatcher<R, X> {
  const preparePrompt = makeLlmPromptFactory<R, X>({
    runPromptRequest: async ({ request, followUp }) => {
      const result = await dispatch(request);
      return { result, sentTurn: { role: 'user', content: followUp == null ? joinLlmLiveContextBlocks(request.renderLiveContext()) : followUp.content } };
    }
  });

  return {
    dispatch,
    preparePrompt,
    resumePrompt: preparePrompt.resume
  };
}
