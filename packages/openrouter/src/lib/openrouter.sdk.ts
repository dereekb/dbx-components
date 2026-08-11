/**
 * The single boundary between this package and `@openrouter/sdk`.
 *
 * The SDK publishes its agent surface (`callModel`, tools, conversation state, stop conditions) from
 * deep subpaths rather than its root, so those import specifiers are inherently brittle. They are
 * confined to this one file: an SDK reorganisation is then a change here rather than across the
 * package.
 *
 * NOTE ON `@openrouter/agent`: the plan's step 1 called for adding it alongside `@openrouter/sdk`
 * `^1.2.x`. It was NOT added. `@openrouter/agent@0.9.0` (the latest) declares
 * `"@openrouter/sdk": "^0.13.7"`, so npm installs it a NESTED second copy of the SDK — and the two
 * `OpenRouterCore` classes are distinct nominal types (they carry different `#private` brands), so a
 * client built by `@dereekb/nestjs/openrouter` from the 1.2.x SDK cannot be passed to the agent
 * package's `callModel` at all. Two clients, two request builders, one of them silently older.
 *
 * The tradeoff was checked rather than assumed: the `ResponsesRequest` field sets of `0.13.67` and
 * `1.2.26` are IDENTICAL, so the plan's stated reason for wanting `^1.2.x` ("the pinned 0.12.79 SDK
 * is already missing ~8 params") is satisfied by the 1.2.x SDK on its own. The only thing the agent
 * package adds is its first-class deferred-tool API (`tool({ lifecycle: 'deferred' })` +
 * `resumeToolResults`). That is the plan's blocker (4) — "documented but has no in-repo precedent" —
 * and the plan places the pause data on our own run task (`ptc` / `utr`) and the resume entry point on
 * our own service (`resolveDeferredTool`), not on the SDK. The 1.2.x SDK's manual tools
 * (`execute: false`) plus `ConversationState.pendingToolCalls` / `unsentToolResults` provide exactly
 * that mechanism. See `openrouter.tool.ts`.
 */

export { callModel } from '@openrouter/sdk/funcs/call-model';
export { embeddingsGenerate } from '@openrouter/sdk/funcs/embeddingsGenerate';
export { tool } from '@openrouter/sdk/lib/tool';
export { finishReasonIs, hasToolCall, maxCost, maxTokensUsed, stepCountIs } from '@openrouter/sdk/lib/stop-conditions';
export { isManualTool, ToolType } from '@openrouter/sdk/lib/tool-types';

export type { OpenRouterCore } from '@openrouter/sdk/core';
export type { CallModelInput } from '@openrouter/sdk/lib/async-params';
export type { ModelResult } from '@openrouter/sdk/lib/model-result';
export type { RequestOptions } from '@openrouter/sdk/lib/sdks';
export type { ConversationState, ConversationStatus, ParsedToolCall, StateAccessor, StopWhen, Tool, UnsentToolResult } from '@openrouter/sdk/lib/tool-types';
export type { InputsUnion, OpenResponsesResult, Usage } from '@openrouter/sdk/models';
export type { CreateEmbeddingsRequest, CreateEmbeddingsResponseBody } from '@openrouter/sdk/models/operations';
