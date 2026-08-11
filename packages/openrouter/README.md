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

A file whose parse is already cached on the run task (`fa`) is **not re-attached** on a retry — the
cached text is resubmitted instead. OpenRouter's documented `annotations` echo is emitted too, but it
does not currently survive the SDK: `@openrouter/sdk@1.2.26` validates the `/responses` body against a
closed union whose message variants have no `annotations` field, so the property is stripped before the
request leaves the process. Not sending the document is therefore the only thing that actually prevents
a re-parse today.

## Hosted tools (`file_search`, `web_search`, `mcp`)

Hosted (server-executed) tools go on the model config's `tools` array and are dispatched for real:

```ts
config: {
  model: 'openai/gpt-5.1',
  tools: [openRouterFileSearchTool(['vs_…'], 5)],
  include: ['file_search_call.results'],
  provider: openRouterProviderPinnedTo('openai')   // BYOK pinning + requireParameters
}
```

**They do not go through `callModel`.** `@openrouter/sdk`'s `callModel` destructures `tools` off the
request and runs every entry through its client-function converter, which reads `tool.function.name` —
so a hosted entry is dropped outright when no client tools are present, and throws inside the SDK at
dispatch when they are. `callModelForOpenRouterRequest` therefore routes by the shape of the request:

| Run | Transport |
|---|---|
| No hosted tools | `callModel`, unchanged. |
| Hosted tools, no client tools and no `StateAccessor` | `sendOpenRouterResponsesRequest` — a direct, **non-streaming** `POST /responses`. |
| Hosted tools **plus** client tools or a `StateAccessor` | `ModelResult` assembled here, with the hosted entries appended **after** client-tool conversion. |

The two are **not** mutually exclusive: a run can search a vector store and drive the client-side tool
loop in the same call. Only the entry point differs — the merged path is a `callModel` request in
everything else, including the `x-openrouter-callmodel` header and the `stopWhen` step ceiling.

Going direct for the hosted-only case is not just about getting the tool onto the wire. The request is
non-streaming, so the returned `OpenResponsesResult` is OpenRouter's body verbatim rather than one
reassembled from stream events — which is what preserves a `file_search_call` output item and the chunks
`include: ['file_search_call.results']` asked for.

**OpenRouter's side is verified live.** A hosted `file_search` tool is forwarded upstream to OpenAI,
which resolves the store id and (for a nonexistent one) answers with its own
`Vector store with id [...] not found.` — an error only the upstream lookup can produce. The tool comes
back echoed on the response intact. See `openrouter.filesearch.spike.spec.ts`.

Two details settled by the same probes:

- The wire name is `vector_store_ids`; sending `vectorStoreIds` to the API is a flat `400`. The SDK
  takes `vectorStoreIds` and remaps it, so `openRouterFileSearchTool()` is camelCase on purpose and
  validation rejects the wire-cased spelling (which the SDK would silently drop, leaving a tool that
  searches nothing and a model answering ungrounded).
- `provider.requireParameters: true` made no difference on a single-provider model, which is the one
  case where it cannot. Keep it for any model with more than one provider — validation warns when a
  hosted tool is configured without it.

**OpenRouter can never create or populate a vector store** — ingestion always goes direct to OpenAI.

## Auditing a run

A run task stores its own output; `gi (generationIds)` exists so a completed run can be looked up
afterwards. `openRouterGeneration({ client, id })` returns finish reason, cancellation, BYOK, latency and
the server-finalised token/cost breakdown, and `openRouterGenerationContent(...)` returns the stored
prompt / completion / reasoning / output.

Treat both as **audit surfaces, never the system of record**: what they return is tied to account logging
settings (nothing is retained under ZDR / logging-disabled), retention is undocumented, and they are
keyed per generation rather than per conversation.

## Live probes

Two blocks make real API calls, both skipped unless `OPENROUTER_API_KEY` is set:

- `openrouter.filesearch.spike.spec.ts` — the `file_search` passthrough probes. Deliberately cheap: a
  free model by default, and the file_search probe fails at the store lookup before anything is billed.
- the `live end-to-end` block in `openrouter.runtask.emulator.spec.ts` — publishes a version, enqueues a
  run, drains it with the real sweeper against the real API, then resolves the stored generation id
  through `openRouterGeneration`. This is the plan's end-to-end bullet minus its MCP transport: no app in
  this repo consumes the models yet, so the same server actions the callModel MCP surfaces are called
  directly instead.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Enables the live probes. |
| `OPENROUTER_TEST_MODEL_ID` | Model for the general probe and the end-to-end run. Defaults to `nvidia/nemotron-nano-9b-v2:free`. |
| `OPENROUTER_FILE_SEARCH_MODEL_ID` | Model for the file_search probe. Must be an OpenAI model. |
| `OPENROUTER_FILE_SEARCH_VECTOR_STORE_ID` | A real `vs_…`; upgrades the probe to the full grounded assertion. |

## CJS / ESM

`@openrouter/sdk` is ESM-only (`"type": "module"`) while this package also ships a CommonJS bundle, so
the CJS bundle `require()`s an ESM dependency. That works on Node 22.12+ and is verified on the
`nodejs24` runtime `firebase.json` deploys to: `require('dist/packages/openrouter/index.cjs.js')` loads
and resolves every export, `responsesSend` / `ModelResult` / `convertToolsToAPIFormat` included. Re-check
it if the Functions runtime is ever pinned lower — below 22.12 this is an `ERR_REQUIRE_ESM`, not a
warning.

## Firestore indexes

`firebase/firestore.indexes.json` is generated from the `@dbxModelFirebaseIndex`-tagged query factories
and is the set a consuming app must merge into its own indexes file:

```
dbx-cli-generate-firestore-indexes --component packages/openrouter/firebase --output packages/openrouter/firebase/firestore.indexes.json
```

Four composites on `orrt`: `(s, qat)` for the sweep, `(s, pr, qat)` when `usePriorityOrder` is on,
`(s, lat)` for lease reclamation, and `(pk, qat desc)` for per-prompt history. **The emulator does not
enforce composite indexes**, so a green integration run proves nothing here — `openrouter.query.spec.ts`
asserts the generated file against the query factories instead.
