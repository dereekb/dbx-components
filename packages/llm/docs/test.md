# Test infrastructure (`@dereekb/llm/test`)

Entry: `@dereekb/llm/test` (Node-only test infrastructure) · [← @dereekb/llm](../README.md)

`/test` is Node-only test infrastructure: no browser entry imports it, and it never imports `vitest`, so a plain Node
harness (a benchmark CLI) can use it too. Nothing in it bills unless a live lane is UNLOCKED and keyed — tapes and
scripts make no network call, and the lane's helpers answer `undefined` while it is locked.

- **Tape replay.** `makeLlmTapeStrategy({ turns })` serves recorded completions. A turn matches on its capability plus
  `hashLlmTapePrompt(prompt)` (`sha256HexPrefix(text, 12)` from `@dereekb/util`, byte-equal to a `node:crypto` digest): hash
  first, so a byte-identical replay consumes the tape in exact order whatever the dispatch order, then the next
  unconsumed turn of the same capability (an `order` match — the prompt drifted, the run still completes). With nothing
  left to serve it throws `LlmTapeStrategyError` — `tape-exhausted` (more calls than the recording) or
  `capability-drift` (the call sequence changed) — which TRUNCATES the replay at that call: calls already served stay
  readable, nothing past it ran. A served completion keeps the recorded tokens and forces `cost` to `0`. After the run,
  `matches()` (with each request's prompt and digest, for diffs), `unconsumed()` and `failures()` (recorded even when
  a host swallows the throw) feed a report; `isLlmTapeStrategyError` checks the shape, not the prototype.
  `readLlmTapeTurn(payload, { decisionStrategyKinds, hash })` turns one persisted `llm_call` payload into a turn (pass
  the same `hash` the tape strategy uses), and answers `undefined` for a capture-off row, a decision row or a
  non-object. It reads a row written with `toLlmCallLogPayload(record, { keepIo: true })`; a row without I/O has no
  prompt or text and reads as `undefined`.
- **Scripted completions.** `makeLlmScriptedStrategy` answers each call from `respond(request, call)`, else
  `byCapability[capability]` (a reply or a list with its own counter), else `replies` (in order). A list repeats its
  last entry once spent; an empty list is no reply, and a call nothing answers throws, naming the id, capability and
  call. A reply is a text, a completion spec (`{ text, usage, finishReason, … }`) or an `Error` the call throws — how a
  spec drives a transport failure. Pass `requests` to collect every request, including the ones that threw.
- **Scripted decisions.** `makeLlmScriptedDecisionStrategy({ script })` reads the script's answers through
  `requireLlmDecisionAnswers`, so an under-answered or malformed script is refused with `LlmDecisionAnswerFaultError`
  exactly as a live transport would; usage is a zero-cost reading. Build answers with this entry's
  `makeLlmDecisionChoiceAnswer` / `makeLlmDecisionScoreAnswer` / `makeLlmDecisionNoulAnswer`, which are well-formed by
  construction, so a script states only which option won and how surely.
- **Fetch seams.** `makeLlmFetchFake(respond)` is a `ConfiguredFetch` fake for any fetch-seam spec: it records each
  request (`url`, and an `init` with `method`, a plain `headers` record, `body`, `signal`) and answers with a real
  `Response` (`llmFetchFakeResponse({ status, body, headers })`); `respond` is an answer, a function, or `'hang'`.
  `readLlmFetchFakeHeader(request, name)` reads a recorded header in any case.
- **Chat client.** `makeLlmOpenAiChatClientFake(config)` is a fake OpenAI-compatible chat client for the `/openai` and
  `/openrouter` strategy specs: it records each body and its request options and answers one canned completion (the
  `reply`, plus whichever of `id` / `model` / `provider` / `usage` / finish reasons are set, or a whole `completion`
  verbatim). Its client is a structural mirror of `LlmOpenAiChatClient` built from root types, since this entry imports
  no provider entry; passing it where the real client is expected is the check that the two agree.
- **Completion adapter.** `makeLlmCompletionAdapterFake({ kind, defaultBaseUrl?, mintId? })` records every config it is
  asked to `make` a strategy from; its strategies count `complete` calls and reject them.
- **Dispatcher.** `makeLlmDispatcherFake(fn)` wraps a bare dispatch function as a dispatcher whose prompts run through
  it.
- **System One wire.** `makeLlmSystemOneWireFake({ respond })` is the one `/systemone` fake (its `fetch` is a
  `ConfiguredFetch`): `respond` is an answer
  (`{ status, body, headers }`, used for every request), a function (called per request; a throw is the socket
  failure) or `'hang'` (rejects with the signal's reason on abort). It records every request (`url`, `init`, parsed
  `body`) in `requests`. Pass its `fetch` as a decision strategy's `decisionFetch`, or stub the global `fetch` with it
  to drive a keyed strategy. `toLlmSystemOneWireReply(body)` is its default well-formed reply.
