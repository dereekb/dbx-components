# Utilities

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

**Semantic types.** The public API types its numbers and strings with `@dereekb/util` semantic aliases where one
fits: `PercentDecimal` (decision probabilities and confidences, judge floors and verdicts, cache-hit and billed
shares), `Count` (calls, attempts, caps on counts), `IndexNumber` (0-based positions), `HexString` (prompt and
supplement hashes), `WebsiteUrl` / `WebsiteUrlWithPrefix` (base URLs), `MimeTypeWithoutParameters` (`LlmAttachment.mime`),
`Milliseconds`, `DollarAmount` and `DestroyFunction` (the detach `addTap` returns). llm adds two of its own in
`llm.value.ts`: `LlmTokenCount` (every token count and token cap) and `LlmGenerationId` (a provider's per-generation
id, the key a bill reader looks a call up by). They are aliases of `number` / `string`, so no value changes; 1-based
ordinals (`attempt`) and UTF-16 lengths whose name carries the unit (`rawLength`, `promptChars`) stay `number`.

The SHA-256 helpers live in `@dereekb/util`: `sha256Hex(text)` and `sha256HexPrefix(text, length)`. They are
synchronous and byte-identical to `node:crypto`'s `createHash('sha256').update(text, 'utf8').digest('hex')`. llm uses 16
hex chars for cache / call-row / supplement hashes (`llmPromptCacheHash`) and 12 for tapes (`hashLlmTapePrompt`).
