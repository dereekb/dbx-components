# @dereekb/llm

A framework-free, provider-agnostic LLM layer: the transport contract every provider strategy implements, model and
provider configuration, prompt assembly with provenance, reply repair and validation, a dispatcher with a retry
ladder, usage accounting, and a decision lane for short structured answers. It has no Angular, Nest or Firebase
dependency, and its browser entries run unchanged in a browser, a worker or Node.

> **Status: under construction.** The entry points below are published now and fill in over the next releases. The
> API may change in any release until the prompt-building layer lands — pin an exact version meanwhile.

## Entry points

| Entry | Node | SDK | Purpose |
|---|---|---|---|
| `@dereekb/llm` | no | none | The strategy contract and runner, call records, model and provider configuration, adapters, prompt assembly, reply repair and validation, the dispatcher and retry ladder, usage accounting, and utilities. |
| `@dereekb/llm/decision` | no | none | The decision lane: questions, the wire format and answer reader, confidence, and the decision strategy contract. Re-exported by the root entry from the same modules, so both share one copy. |
| `@dereekb/llm/openai` | no | `openai` (optional, lazy) | The OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter. |
| `@dereekb/llm/openrouter` | no | `openai` + `@openrouter/sdk` (optional, lazy) | The OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the OpenRouter decision strategy and their adapters. |
| `@dereekb/llm/zenmux` | no | none (`fetch`) | ZenMux constants and cost basis, the decision strategy, the quota-status source and the bill reader. |
| `@dereekb/llm/node` | yes | none | Model-config file IO, environment variables to provider configs, and the craft-folder loader. |
| `@dereekb/llm/test` | test infra | none | Tape replay, scripted completion and decision strategies, and the billed-lane test factories. |

## Browser safety

The root, `/decision`, `/openai`, `/openrouter` and `/zenmux` entries are browser-safe:

- They import no `node:` module or Node builtin and never read `process`. Hosts pass configuration (API keys, base
  URLs, model lists) in; nothing is read from the environment. Reading the environment or the file system is the job
  of `/node`.
- `openai` and `@openrouter/sdk` are **optional** peers. Each is loaded lazily from exactly one boundary module of the
  entry that needs it, so importing an entry never loads an SDK. Install an SDK only for the strategy that uses it.

These rules are enforced, not just documented:

- Each entry has an `*.isolation.spec.ts` that scans its own source for `node:` imports, `process` reads and SDK
  imports outside the boundary module, and loads the entry with the SDKs mocked to prove neither is evaluated. No
  entry may import `@dereekb/openrouter`.
- The browser entries compile with `types: []`, so a Node API or `process` reference fails the build's typecheck.

## Utilities

### sha256Hex

`sha256Hex(text)` returns the SHA-256 of a string's UTF-8 bytes as 64 lowercase hex characters. It is synchronous and
dependency-free, so it runs anywhere — no `node:crypto`, no WebCrypto promise.

It is byte-identical to `createHash('sha256').update(text, 'utf8').digest('hex')` from `node:crypto` for every
JavaScript string, including strings with lone surrogates: those are encoded as U+FFFD, the same WHATWG UTF-8 rule
Node applies, instead of throwing.

```ts
import { sha256Hex } from '@dereekb/llm';

const shortDigest = sha256Hex(promptText).slice(0, 16);
```