- **The live lane.** `makeLlmLiveLane({ schema, adapters, … })` is the billed-spec lane as one factory. Its switch
  and verdict names (`names`, merged over `DEFAULT_LLM_LIVE_LANE_ENV_NAMES`) and provider / model names (`envNames`,
  `/node`'s `DEFAULT_LLM_ENV_NAMES`) are injected, and so is the provider resolver (`resolveProviders`, defaulting to
  `/node`'s `resolveLlmProvidersFromEnv`). `liveStrategyFromEnv()` answers the live handle (`strategyId`, `model`,
  `apiKeyEnv`, `makeStrategy()`), or `undefined` when the run must skip: locked, keyless, a `dead` credential verdict,
  an `exhausted` quota verdict, or no model. The model is the default tier's variable (`LLM_MODEL`), else the active
  profile's default tier, else the host's `defaultModel` (a slug, or a function of the provider and its base URL that
  answers `undefined` for a provider with no safe default). Verdicts fail open: an absent or unrecognized one reads
  `unchecked` and never vetoes. Every skip past the lock is logged. `makeLiveStrategy()` /
  `liveStrategyBinding()` build inside an open gate (and throw when nothing resolves — the gate is wrong);
  `liveDecisionStrategyFromEnv()` answers the decision backend, pinned by `LLM_DECISION_PROVIDER` (a pin naming a
  strategy that is not registered throws, listing the registered ones), with no veto of its own (pair it with
  `liveStrategyFromEnv` in the gate). The built strategy is wrapped by
  `decorateLlmLiveStrategyAuthFailures`: a `401` / `403` is rethrown naming the key's variable, never the key.

  | Field | Default var | Meaning |
  |---|---|---|
  | `unlock` | `LLM_LIVE_SPECS` | Opts the billed lane in (`1` / `true`). |
  | `skipCredentialProbe` | `LLM_LIVE_SPECS_SKIP_CREDENTIAL_PROBE` | Runs without the credential probe, clearing a stale credential verdict. |
  | `skipQuotaProbe` | `LLM_LIVE_SPECS_SKIP_QUOTA_PROBE` | Runs without the quota read, clearing a stale quota verdict. |
  | `credentialVerdict` | `LLM_CREDENTIAL_VERDICT` | `live` / `dead` / `unchecked`, stamped by the setup. |
  | `credentialDetail` | `LLM_CREDENTIAL_DETAIL` | The provider's own words behind a `dead` verdict. |
  | `quotaVerdict` | `LLM_QUOTA_VERDICT` | `ok` / `exhausted` / `unchecked`, stamped by the setup. |
  | `quotaDetail` | `LLM_QUOTA_DETAIL` | The measured headroom line. |
  | `quotaMaxUsed` | `LLM_QUOTA_MAX_USED` | The 0–1 ceiling of the tightest quota window (a percent like `90` is ignored). |

- **The setup gate.** `lane.makeGlobalSetup()` is a vitest `globalSetup`; it runs once in the main process, so what it
  writes reaches every worker. Locked, it strips every provider key (the env defaults, the `apiKeyEnv`s in
  `modelConfig.base`, and `extraProviderKeyNames`) and does nothing else — no file read, no request; pass
  `hermetic: false` to keep them. Unlocked, it resolves first (a malformed models file or an unknown profile throws
  before anything is billed), logs the lane once, probes every keyed provider's credential and reads its quota, and
  stamps both verdicts. A skip flag deletes that half's stale verdict instead. Every switch is parsed with
  `isEnvFlagEnabled` from `@dereekb/util` (`1` / `true`, trimmed, any case). Every lane value — the switches, the
  stamped verdicts and details, and the quota ceiling — is read through `/node`'s `firstLlmEnvValue`: trimmed, and a
  blank variable is unset. In this repo `LLM_LIVE_SPECS` is an Nx test input (`liveSpecFlags` in `nx.json`), so toggling it never replays a cached run; a host repo declares its own. The verdict
  codecs (`llmCredentialVerdictFromEnv`, `toLlmQuotaVerdictEnv`, …) and `parseLlmQuotaMaxUsed` are exported for hosts
  that wire their own.
- **A/B regression gate.** `computeLlmAbRegressionVerdict({ controlHits, controlTrials, treatmentHits, treatmentTrials })`
  runs a one-sided Fisher exact test at `LLM_AB_REGRESSION_ALPHA` (0.05). A raw count comparison's false-positive rate
  climbs toward 50% as trials grow; this one stays under alpha. It only looks for the treatment arm being worse:
  `regressed: false` means "not shown to regress", never "shown equivalent".

```ts
// llm.live.lane.ts — the host's one lane
import { makeLlmLiveLane } from '@dereekb/llm/test';

export const LIVE_LANE = makeLlmLiveLane({
  schema,
  adapters,
  modelConfig: { defaultPath: join(homedir(), '.my-app', 'models.json'), base: BUILT_IN_MODEL_CONFIG },
  defaultModel: ({ baseUrl }) => (baseUrl === DEFAULT_LLM_OPENAI_BASE_URL ? undefined : 'vendor/model-flash'),
  label: 'my-app'
});

// vitest.llm-live-setup.mts
export default LIVE_LANE.makeGlobalSetup();

// vitest.config.mts — test: { globalSetup: ['./vitest.llm-live-setup.mts'] }

// summarize.llm.spec.ts
const LIVE = LIVE_LANE.liveStrategyFromEnv();

describe.skipIf(LIVE == null)('summarize (live)', () => {
  it('should summarize', async () => {
    const strategy = LIVE_LANE.makeLiveStrategy();
    // ...
  });
});
```
