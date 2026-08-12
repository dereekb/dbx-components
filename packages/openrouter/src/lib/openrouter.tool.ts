import { type Maybe, arrayToMap } from '@dereekb/util';
import { type ConversationState, type FunctionCallOutputItem, type ParsedToolCall, type Tool, type UnsentToolResult, isManualTool, unsentResultsToAPIFormat } from './openrouter.sdk';
import { type OpenRouterDeferredToolTaskId } from './openrouter.type';

/**
 * The tool-call id the SDK assigns to one invocation.
 */
export type OpenRouterToolCallId = string;

/**
 * A tool call that is waiting on a result from outside this process.
 *
 * A deferred tool is a MANUAL tool (`execute: false`): the SDK emits the call, does not run it, and
 * pauses. Some other system — a human, a queue worker, an inbound webhook — produces the result and
 * hands it back via {@link openRouterResolvedDeferredToolResults}, at which point the run continues.
 *
 * `taskId` is ours, not OpenRouter's. Nothing upstream allocates it, so a caller that wants to
 * correlate a pause with a ticket in its own system simply uses that ticket's id.
 */
export interface OpenRouterPendingDeferredToolCall {
  readonly callId: OpenRouterToolCallId;
  readonly name: string;
  /**
   * The task id the resolving system will quote. Defaults to `callId` when the caller supplies none.
   */
  readonly taskId: OpenRouterDeferredToolTaskId;
  /**
   * The arguments the model called the tool with.
   */
  readonly arguments?: Maybe<Record<string, unknown>>;
}

/**
 * A resolution for one pending deferred tool call: either a successful output or an error.
 */
export type OpenRouterDeferredToolResolution = { readonly taskId: OpenRouterDeferredToolTaskId; readonly output: unknown; readonly error?: never } | { readonly taskId: OpenRouterDeferredToolTaskId; readonly error: string; readonly output?: never };

/**
 * Extracts the deferred (manual) tool calls from a conversation state.
 *
 * Only manual tools can be pending on resume: a tool with an `execute` function was run in-process
 * before the state was ever saved.
 *
 * @param state - The conversation state.
 * @param tools - The tool set the run was configured with, used to tell manual tools from executable ones.
 * @returns The pending deferred tool calls.
 */
export function openRouterPendingDeferredToolCalls<TTools extends readonly Tool[] = readonly Tool[]>(state: Maybe<ConversationState<TTools>>, tools: Maybe<TTools>): OpenRouterPendingDeferredToolCall[] {
  const manualToolNames = new Set((tools ?? []).filter((x) => isManualTool(x)).map((x) => x.function.name));

  return (state?.pendingToolCalls ?? []).filter((call) => manualToolNames.size === 0 || manualToolNames.has(call.name)).map((call) => openRouterPendingDeferredToolCallFromParsedCall(call));
}

/**
 * Converts an SDK parsed tool call into a pending deferred tool call.
 *
 * @param call - The parsed tool call.
 * @param taskId - Optional task id to associate. Defaults to the call id.
 * @returns The pending deferred tool call.
 */
export function openRouterPendingDeferredToolCallFromParsedCall(call: ParsedToolCall<Tool>, taskId?: Maybe<OpenRouterDeferredToolTaskId>): OpenRouterPendingDeferredToolCall {
  return { callId: call.id, name: call.name, taskId: taskId ?? call.id, arguments: call.arguments as Maybe<Record<string, unknown>> };
}

/**
 * Turns resolutions into the `unsentToolResults` entries the SDK replays on the next call.
 *
 * A resolution whose `taskId` matches no pending call is DROPPED rather than throwing. Deferred
 * resolutions arrive from outside this process and may be replayed — an unmatched one means the task
 * was already settled, which must be a no-op, not a failure.
 *
 * @param pending - The currently pending deferred tool calls.
 * @param resolutions - The resolutions received.
 * @returns The unsent tool results, in the order the resolutions were given.
 */
export function openRouterResolvedDeferredToolResults<TTools extends readonly Tool[] = readonly Tool[]>(pending: Maybe<OpenRouterPendingDeferredToolCall[]>, resolutions: Maybe<OpenRouterDeferredToolResolution[]>): UnsentToolResult<TTools>[] {
  const byTaskId = arrayToMap(pending ?? [], (call) => call.taskId);
  const results: UnsentToolResult<TTools>[] = [];

  (resolutions ?? []).forEach((resolution) => {
    const call = byTaskId.get(resolution.taskId);

    if (call != null) {
      results.push({ callId: call.callId, name: call.name as UnsentToolResult<TTools>['name'], output: resolution.output, error: resolution.error });
    }
  });

  return results;
}

/**
 * Whether a conversation state is paused waiting on a deferred tool result.
 *
 * @param state - The conversation state.
 * @returns True when the state has pending tool calls it cannot resolve itself.
 */
export function isOpenRouterStateAwaitingDeferredTools(state: Maybe<ConversationState>): boolean {
  return (state?.pendingToolCalls?.length ?? 0) > 0;
}

/**
 * Converts recorded tool results into the `function_call_output` items that get appended to the
 * conversation before the run is resumed.
 *
 * This is how a deferred pause is un-paused, and it is done HERE rather than through the SDK on
 * purpose. `@openrouter/sdk@1.2.x` only knows how to resume a pause by re-running the tool locally
 * (`approveToolCalls` calls the tool's `execute`, and a manual tool has none) or by rejecting it — so
 * a result produced by another process has no route back in through the SDK's own API. Appending the
 * outputs to the persisted conversation and re-sending it does have one, and it is the same wire
 * format the SDK would have produced itself.
 *
 * @param results - The recorded results, in the persisted `callId` / `name` / `output` / `error` shape.
 * @returns The `function_call_output` items to append to the conversation.
 */
export function openRouterFunctionCallOutputItems(results: Maybe<readonly { readonly callId: string; readonly name: string; readonly output?: unknown; readonly error?: Maybe<string> }[]>): FunctionCallOutputItem[] {
  return unsentResultsToAPIFormat((results ?? []).map((result) => ({ callId: result.callId, name: result.name, output: result.output, error: result.error ?? undefined }) as UnsentToolResult));
}
