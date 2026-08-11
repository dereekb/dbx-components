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

## Hosted tools — the `file_search` spike

**OpenRouter's side works.** Verified live: a hosted `file_search` tool is forwarded upstream to OpenAI,
which resolves the store id and (for a nonexistent one) answers with its own
`Vector store with id [...] not found.` — an error only the upstream lookup can produce. The tool comes
back echoed on the response intact. See `openrouter.filesearch.spike.spec.ts`.

**Our side does not.** A prompt carrying a hosted tool **fails validation and cannot be published**,
because `@openrouter/sdk`'s `callModel` destructures `tools` off the request and runs every entry
through its client-function converter — so a hosted entry throws inside the SDK at dispatch, on a run
already queued, claimed and charged an attempt. Sending one needs a direct `/responses` path that
bypasses `callModel`; until that exists the failure is raised at authoring time, where it is legible.

Two details settled by the same probes:

- The wire name is `vector_store_ids`; sending `vectorStoreIds` to the API is a flat `400`. The SDK
  takes `vectorStoreIds` and remaps it, so `openRouterFileSearchTool()` is camelCase on purpose and
  validation rejects the wire-cased spelling (which the SDK would silently drop, leaving a tool that
  searches nothing and a model answering ungrounded).
- `provider.requireParameters: true` made no difference on a single-provider model, which is the one
  case where it cannot. Keep it for any model with more than one provider.

**OpenRouter can never create or populate a vector store** — ingestion always goes direct to OpenAI.

### Live probes

`openrouter.filesearch.spike.spec.ts` is skipped unless `OPENROUTER_API_KEY` is set. It defaults to a
free model and the file_search probe fails at the store lookup before anything is billed.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Enables the live probes. |
| `OPENROUTER_TEST_MODEL_ID` | Model for the general probe. Defaults to `nvidia/nemotron-nano-9b-v2:free`. |
| `OPENROUTER_FILE_SEARCH_MODEL_ID` | Model for the file_search probe. Must be an OpenAI model. |
| `OPENROUTER_FILE_SEARCH_VECTOR_STORE_ID` | A real `vs_…`; upgrades the probe to the full end-to-end assertion. |

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
