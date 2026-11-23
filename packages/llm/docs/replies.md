# Replies

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

What happens to a reply between the strategy and the capability: it is read per its reply protocol, repaired when it
nearly parses, validated against the capability's schema, and optionally judged by a billed critic. A capability
descriptor also carries the two schema projections the request and the prompt read.

- **Protocols and reading.** The decoded reply payload is the reply's **value**. `json`: the parsed object is the
  value, never unwrapped and never declined. `json-envelope`: `LlmReplyEnvelopeKeys` (default `value` /
  `answerable` / `rationale`; a host with its own value key passes it, e.g. `{ value: 'result', … }`); `answerable: false` declines,
  a hedged decline keeps its value, and a bare object reads as the value. `line`: `readLlmLineReplyValue` lifts the
  bare line into `{ line }`. `readLlmReply` classifies `value` / `declined` / `no-json` / `parse-error`; `readLlmReplyValue`
  is the thin wrapper and `readLlmReplyRationale` reads the rationale. The slicer is `@dereekb/util`
  `readJsonObjectFromText`: it tries the greedy `{…}` slice, then each balanced top-level object, and never invents a
  brace. An envelope host passes `llmReplyEnvelopeContractIntro(keys)` as its contract intro.
- **Repair.** `repairLlmReplyJson` / `scoreLlmReplyJson` walk a reply once and give one of four verdicts: `near-miss`
  (repaired), `mangled`, `truncated-looking` or `not-json` (below a score of 0.2). Ten deterministic ops (closers,
  commas, stray closers, control escapes, trailing prose, fences; a second pass escapes inner quotes). A reply that ends
  inside a string or after `:` / `,` / a key / an opener is never repaired. `llmReplyRepairFidelity` gates every repair:
  nothing invented, and at least 90% of the 12+-char content literals kept. The three are thin wrappers over
  `@dereekb/util` `repairJsonObjectText` / `scoreJsonObjectText` / `checkJsonRepairFidelity`; their `{ envelope }`
  option takes the coverage check over the balanced object under the envelope's value key (an unclosed or non-object one keeps
  the rest of the reply), and without it the whole reply is the payload. The dispatcher passes the call's reading
  envelope (`resolveLlmReplyReadingEnvelope`: the host's keys on `json-envelope`, none on `json`). The shape types are
  util's `JsonRepair*`.
- **Fast fix.** `makeLlmReplyFastFixer({ requestOf, metaOf })` makes one `RepairReplyJson` call
  (`maxAttempts: 1`), handed only the broken reply, the subject's schema and a one-line diagnosis. It answers `fixed`, or
  `missed` with `truncated` / `declined` / `unusable` / `fidelity` / `error`, and never throws. Its fidelity check runs
  over the subject's reading envelope (`subjectEnvelope` on the fixer input).
- **Nested reads.** The critic and the fixer read their nested call's DECODED payload (`readLlmDispatchResultReply`:
  the `valueJson` stamp, `declined` for an accepted result with none, `no-json` when dropped, the `json` reading of an
  unstamped result's text), so they follow the nested call's resolved protocol and the dispatcher's `replyEnvelope`. A
  host `resultOf` must keep `valueJson` / `decodeStatus`. The built-in judge and fixer descriptors set no protocol and
  inherit the host default, so a `line`-default host must give them a JSON protocol.
  `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`: a score of at least 0.5, at most 16,000 chars, one fix per dispatch.
- **Validation.** `makeLlmSchemaValueValidator(schema)` is a pure schema check: `true`, or `{ error }`, which re-asks. A
  schema-valid but unusable value is a legitimate "no decision", not a re-ask.
- **Schema projection.** `defineLlmCapability` builds `responseSchemaHint()` and `contractSchemaHint()` from
  `responseSchema` — or from `hintSchema` when set: the schema the model is SHOWN when it is not the one enforced (a
  strict wire shape over a tolerant `responseSchema` that every reply is still validated against; bound at definition,
  not carried on the descriptor). Each exports through `@dereekb/model` `arktypeToJsonSchemaForExport(schema, { strict: true })`: a
  `.narrow`ed or morphed schema projects its JSON base, and a type with no JSON form (`Date`, `symbol`, `bigint`, an
  `undefined` union arm) throws on first projection. Then `@dereekb/model` `toStrictJsonSchema`: `$schema` dropped,
  `additionalProperties: false` on every object, including inside tuples, `$defs` and records, described literal unions
  folded back to `enum`, union arm prose hoisted, and descriptions stripped from the `response_format` payload (they
  ride the output contract). Both hints are lazy and memoized; a projection that throws is not cached.
  `describeResponseSchemaHint` keeps the prose in the payload, per descriptor, default off.
  `hardenLlmResponseSchemaHint` (over `toStrictJsonSchema`) serves request-supplied hints, stripping their prose unless
  the dispatcher's own `describeResponseSchemaHint` is set (a host with one switch passes it to both); other
  projections, such as a tool's input schema, call `toStrictJsonSchema` directly.
- **Critique.** `compileLlmCritiquePolicy` (built on `compileLlmCapabilityRules`, with the judge excluded) is
  fail-loud (unknown capability or tag, no target, or the judge itself);
  a key match beats a tag match, and the first match wins. `resolveLlmCritiqueFields` gives `{}` unless a rule matches, so off is
  free. `makeLlmSemanticCritic` fails open with `critique-unusable` / `critique-error` breadcrumbs. `composeLlmCritics`
  runs critics in order and stops at the first rejection. The judge sees the goal, optional evidence, the subject's live
  context and the reply (both fenced as data), never the subject's instructions. `LlmCritiqueParams.signal` carries the
  subject's cancellation signal, and the semantic critic puts it on the judge request. Every attempt that passes `validate` is
  judged, and the judge request is itself validated with the default budget (`DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS`, 2).
  So a critiqued capability costs at least 2 calls and, in the worst case, about 3 × its `maxAttempts`, plus any bonus
  attempt or fast fix. Three recursion guards: the judge request carries no critic, the compile refuses the judge, and
  the dispatcher clamps `maxAttempts >= 1`.
- **Built-in capabilities.** `LLM_CRITIQUE_REPLY_DESCRIPTOR` / `LLM_REPAIR_REPLY_JSON_DESCRIPTOR` and their default
  templates `LLM_CRITIQUE_REPLY_TEMPLATE` / `LLM_REPAIR_REPLY_JSON_TEMPLATE`. Register the descriptors in your
  `descriptorOf`, add the templates as your lowest tier, and override with a higher tier or your own resolver. Spread a
  descriptor to add your tags, tier or traits. Missing, nothing throws, but both fail open and degrade: there is no
  output contract or must-resolve clause, the judge loses `response_format`, the caps fall to the defaults, and the
  instructions slot is empty.
- **Swallow sites.** `llm/reply-envelope.decode`, `llm/reply-repair.rebuilt-parse`, `llm/reply-repair.fast-fix` and
  `llm/critique-reply.judge`, all in `LLM_SWALLOW_SITES`.

```ts
import { compileLlmCritiquePolicy, defineLlmCapability, LLM_CRITIQUE_REPLY_CAPABILITY, LLM_CRITIQUE_REPLY_DESCRIPTOR, LLM_CRITIQUE_REPLY_TEMPLATE, LLM_REPAIR_REPLY_JSON_CAPABILITY, LLM_REPAIR_REPLY_JSON_DESCRIPTOR, LLM_REPAIR_REPLY_JSON_TEMPLATE, resolveLlmCritiqueFields, readLlmReplyValue, makeLlmSchemaValueValidator, type LlmCapabilityDescriptor, type LlmCritiqueBinding } from '@dereekb/llm';
import { type } from 'arktype';

const summarySchema = type({ summary: type('string').describe('two sentences, plain words') });
const SUMMARIZE = defineLlmCapability({ capability: 'summarize', tags: ['copy'], responseSchema: summarySchema, parseValue: (value) => {
  const out = summarySchema(value);
  return out instanceof type.errors ? undefined : out;
} });
const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = {
  summarize: SUMMARIZE,
  [LLM_CRITIQUE_REPLY_CAPABILITY]: LLM_CRITIQUE_REPLY_DESCRIPTOR,
  [LLM_REPAIR_REPLY_JSON_CAPABILITY]: { ...LLM_REPAIR_REPLY_JSON_DESCRIPTOR, tier: 'fast' }
}; // descriptorOf: (capability) => DESCRIPTORS[capability]
const templates = { source: 'llm', templates: [LLM_CRITIQUE_REPLY_TEMPLATE, LLM_REPAIR_REPLY_JSON_TEMPLATE] }; // the lowest tier

const binding: LlmCritiqueBinding = {
  policy: compileLlmCritiquePolicy({ critique: { rules: [{ tags: ['copy'], tier: 'fast', maxAttempts: 3 }] }, capabilities: Object.values(DESCRIPTORS) }),
  dispatch: (request) => dispatcher.dispatch(request)
};

const goal = 'The summary MUST name the product and its price.';
const result = await dispatcher.dispatch({
  capability: 'summarize',
  renderLiveContext,
  validate: makeLlmSchemaValueValidator(summarySchema),
  ...resolveLlmCritiqueFields({ binding, capability: 'summarize', goal })
});
const value = readLlmReplyValue(result.text);
```
