/**
 * The single boundary between this package and `@openrouter/sdk`.
 *
 * The SDK publishes its agent surface (`callModel`, tools, conversation state, stop conditions) from
 * deep subpaths rather than its root, so those import specifiers are inherently brittle. They are
 * confined to this one file: an SDK reorganisation is then a change here rather than across the
 * package.
 *
 * `@openrouter/agent` is deliberately NOT used. It declares `"@openrouter/sdk": "^0.13.7"`, so npm nests a
 * second copy of the SDK — and the two `OpenRouterCore` classes are distinct nominal types (different
 * `#private` brands), so a client built from the 1.2.x SDK cannot be passed to its `callModel` at all. The
 * only thing it adds is a first-class deferred-tool API, and the 1.2.x SDK's manual tools
 * (`execute: false`) plus `ConversationState.pendingToolCalls` / `unsentToolResults` already provide that
 * mechanism. See `openrouter.tool.ts`.
 *
 * `responsesSend` / `ModelResult` / `convertToolsToAPIFormat` are what make hosted (server-executed) tools
 * deliverable: `callModel` owns the `tools` key and converts every entry as a client function tool, so
 * taking its transport and its tool loop directly is what lets `openrouter.call.ts` put an
 * already-converted tool array on the request. See `openRouterModelResultForRequest`.
 */

export { callModel } from '@openrouter/sdk/funcs/call-model';
export { responsesSend } from '@openrouter/sdk/funcs/responsesSend';
export { unsentResultsToAPIFormat } from '@openrouter/sdk/lib/conversation-state';
export { embeddingsGenerate } from '@openrouter/sdk/funcs/embeddingsGenerate';
export { generationsGetGeneration } from '@openrouter/sdk/funcs/generationsGetGeneration';
export { generationsListGenerationContent } from '@openrouter/sdk/funcs/generationsListGenerationContent';
export { ModelResult } from '@openrouter/sdk/lib/model-result';
export { tool } from '@openrouter/sdk/lib/tool';
export { convertToolsToAPIFormat } from '@openrouter/sdk/lib/tool-executor';
export { finishReasonIs, hasToolCall, maxCost, maxTokensUsed, stepCountIs } from '@openrouter/sdk/lib/stop-conditions';
export { isManualTool, ToolType } from '@openrouter/sdk/lib/tool-types';

export type { OpenRouterCore } from '@openrouter/sdk/core';
export type { CallModelInput } from '@openrouter/sdk/lib/async-params';
export type { RequestOptions } from '@openrouter/sdk/lib/sdks';
export type { ConversationState, ConversationStatus, ParsedToolCall, StateAccessor, StopWhen, Tool, UnsentToolResult } from '@openrouter/sdk/lib/tool-types';
export type { FunctionCallOutputItem, GenerationContentData, GenerationResponseData, InputsUnion, OpenResponsesResult, ResponsesRequest, Usage } from '@openrouter/sdk/models';
export type { CreateEmbeddingsRequest, CreateEmbeddingsResponseBody, CreateResponsesResponse } from '@openrouter/sdk/models/operations';
