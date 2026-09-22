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
| `@dereekb/openrouter` | Config types, request builder, `callModel` wrapper, deferred-tool helpers, embeddings, **decisions**. Pure — no I/O. |
| `@dereekb/openrouter/firebase` | The `OpenRouterPrompt`, `OpenRouterPromptVersion` and `OpenRouterRunTask` models. |
| `@dereekb/openrouter/firebase-server` | Prompt service, run-task queue + sweep, Firestore `StateAccessor`, server actions. |

The raw OpenRouter client (`OpenRouterApi`) and the OTLP broadcast webhook live in
`@dereekb/nestjs/openrouter`; this package builds on them rather than duplicating them.

## Execution model

1. **Enqueue** — `enqueueRunTask({ key, promptKey, input })` writes one Firestore doc with
   `s: QUEUED` and returns. One write, nothing blocks.
2. **Drain** — `openRouterRunTaskSweep(...)` claims a page of `QUEUED` tasks by lease in **`qat` order**,
   runs them `maxParallelTasks` at a time, writes results, and stops claiming new pages once its
   `maxRunTimeMs` budget is spent. Unclaimed work stays `QUEUED` for the next tick. Mount it on a
   per-minute-ish schedule the app already runs.
3. **Consume** — `readRunTask(key)` → `COMPLETE` uses the output, `QUEUED`/`RUNNING` retries later,
   `FAILED` takes the failure path.
4. **Expire** — `openRouterRunTaskExpirationSweep(...)` deletes every task queued more than
   `OPENROUTER_RUN_TASK_MAX_AGE` (**7 days**) ago, **in any state, `RUNNING` included**. Its own, far
   slower schedule — hourly is plenty. Nothing lives past the ceiling, and there is no per-task
   expiration field to set or forget: a queued task runs essentially immediately, so `qat` *is* its age.

Retries are classified rather than uniform: a transient failure (429, 5xx, `ECONNRESET`, a Firestore
`UNAVAILABLE`) spends the `maxAttempts` budget, while a deterministic one (400, 401, 402, 403, 404, a
prompt that does not resolve) reaches `FAILED` on its first attempt instead of burning three sweep ticks
to reach the same answer. Anything unrecognized is treated as transient.

There is no replay. `enqueueRunTask({ key, …, restart: true })` re-runs a key, and `continueFrom` chains
one run onto another's history.

Short calls skip all of it: `callModelForPrompt(...)` runs inline and returns the result with no
document.

## Decisions (System One / Jev)

OpenRouter has **two** inference surfaces, and this package serves both. `/responses` asks a model for
prose and validates the reply back into a shape. **System One** (`POST /systemone`, the `typesafe/jev-*`
models) inverts that: the caller declares the answer space up front as typed questions, and the model
returns a position inside it plus a calibrated distribution. `(state, questions) → answers`. There is no
reply to parse, so there is no off-shape reply to recover from.

Three primitives, and no others:

| Primitive | Asks | Answers |
|---|---|---|
| `openRouterChoiceQuestion(instructions, options)` | which of these options? | `choice`, guaranteed one of the declared options; `probabilities` over every option summing to 1 (a free full ranking); `confidence` |
| `openRouterScoreQuestion(instructions, levels)` | which level on this rubric? | a `score` that may land BETWEEN two levels, the distribution, `confidence` |
| `openRouterNoulQuestion(instructions, means?)` | is this true? | `noul` 0..1 — the probability IS the uncertainty, so there is no separate confidence |

```ts
const questions = {
  team: openRouterChoiceQuestion('Which team should own `ticket`?', {
    billing: { what: 'Charges, invoices, refunds', not_for: 'Anything about signing in' },
    access: { what: 'Sign-in, passwords, permissions', not_for: 'Anything about money' },
    other: { what: 'Anything the other options do not cover' }
  }),
  spam: openRouterNoulQuestion('`ticket` is unsolicited marketing rather than a real request.')
};

const result = await decideForPrompt({ client, promptService, promptKey: 'demo-support-triage', state: { ticket } });
result.answers.team.choice;   // typed to the declared option names
result.answers.spam.noul;     // 0..1
```

**Declare every question one state could need in ONE call.** Each is evaluated independently against the
same state, so the question map is both the batching unit and the cost unit: the state is sent and billed
once, and a speculative question the caller may discard costs only its own tokens.

