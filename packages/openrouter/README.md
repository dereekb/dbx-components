# @dereekb/openrouter

Replacement for OpenAI's deprecated reusable Prompt Objects (`v1/prompts`, removed 2026-11-30), built
on OpenRouter.

OpenRouter is **stateless** — `store` is type-pinned to `false`, there is no `background: true`, no
server-side job store, and `previous_response_id` is rejected. Everything OpenAI used to do on their
side is therefore done here: prompt content and model config live in Firestore (git-adjacent and
MCP-editable rather than hidden in a dashboard), and asynchronous execution is an app-owned run-task
queue drained by a sweeper the app mounts on a schedule it already runs.

## Entry points

| Entry | Purpose |
|---|---|
| `@dereekb/openrouter` | Config types, request builder, `callModel` wrapper, deferred-tool helpers, embeddings. Pure — no I/O. |
| `@dereekb/openrouter/firebase` | The `OpenRouterPrompt`, `OpenRouterPromptVersion` and `OpenRouterRunTask` models. |
| `@dereekb/openrouter/firebase-server` | Prompt service, run-task queue + sweep, Firestore `StateAccessor`, server actions. |

The raw OpenRouter client (`OpenRouterApi`) and the OTLP broadcast webhook live in
`@dereekb/nestjs/openrouter`; this package builds on them rather than duplicating them.

## Execution model

1. **Enqueue** — `enqueueRunTask({ key, promptKey, input })` writes one Firestore doc with
   `s: QUEUED` and returns. One write, nothing blocks.
2. **Drain** — `openRouterRunTaskSweep(...)` claims a page of `QUEUED` tasks by lease, runs them
   `maxParallelTasks` at a time, writes results, and stops claiming new pages once its
   `maxRunTimeMs` budget is spent. Unclaimed work stays `QUEUED` for the next tick.
3. **Consume** — `readRunTask(key)` → `COMPLETE` uses the output, `QUEUED`/`RUNNING` retries later,
   `FAILED` takes the failure path.

Short calls skip all of it: `callModelForPrompt(...)` runs inline and returns the result with no
document.

## Files and PDFs

There is no upload step. A run task stores the **GCS object path**, never a signed URL — the sweeper
mints a fresh signed URL on every attempt, so a retry hours later still works. PDF parsing pins
`engine: 'native'` so the model provider parses on our BYOK key; the default silently falls back to
`mistral-ocr` (8-image cap, per-page billing) with no error.
