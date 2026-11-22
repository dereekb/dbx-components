---
name: llm
description: "@dereekb/llm in dbx-components — the framework-free, provider-agnostic LLM layer (strategies, model config and routing, adapters, prompt assembly, replies, the dispatcher and retry ladder, call records, the decision lane) and its eight entries. Fetch it when editing or importing `@dereekb/llm*`, writing an llm spec, or wiring a host (Node or Nest). Covers where each entry lives, the rules an edit must keep, where a spec may live, how to test without billing, and where moved names live now. Triggers on: 'dereekb/llm', 'makeLlmDispatcher', 'defineLlmCapability', 'makeLlmStrategyRegistry', 'makeLlmAdapterRegistry', 'makeLlmStrategiesFromEnv', 'resolveLlmProvidersFromEnv', 'makeLlmTieredPromptTemplateResolver', 'composeLlmCapabilityPrompt', 'toLlmCallLogPayload', 'makeLlmScriptedStrategy', 'defineLlmDecision', 'LlmDecisionStrategy', 'makeLlmCraftPromptContributor'."
---

# @dereekb/llm

## What it is

`packages/llm` publishes one npm package with eight entries. The nx projects:

| Entry | nx project | Browser-safe | Source |
|---|---|---|---|
| `@dereekb/llm` (root), `/decision`, `/craft` | `llm` | yes | `packages/llm/src` (`index.ts`, `decision.ts`, `craft.ts`) |
| `@dereekb/llm/openai` | `llm-openai` | yes (SDK lazy) | `packages/llm/openai` |
| `@dereekb/llm/openrouter` | `llm-openrouter` | yes | `packages/llm/openrouter` |
| `@dereekb/llm/zenmux` | `llm-zenmux` | yes | `packages/llm/zenmux` |
| `@dereekb/llm/node` | `llm-node` | no (Node only) | `packages/llm/node` |
| `@dereekb/llm/test` | `llm-test` | no (test infra) | `packages/llm/test` |

- `packages/llm/README.md` — the quick start, the entry table, and one `## Entries` section per entry (purpose,
  browser-safe, peers, main exports, guide).
- `packages/llm/docs/*.md` — the long-form guides (strategy, model-config, adapters, prompt, craft, replies,
  dispatcher, records, decision, openai, openrouter, zenmux, node, browser, test, utilities). Read the guide before changing
  the code it covers.
- `/craft` is OPT-IN: the root does not export it, and no core module imports it.
- npm reads only the root manifest's peers: `@dereekb/util`, `@dereekb/model`, `arktype`, and the optional `openai`.

## Start here

- **Define a capability and dispatch it:** the README's `## Quick start`, pinned by
  `packages/llm/src/llm.readme.example.spec.ts`.
- **A Node host from env + `models.json` to a dispatcher:** `docs/node.md` `## A complete Node host`, pinned by
  `packages/llm/test/src/lib/llm.test.node.host.example.spec.ts`.
- **A Nest host:** `docs/node.md` `## Nest hosts`.
- **A browser host:** `docs/browser.md`.

Change an example and its spec together; each spec mirrors its doc statement for statement.

## Rules when editing `packages/llm`

- Browser entries (root, `/decision`, `/craft`, `/openai`, `/openrouter`, `/zenmux`) import no `node:` module and
  never read `process`. Hosts pass configuration in; only `/node` reads the environment or the file system. Lint
  (`llmEntryBoundaryConfig` in `packages/llm/eslint.config.mjs`) and the `types: []` builds enforce it.
- The `openai` SDK is reached only through `/openai`'s boundary module, as `import type` or a lazy `import()`.
  `/openrouter` reaches it by importing `/openai`; the edge is one-way.