**Membership is the transport's guarantee.** `readOpenRouterDecisionAnswers` checks every answer against
the question that asked it, so no consumer re-checks: past that point a `choice` is one of the declared
options, a `score` is inside the declared range, a `noul` is a probability. An answer that left its space
raises `OpenRouterDecisionAnswerFaultError` — a defect in the RESPONSE, never a judgement the model made.
"None of these fits" is said through a Noul the caller declared for it, and lands as an *answer*.

A Choice is only ever RELATIVE — its probabilities are normalised over the options supplied, so something
always wins even when nothing fits. When "nothing fits" is an outcome you act on, pair it with a Noul,
which is absolute and may be low for every option.

### Writing a question

- **One snap judgement per question.** A judgement weighing several factors is several questions combined
  in your own code.
- **Write the COMPLETE question in `instructions`** — the question id is never sent, so a descriptive key
  is no substitute. A blank one is refused at declaration.
- **Point at named state with backticked dot-paths** — `` `phrase` ``, `` `ticket.sender.email` ``,
  `` `messages[0].text` ``. Prefer an object state so each part has a name to point at.
  `openRouterDecisionStatePaths` reads them back so a spec can pin that a declaration names keys its
  state has (documented and inspectable, never enforced — backticks also quote literals).
- **Score levels are SITUATIONS, not degrees.** "Broken feature, but a workaround exists" gives the model
  something to match against; "moderately severe" does not. Every level is evaluated separately and the
  model never sees a level's number or its neighbours, so numbers in the descriptions do not help.
- **Choice options are CONTRASTIVE** — the same keys on every option (`{what, not_for, examples}`) so the
  model compares like with like. Include an explicit `other` when the set may not cover the input.
- **Filter in code first.** Accuracy falls as a state grows with material unrelated to the decision; a
  wide state is not a free hedge.

Every declaration surface takes `string | object | array` and the wire carries it VERBATIM — start with
strings, and reach for structure only for guidance prose would blur or for data that is already JSON.

### Limits, enforced at declaration

| Limit | Value | Past it |
|---|---|---|
| Choice options | ≤ 255 | Narrow in two stages. Never truncate — an option removed is one the model can never pick, and nothing reports it was missing. |
| Score levels | 2 .. 10 | MERGE the levels that cannot be told apart. The trap: a 0..8 band is nine levels and legal, a 0..10 scale is eleven and 400s at the wire. |
| Context | 64k tokens per request | Filter in code first. |
| Price | $0.042 / Mtok input; output reported but **not billed** | `usage.cost` is synchronous and final. |

`validateOpenRouterDecisionQuestions` fails at the DECLARATION, naming the question — not as a 4xx about
a request body — and runs at version create / update / seed, so a malformed question map is refused when
it is written rather than every time it is asked.

### Routing: the model id is the discriminator

System One models are **not listed by `GET /models`**, so nothing can be learned about one from the
catalog, and a wrong guess does not produce an error anyone can read. The slug is therefore checked on
**both** arms and neither can be entered with the other's model:

- `validateOpenRouterModelConfig(config)` errors on a `typesafe/…` slug, naming `openRouterDecision`.
  It already runs at publish time, so a Jev slug typed into a stored version is refused when written.
- `validateOpenRouterModelConfig(config, { decision: true })` errors on a chat slug.
- `openRouterResponsesRequestBody` throws `OpenRouterSystemOneModelOnCompletionArmError`. It is the one
  point every completion dispatch path builds its body, so no route can be added later that skips it.

`OPENROUTER_JEV_1_13_MODEL_ID` is a **versioned** slug, deliberately not the moving `jev-latest` alias:
an answer is only reproducible against the model that gave it, which is the same reason versions exist.
The reply reports the model that actually served it (`typesafe/jev-1.13-20260917`), so read `result.model`
rather than assuming the slug you asked for.

### Where a decision lives

A decision prompt is an ordinary `OpenRouterPrompt` whose version carries `q` (questions) instead of
`m` (messages), and whose config names a System One model. The two are mutually exclusive — a decision
has no prose output for instructions and seed messages to shape.

