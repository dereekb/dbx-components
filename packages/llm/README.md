# @dereekb/llm

A framework-free, provider-agnostic LLM layer: the transport contract every provider strategy implements, model and
provider configuration, prompt assembly with provenance, reply repair and validation, a dispatcher with a retry
ladder, usage accounting, and a decision lane for short structured answers. It has no Angular, Nest or Firebase
dependency, and its browser entries run unchanged in a browser, a worker or Node.

> **Status: under construction.** The entry points below are published now and fill in over the next releases. The
> API may change in any release until the prompt-building layer lands — pin an exact version meanwhile.

## Entry points

| Entry | Node | SDK | Purpose | Guide |
|---|---|---|---|---|
| `@dereekb/llm` | no | none | The strategy contract, call records, model and provider configuration, adapters, prompt assembly, reply repair and validation, the dispatcher and retry ladder, usage accounting, and utilities. | [Guides](#guides) |
| `@dereekb/llm/decision` | no | none | The decision lane: questions, the wire format and answer reader, confidence, the decision strategy contract and the System One transport (`makeLlmSystemOneDecisionStrategy`). Re-exported by the root entry from the same modules, so both share one copy. | [decision](docs/decision.md) |
| `@dereekb/llm/craft` | no | none | Craft notes: the note model and markdown parser, the site registry, selection, the judge and the craft prompt contributor. Opt-in: the root does not export it. | [craft](docs/craft.md) |
| `@dereekb/llm/openai` | no | `openai` (optional, lazy) | The OpenAI-compatible chat base (`makeLlmOpenAiCompatibleChatStrategy`), the OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter. | [openai](docs/openai.md) |
| `@dereekb/llm/openrouter` | no | `openai` (through `/openai`) | The OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the OpenRouter decision strategy and their adapters. | [openrouter](docs/openrouter.md) |
| `@dereekb/llm/zenmux` | no | none (`fetch`) | ZenMux constants and cost basis, the decision route on the core System One transport, the quota-status source and the bill reader. | [zenmux](docs/zenmux.md) |
| `@dereekb/llm/node` | yes | none | Model-config file IO, environment variables to provider configs, the craft-notes folder loader and the craft markdown to TypeScript compiler. | [node](docs/node.md) |
| `@dereekb/llm/test` | test infra | none | Tape replay, scripted completion and decision strategies, the decision answer builders (`makeLlmDecisionChoiceAnswer`, …), the fakes (fetch seam, OpenAI-compatible chat client, completion adapter, dispatcher, `/systemone` wire), and the billed-lane test factories. | [test](docs/test.md) |

## Browser safety

The root, `/decision`, `/craft`, `/openai`, `/openrouter` and `/zenmux` entries are browser-safe:

- They import no `node:` module or Node builtin and never read `process`. Hosts pass configuration (API keys, base
  URLs, model lists) in; nothing is read from the environment. Reading the environment or the file system is the job
  of `/node`.
- No core module imports craft (lint pins it), so a host that never imports `/craft` never loads it.
- A browser network failure (Chromium's `Failed to fetch`, Firefox's `NetworkError when attempting to fetch
  resource.`, Safari's `Load failed`) is classified like undici's `fetch failed`: transient.
- `openai` is the only SDK peer, and it is **optional**: it is loaded lazily from `/openai`'s single boundary module,
  so importing an entry never loads it. Install it only for a chat strategy that uses it. `/openrouter` loads no SDK
  of its own: its chat strategy reaches `openai` by importing `/openai`, and its decision strategy is a plain `fetch`
  over the core System One transport.
- The browser entries have one sibling edge, `/openrouter` → `/openai`, and it is one-way: `/openai` imports no other
  provider entry. Lint pins both directions.
- The required peers are `@dereekb/util` (its `/fetch` entry included), `@dereekb/model` (the JSON-Schema export;
  framework-free and browser-safe) and `arktype`.
- Every network read takes `@dereekb/util/fetch`'s `ConfiguredFetch` (default: the global `fetch`, read at call time,
  via `resolveLlmFetch`) and reads each body once with `readFetchJsonText`.

These rules are enforced, not just documented:

- Lint: `llmEntryBoundaryConfig` in `packages/llm/eslint.config.mjs`, applied per entry. Node builtins are banned by
  `import-x/no-nodejs-modules` and `process` by `no-restricted-globals` in every browser entry's sources; the `openai`
  SDK is legal only in `/openai`'s boundary module, and there only as `import type` or a lazy `import()`; no entry
  (specs included) imports `@dereekb/openrouter`; each entry carries its own sibling and `/decision` rules; no library
  source imports a test runner; and craft is a leaf (no core module imports it).
- One runtime spec per entry (`*.isolation.spec.ts`) loads it with the SDK ids watched and fails if either is
  evaluated (`itShouldLoadWithoutEvaluating` from `@dereekb/util/test`).
- The browser entries compile with `types: []`, so a Node API or `process` reference fails the build's typecheck;
  `/test` compiles with `types: ["node"]`, so a vitest global in its sources fails its typecheck.

## Guides

The guides live in `docs/` and ship with the package. In reading order:

1. [Strategy contract](docs/strategy.md) — the transport contract every provider strategy implements: request in, completion out, usage, quota and credential probes.
2. [Model configuration and routing](docs/model-config.md) — the model config file shape, overlays and resolution, and the routing rules that move a capability to another model.
3. [Adapters](docs/adapters.md) — the adapter registry that turns configured providers into strategies, decision routes, metering and bills.
4. [Prompt building](docs/prompt.md) — capabilities, slot layouts, contributors, live context and templates.
5. [Craft notes](docs/craft.md) — `@dereekb/llm/craft`: the note model, the site registry, selection, the judge and the craft contributor.
6. [Replies](docs/replies.md) — reading, repair, schema validation and the critique policy.
7. [Dispatcher, retry and lanes](docs/dispatcher.md) — `makeLlmDispatcher`, its stages, the bounded retry ladder and the fast-fix, critique and decision lanes.
8. [Call records, readers and reconcile](docs/records.md) — what a dispatcher records and a host persists, the readers, the ledger and the spend math.
9. [Decisions](docs/decision.md) — `@dereekb/llm/decision`: questions, the wire format, answers, decision strategies, and coming from `@dereekb/openrouter`.
10. Providers — [OpenAI-compatible chat](docs/openai.md) (`/openai`), [OpenRouter](docs/openrouter.md) (`/openrouter`) and [ZenMux](docs/zenmux.md) (`/zenmux`).
11. [Node host quick start](docs/node.md) — `@dereekb/llm/node`: the config file and environment reads, and the craft-notes loader and compiler.
12. [Test infrastructure](docs/test.md) — `@dereekb/llm/test`: tapes, scripted strategies, the fakes and the billed-lane factories.
13. [Utilities](docs/utilities.md) — the semantic type aliases the API is typed with, and where the SHA-256 helpers live.