- No llm source or spec imports `@dereekb/openrouter*`.
- Sibling entries take decision names from the root (`@dereekb/llm`), not `@dereekb/llm/decision`.
- Craft is a leaf: no core module imports `/craft`.
- The chat transports send no SDK retry (injected clients included); the dispatcher owns retry.
- Hosts persist `toLlmCallLogPayload(record)`, the flat row, never the in-memory record.
- Never edit the golden replica spec (`src/lib/prompt/llm.prompt.assembly.golden.spec.ts`) or the row pins
  (`src/lib/dispatch/llm.dispatcher.rows.pin.spec.ts`, `src/lib/record/llm.call.payload.spec.ts`,
  `llm.call.payload.roundtrip.spec.ts`) to make a change green. A prompt-byte change is its own deliberate commit.
- Commit as `feat(llm): …` / `fix(llm): …` / `docs(llm): …`. Never add a `BREAKING CHANGE:` footer.
- Every symbol a doc names must exist and be exported from the entry the doc names.

## Where a spec can live

Each entry's eslint config applies its import bans to specs too.

| Project | May import | May not import |
|---|---|---|
| `llm` (root) | its own modules (relatively), `@dereekb/llm/test` | `/node`, any provider entry (a project cycle) |
| `llm-node` | `@dereekb/llm` | `/test`, any provider entry |
| `llm-test` | `@dereekb/llm`, `@dereekb/llm/node`, its own modules | `/openai`, `/openrouter`, `/zenmux` |
| `llm-openai` / `llm-openrouter` / `llm-zenmux` | `@dereekb/llm`, `@dereekb/llm/test` | `/node` |

A spec needing `/node` and the `/test` fakes goes in `llm-test`. Nothing can combine `/node` with a provider entry's
adapters: stand an inline adapter in for them (see the Node host example spec).

## Testing

- Spec fakes come from `@dereekb/llm/test` (scripted and tape strategies, the fetch, chat-client, adapter,
  dispatcher and System One wire fakes, the decision answer builders).
- Live specs run only behind `LLM_LIVE_SPECS` / `OPENROUTER_LIVE_SPECS` (`nx.json` `liveSpecFlags`), through
  `describeIfEnvFlag` (`@dereekb/util/test`) or `isEnvFlagEnabled` (`@dereekb/util`). Never run a billed spec without
  the owner's say-so.
- Commands: `dbx-claude-test` for `llm`, `llm-openai`, `llm-openrouter`, `llm-zenmux`, `llm-node` and `llm-test`
  (plus `openrouter` / `openrouter-firebase` when shared decision types move); `dbx-claude-build` for `llm`;
  `dbx-claude-lint-run`.

## Where things live now

- Abort and transport classification: `@dereekb/util/fetch` (`classifyFetchError`, `isFetchAbortError`,
  `isFetchNetworkError`). llm keeps `classifyLlmError`.
- The A/B regression gate: `@dereekb/util`'s `abRegressionVerdict` — not `/test`.
- Generic field checks: `@dereekb/model` (`assertObjectKeys`, `parseArktypeFieldsWithMessages`).
- `toBase64DataUrl`, `asFiniteNumber` and `joinKeyValuePairs`: `@dereekb/util`.
- `@dereekb/openrouter/decision`'s names are deprecated aliases of `@dereekb/llm/decision`'s.
- Decision strategy kinds: `openrouter-decisions` and `zenmux-systemone`.
- `parseLlmQuotaMaxUsed`: the root, beside `evaluateLlmQuotaGate` — not `/test`.
- The default reply envelope key is `value`.
- The craft judge rides the contributor: `makeLlmCraftPromptContributor({ …, judge: makeLlmCraftJudge(…) })`.

## Not the same thing

llm's `LlmPromptTemplate` / `LlmResolvedPromptTemplate` (role-keyed prompt text for one slot of the prompt assembly)
are not `@dereekb/openrouter`'s `OpenRouterResolvedPrompt` (a stored, versioned request) or
`OpenRouterResolvedPromptTemplate` (a message template's script half). Different concepts, deliberately not converged.

## Nest

There is no Nest module for llm. A Nest host passes nothing: `/node` and Nest's `ConfigService` both read
`process.env`. See `docs/node.md` `## Nest hosts`.