Stored questions are the STATIC half of the answer space; a caller may declare further questions per call
and they merge over the stored ones by id. That is what lets a fixed taxonomy be tuned by an operator
while a per-call candidate set still comes from code.

| Call | When |
|---|---|
| `decideForPrompt(...)` | The default. No document, no sweep — a Jev call answers in about a hundred milliseconds, has no tools and nothing to defer, so the queue buys nothing on the happy path. |
| `enqueueRunTask({ state, questions, immediate: true })` | When a FAILURE has to survive this process. Same run-it-now latency, plus a document: a retryable failure (OpenRouter down, a 429) is left QUEUED for the sweep, and a deterministic one still reaches FAILED on the first attempt. |

`immediate` writes the document either way, so `readRunTask(key)` behaves the same whether or not the
inline attempt succeeded — which is the point of it being a queue flag rather than a second inline call.
It is not decisions-specific; a completion run can use it too.

## Store-locking a prompt

`storeLocked` (`sl`) on an `OpenRouterPrompt` says the STORE owns this prompt's content: a code
definition can neither seed it nor overtake it. It is the counterpart of a version's `lk` — that locks a
version against edits, this locks a prompt against its own definition — and it applies to any prompt,
not just a decision.

Set it on a prompt whose content is maintained at runtime. A decision is the motivating case, because its
questions are exactly the thing an operator tunes, and a later `version` bump in code would otherwise
publish straight over that work.

- **Seeding** skips a locked prompt and says so in the run's `warnings`, beside the existing rule that
  never resurrects an `ARCHIVED` one.
- **Resolution** stops preferring a definition whose version has moved ahead of the store.
- It is deliberately **lenient**: a definition may still STAND IN when the store holds no version at all,
  which is what keeps a fresh emulator or a never-seeded project able to serve the prompt with no manual
  step. The lock prevents being *overwritten*, not being served.

Turn it on through `openRouterPrompt.update`, or declare `storeLocked` on a definition to set it when the
prompt is first created. A definition cannot lock a prompt it did not create — that would let code seize
one an operator is already maintaining.

## Managing prompts

There is deliberately no Angular UI for prompt authoring. Declaring the CRUD is what makes every prompt
operation reachable over a consuming app's existing callModel surface — its CLI and the callModel MCP —
instead of requiring a screen.

| Operation | What it does |
|---|---|
| `openRouterPrompt.read` | The prompt plus **the version it actually serves**. |
| `openRouterPrompt.query` | Page the collection, optionally filtered by lifecycle state. |
| `openRouterPrompt.update` | Metadata, lifecycle state, and which version is active. |
| `openRouterPromptVersion.create` | Publish a version. Allocates its number and locks the one it succeeds. |
| `openRouterPromptVersion.update` | Edit the head version in place. Refuses a locked one. |

A prompt has no `create`: it comes into existence server-side from a seed against an
`OpenRouterPromptDefinition` the app already ships. Seeding is not CRUD either — exposing it would hand
any admin a button that rewrites prompt pointers.

**Prefer `read` over `model-get`.** Both models are registered model services, so either document is
fetchable by key, but the prompt document holds only pointers (`av`, `lv`) and none of what the prompt
says. Following them by hand means addressing the version subcollection at a zero-padded id, and still
misses the definition fallback. `read` resolves, and reports `source: 'store' | 'definition'` so the
precedence rule is observable rather than rederived:

| Store state | Served | `source` |
|---|---|---|
| No prompt document | Code definition | `definition` |
| Stored `activeVersion` **≥** the definition's declared version | Store | `store` |
| Stored `activeVersion` **<** the definition's declared version | Code definition | `definition` |

### Access

Prompts are operational configuration, not secrets — nothing here is encrypted, and reads are
**admin-only** rather than server-only. An admin who can edit a prompt has to be able to read back what
they wrote, which is why neither model carries `@dbxModelServerOnly`: that tag is copied onto the
generated CLI/MCP manifest, so a consuming app cannot override it, and the CLI would refuse the read
locally before choosing a transport.

A consuming app that wants these closed does so in the two places that actually refuse a read, and must
do **both** — they mirror each other, and `dbx_model_server_only_validate_app` reports the drift when
they disagree:

1. omit the `orp` / `orpv` match blocks from `firestore.rules`, and
2. set `serverOnly: true` on the model's `firebaseModelServiceFactory`.

An app that leaves them open grants the read to system admins:

```
match /orp/{openRouterPrompt} {
  allow read: if userClaimsIsSysAdmin();

  match /orpv/{openRouterPromptVersion} {
    allow read: if userClaimsIsSysAdmin();
  }
}

// the model API addresses a version through the collection GROUP, which the nested match does not cover
match /{path=**}/orpv/{openRouterPromptVersion} {
  allow read: if userClaimsIsSysAdmin();
}
```

`orrt` (`OpenRouterRunTask`) is readable by a system admin too — it is the execution record an operator
reaches for when a run fails, and its `msg` field carrying the model's raw input and output is the
reason to read it. It is granted `read` ALONE, on both transports: the sweep owns every write (claim,
lease, state transition), so a client write would move a task out from under the sweep executing it.

```
match /orrt/{openRouterRunTask} {
  allow read: if userClaimsIsSysAdmin();
}
```

## Files and PDFs

There is no upload step. A run task stores the **GCS object path** (`fp`) and nothing else — never a
URL, never the bytes. The attachment is resolved fresh on **every attempt**, in one of two modes:

| Mode | What goes on the wire | When |
|---|---|---|
| `signedUrl` | `file_url`, a short-lived signed URL OpenRouter dereferences itself | Default. Cheap, keeps the request small. |
| `inlineData` | `file_data: "data:<mime>;base64,…"` | The object is not reachable from the public internet. |

**The mode comes from the environment**, not from a flag an app has to remember to set twice: give
`openRouterRunTaskService` a `FirebaseServerEnvService` and `isTestingEnv` selects `inlineData`. That is
what makes files work against the **Firebase storage emulator**, where nothing is really signed and the
host is `localhost`, so a `file_url` OpenRouter tries to fetch resolves to nothing. `fileAttachmentMode`
overrides it explicitly, and `maxInlineFileSizeBytes` (default 256 KB) caps the read — inline bloats the
request ~33% and is re-paid on every attempt, unlike a URL.

`openRouterFileAttachmentResolver()` is the same factory, exposed for an inline (`callModelForPrompt`)
caller that needs attachments without going through the queue.

Neither payload is ever persisted. Resolving per attempt is only half the fix — the other half is that
the conversation written back through the `StateAccessor` has its `input_file` payloads **stripped**
(`openRouterMessagesWithoutFileAttachmentData`), keeping only `filename` as the rejoin key, and `load()`
re-points them at the current attempt's attachment
(`openRouterMessagesWithFreshFileAttachments`). Without that, a deferred resume hours later would replay
a URL that expired minutes after it was minted, or carry a second copy of the whole file in a Firestore
document with a 1 MiB ceiling.

PDF parsing pins `engine: 'native'` so the model provider parses on our BYOK key; the default silently
falls back to `mistral-ocr` (8-image cap, per-page billing) with no error.

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
- `openrouter.decision.spike.spec.ts` — the System One probes. Cheap for a different reason: input is
  $0.042/Mtok and output is not billed at all. They pin what only a real call can settle — that all three
  primitives answer in the declared shape, that `usage.cost` arrives synchronously (which is why a
  decision needs no broadcast reconciliation), and that the wire is snake_case where the SDK decodes to
  camelCase.
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
| `OPENROUTER_TEST_DECISION_MODEL_ID` | System One model for the decision probes. Defaults to `typesafe/jev-1.13`. Its own knob because the two arms cannot share one value. |

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

**Two** composites on `orrt`: `(s, qat)` for the drain sweep and `(s, lat)` for lease reclamation. The
retention query needs none at all — `qat <= cutoff` ordered by `qat` is a single-field range with a
matching order, which Firestore serves from its automatic single-field index.

Nothing on `orp`. The prompt query filters on `s` alone and adds no ordering, so pagination rides
Firestore's implicit `__name__` order — which for this model is the prompt's own readable key. Adding a
second filter axis (an `array-contains` on `t`, say) is what would buy the first composite here.

**The emulator does not enforce composite indexes**, so a green integration run proves nothing here —
`openrouter.query.spec.ts` asserts the generated file against the query factories instead, and pins the
count at exactly two so a re-added factory cannot quietly buy a third.
