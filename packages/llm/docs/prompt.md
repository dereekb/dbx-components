# Prompt building

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

The contracts a prompt is built against: the capability a call is made for, the slot layout that orders a prompt, the
contributor seam that supplements it, the live context a capability renders and the templates that supply authored
text, and the assembly that turns them into bytes. Around them sit the helpers a dispatcher and its host share: site
scopes, prompt handles and chains, a live-context token budget, a cache-prefix watch and two library contributors.

- **Capabilities.** An `LlmCapabilityDescriptor` is one capability's reply contract: its key, its reply protocol (`json`,
  `json-envelope` or `line`; `resolveLlmReplyProtocol` applies request, then descriptor, then the host default), its
  routing and output controls (it fits the routing compile and the model precedence as-is), the arktype schema and
  parser, the schema projections the output contract and `response_format` read, and two fields the library carries but
  never reads: `frames`, a frames policy keyed by slot id for the host's own frame contributors, and `traits`, the
  host's own flags.
- **Dispatch.** `LlmDispatchRequest` is what a capability hands a dispatcher (the live-context renderer, overrides, a
  validator, a critic, a site, the parent call context, `meta`, an abort `signal`). `LlmDispatcher` dispatches it or
  prepares an `LlmPrompt`, which executes once and chains follow-ups onto the same thread (`ExecutedLlmPrompt`), and
  resumes a stored thread as an `LlmPromptThreadHead`. Hosts extend the request and result types and pass them as `R`
  and `X`.
- **Reply checks.** `LlmValueValidator` (sync: is it well-formed?), `LlmCritic` (async and billed: is it good? never
  throws) and `LlmReplyFastFixer` (one cheap call that repairs a mangled JSON reply from the scorer's `JsonRepairShape`,
  from `@dereekb/util`).
  Reading, repair, schema projection and the critique policy have their own guide, [Replies](replies.md).
- **Layout.** `LlmPromptLayout` is an ordered array of slots `{ id, role, occupancy, separator, lastSeparator? }`. The
  array is the prompt order; a role only says what fills a slot. `defineLlmPromptLayout` validates one, and
  `DEFAULT_LLM_PROMPT_LAYOUT` names every slot after its role. The dispatcher's `correction` and `follow-up` roles are
  declared like any other: the slot names the segment id, and its `lastSeparator ?? separator` is appended after the
  piece (`''` in the default layout). `findLlmPromptSlotByRole` and `readLlmPromptSlotSeparator` read a layout the same
  way the assembly does.
- **Contributors.** An `LlmPromptContributor` reads the request, descriptor, model and templates once per dispatch and
  offers contributions for the slots it declares. `resolveLlmPromptContributions` runs contributors in registry order;
  `assertLlmPromptContributionOccupancy` fails loud on an undeclared slot, an assembly-owned slot or a second
  contribution to a single slot; `mergeLlmLiveContextContributions` places live-slot contributions among the
  capability's blocks at their anchors; `toLlmPromptSupplements` builds a call record's `supplements` rows.
- **Live context.** `LlmLiveContextBlock`s are keyed sections (`llmLiveContextBlock`, rows blocks; a fact row is
  `@dereekb/util`'s `joinKeyValuePairs`).
  `orderLlmLiveContextBlocks` sorts by a sparse rank table with a key tiebreak, so any input order sends the same
  bytes. The tiebreak compares keys by UTF-16 code unit (`@dereekb/util` `compareStringsByCodeUnit`), never the host's
  locale, so every host sends the same bytes (`Beta` before `alpha`). Craft-note selection, usage rows and the bill
  reconciliation order by code unit too. `llmChainedFollowUpBody` re-sends only what changed since the thread's last turn.
  A block is volatile unless it says `volatile: false`. That is a stability claim, not a cache guarantee: the cache
  prefix ends at the first volatile segment (`splitLlmPromptCacheSegments`), so a stable block lands on the prefix
  only when everything before it is stable too. Order the live context slow to fast.
- **Templates.** An `LlmPromptTemplateResolver` returns a dispatch's templates per role (`reply-protocol`,
  `instructions`, `context`, the last split at `{{liveContext}}`) with their `source`, plus a by-key lookup for
  contributors. `makeLlmTieredPromptTemplateResolver` is the library's: tiers lowest first, the last definition of a key
  wins, a capability-scoped template beats a shared one. A host with another cascade supplies its own resolver. Not
  `@dereekb/openrouter`'s resolved prompts or message templates — see the README's
  [Not @dereekb/openrouter's prompts](../README.md#not-dereekbopenrouters-prompts).
- **Assembly.** `composeLlmCapabilityPrompt` is the one prompt pipeline: it renders the request's live context, looks
  the descriptor up through the injected `descriptorOf`, awaits the template resolver once, resolves the contributors in
  registry order and assembles. `assembleLlmCapabilityPrompt` is its synchronous last step (resolved templates and
  contributions in, segments out) for previews and goldens. The layout drives it: each slot, in order, holds what its
  role says — contributions (frames, the model addendum, craft notes, in contribution order), the reply protocol (the
  `reply-protocol` template, or the built-in line protocol for a `line` call), at most one amendment (must-resolve, for a
  JSON protocol and a `mustResolve` descriptor; a clause only some calls carry is the host's, contributed from a `frame`
  slot it declares next to the amendment slot — its segment id may name that slot, so the bytes read as one amendment),
  the `instructions` template, the `context` template split at its first `{{liveContext}}`, the output contract (JSON protocols with a
  descriptor) and the live blocks with the live slot's contributions merged at their anchors. Each piece is closed by
  its slot's separator; bytes with no slot to land in fail loud. The result is `{ segments, prompt, cacheSegments }`, the
  last two derived from the segments. An empty live context still places one empty volatile segment, and an all-stable
  one forces its last block volatile, so the cache split never moves past the live context.
- **Output contract.** `renderLlmOutputContract` renders the contract schema (the descriptor's `contractSchemaHint()`,
  or a per-call override) as one bullet per field — name, type label, required or optional, the field's description —
  expanding an array of objects into an indented block where that delivers prose.
- **Texts.** The line protocol, the must-resolve amendment and the contract's intro and footer have library defaults
  (`DEFAULT_LLM_PROMPT_ASSEMBLY_TEXTS`); a host passes its own exact text through `texts`, and one call its own footer
  through `contractFooter`.
- **Sites.** `mergeLlmPromptSite` merges two sites, the narrower winning (its `kind` replaces; facts, inputs and supply
  merge key by key). `withLlmPromptSite({ dispatcher, site })` returns a dispatcher whose `dispatch`,
  `preparePrompt` and `resumePrompt` requests carry the site — the request's own site winning, a later wrapper
  narrower than an earlier one. `decide` passes through unchanged, because a decision request has no site. It never
  changes a byte; a contributor reading the site does.
- **Prompt handles.** `makeLlmPromptFactory({ runPromptRequest })` builds `LlmPrompt`s that execute once (a rejected
  execution is cached too) and chain follow-ups onto the same thread. The recorded `assistant` turn is the text the
  run returned: the repaired text when a repair landed, cut at `threadTurnMaxChars`
  (`DEFAULT_LLM_THREAD_TURN_MAX_CHARS`, 8,000) with `LLM_THREAD_TURN_TRUNCATION_MARKER` appended. Only a run that
  marks its reply `degenerate` records `degenerateThreadPlaceholder` (`DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER`)
  instead. `makeLlmDispatcher` marks a validated dispatch whose replies failed to decode and never recovered, so no
  later follow-up replays (and re-bills) a garbage turn. A single-shot call's reply is always recorded as returned.
- **Resuming.** The library stores nothing: the host saves a head's `thread` under its own message id, and the
  factory's `resume({ request, thread })` (`LlmDispatcher.resumePrompt`) rebuilds an `LlmPromptThreadHead` from it in a
  later process. Follow-ups chain onto that head exactly as onto the `ExecutedLlmPrompt` that recorded the thread, and
  send the same bytes. Resuming an earlier message's thread branches the conversation there. The root request is
  supplied again because follow-ups inherit its capability, model and host fields; its live context is never rendered.
  A thread must alternate `user` / `assistant` from `user` and end on a reply (`isLlmPromptResumableThread`); `resume`
  throws otherwise. A resumed thread replays as stored, untouched by the recording settings. See
  [Saving and resuming a chain](#saving-and-resuming-a-chain).
- **Chains.** `makeLlmPromptChain({ lead })` is one chained-follow-up instance. `chain.dispatch({ dispatcher, request,
  previous })` fires a root, or chains a follow-up onto `previous` whose message is the lead plus only the live blocks
  that changed since the thread last saw them (unchanged ones are named, not re-sent). The instance holds what each
  handle sent, weakly; two instances never share it. A resumed head has no held blocks, so the first item after it
  sends its whole live context. A follow-up takes only four things from the item's request: its live context (the
  capability's own render, so no contributed blocks), `validate`, `maxAttempts` and `responseSchemaHint`. Its
  capability, model or tier, site, attachments and critic are not used, and no contributor runs. The follow-up rides
  the root's thread, so only chain items that share the root's capability and framing.
- **Budget.** `estimateLlmTokens` is `ceil(length / 4)`; `estimateLlmRequestPromptTokens` estimates a whole request
  (prompt, replayed thread, response schema). `budgetLlmLiveContextBlocks` keeps a live context under a token budget
  (default 12,000, less `reservedPrefixTokens`) by shrinking, then dropping, the lowest-priority blocks — never a
  `required` one, and never blocking a send. `toLlmBudgetTrimSummary` folds the trim report for a host's log.
- **Cache watch.** `makeLlmPromptCachePrefixWatch()` hashes each dispatch's cacheable prefix (16 hex chars of SHA-256)
  and compares it with the previous dispatch of the same capability and partition, naming the first segment — and its
  key — that moved, or the first one appended. It keeps digests, never prompt bytes. The dispatcher stamps the hash on
  the call record as `cachePrefixHash` and reuses it for the decode-failure payload's `cachePrefixHash`. It keeps the
  baselines of the last `DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS` (1,000) (capability, partition) pairs,
  evicting the least recently used. Size it with `makeLlmPromptCachePrefixWatch({ maxPartitions })` (an
  `LlmPromptCachePrefixWatchConfig`; a positive integer, else a `RangeError`). A partition seen again after eviction
  reads as a first dispatch: its hash is still stamped, but it cannot file `prefix-changed`.
- **Library contributors.** `makeLlmModelAddendumPromptContributor({ promptAddendumByModel })` places the resolved model's
  `promptAddendum` (from `llmModelPromptAddenda(config)`) in the `model-addendum` slot; `llmModelAddendumSegment` mints
  the same segment, and `restampLlmModelAddendum` swaps a captured prompt's addendum for another model's, placing it
  where the layout puts the addendum slot (before the first captured segment whose slot comes later, else last).
  This contributor is the only way a slug's `promptAddendum` reaches a prompt: register it in the dispatcher's
  `contributors`.
  `makeLlmAnchoredBlockPromptContributor({ id, reason, blockOf })` places one block a scope supplied among the capability's
  live blocks, at its anchor. The craft contributor has its own guide, [Craft notes](craft.md).

A layout with a host frame slot, one contributor that fills it, and a live-slot contribution anchored among the
capability's blocks:

```ts
import { assertLlmPromptContributionOccupancy, type LlmPromptContributor, llmLiveContextBlock, llmLiveContextHeadingBlock, defineLlmPromptLayout, mergeLlmLiveContextContributions, resolveLlmPromptContributions } from '@dereekb/llm';
import { filterMaybeArrayValues } from '@dereekb/util';

const layout = defineLlmPromptLayout([
  { id: 'brand-voice', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'instructions', role: 'instructions', occupancy: 'single', separator: '\n\n' },
  { id: 'live', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' }
]);

const brandVoice: LlmPromptContributor = {
  id: 'brand-voice',
  slots: ['brand-voice', 'live'],
  resolve: ({ templates }) => ({
    contributions: [
      { contributor: 'brand-voice', slot: 'brand-voice', id: 'brand-voice', text: templates.byKey('brand-voice')?.text ?? 'Be warm.', origin: { kind: 'template' }, reason: 'every summarize call speaks in the brand voice' },
      { contributor: 'brand-voice', slot: 'live', id: 'live', key: 'glossary', text: 'Glossary: SKU = stock-keeping unit.', origin: { kind: 'live-context' }, reason: 'the site supplied a glossary', anchor: { after: 'heading' } }
    ]
  })
};

const blocks = filterMaybeArrayValues([llmLiveContextHeadingBlock(), llmLiveContextBlock({ key: 'subject', lines: ['Subject: a desk lamp'] })]);
const { contributions } = await resolveLlmPromptContributions([brandVoice], { request, descriptor, templates, liveBlockKeys: blocks.map((block) => block.key) });

assertLlmPromptContributionOccupancy(contributions, layout);
const live = mergeLlmLiveContextContributions({ blocks, contributions, slot: 'live' }); // heading, glossary, subject
```

The library's tiered template resolver over a `defaults` and an `app` tier:

```ts
import { makeLlmTieredPromptTemplateResolver } from '@dereekb/llm';

const templateResolver = makeLlmTieredPromptTemplateResolver({
  tiers: [
    { source: 'defaults', templates: [{ key: 'instructions', role: 'instructions', text: 'Summarize the input.' }] },
    { source: 'app', templates: [{ key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize in two sentences.' }] }
  ]
});

const templates = await templateResolver({ request: { capability: 'summarize', renderLiveContext: () => [] }, descriptor: undefined });
templates.roles.instructions?.source; // 'app'
```

A three-capability host composing a prompt: a `brand-voice` frame before the default slots, the tiered resolver above,
a `descriptorOf` over a `Map`, and the `brandVoice` contributor from the first example:

```ts
import { composeLlmCapabilityPrompt, DEFAULT_LLM_PROMPT_LAYOUT, type LlmCapabilityDescriptor, defineLlmPromptLayout } from '@dereekb/llm';

const layout = defineLlmPromptLayout([{ id: 'brand-voice', role: 'frame', occupancy: 'single', separator: '\n\n' }, ...DEFAULT_LLM_PROMPT_LAYOUT]);
const descriptors = new Map<string, LlmCapabilityDescriptor>([
  ['summarize', summarizeDescriptor],
  ['classify', classifyDescriptor],
  ['reply', replyDescriptor]
]);

const composed = await composeLlmCapabilityPrompt({
  request: { capability: 'summarize', renderLiveContext: () => blocks },
  layout,
  descriptorOf: (capability) => descriptors.get(capability),
  templateResolver,
  contributors: [brandVoice]
});

composed.prompt; // the bytes sent
composed.cacheSegments; // { cachePrefix, volatileSuffix } — the split never moves past the live context
```

The output contract on its own:

```ts
import { renderLlmOutputContract } from '@dereekb/llm';

renderLlmOutputContract({ schema: { type: 'object', properties: { summary: { type: 'string', description: 'two sentences' } }, required: ['summary'] } });
// ## Output contract
//
// Return a JSON object with these fields:
// - `summary` (string, required): two sentences
//
// Use these field names exactly, and leave out an optional field rather than invent a value for it.
```

A run scoped to a glossary, with an anchored contributor that places it and a chain over the run's items:

```ts
import { type LlmAnchoredBlock, makeLlmAnchoredBlockPromptContributor, type LlmDispatchRequest, type LlmPromptSite, makeLlmPromptChain, withLlmPromptSite } from '@dereekb/llm';

interface RunSupply {
  readonly glossary?: LlmAnchoredBlock;
}

interface RunRequest extends LlmDispatchRequest {
  readonly site?: LlmPromptSite<RunSupply>;
}

// Registered with the dispatcher's contributors.
const glossary = makeLlmAnchoredBlockPromptContributor<RunRequest>({ id: 'glossary', reason: 'the run supplied a glossary', blockOf: ({ request }) => request.site?.supply?.glossary });

const scoped = withLlmPromptSite<RunRequest>({ dispatcher, site: { supply: { glossary: { text: 'Glossary: SKU = stock-keeping unit.', anchor: { after: 'heading' }, volatile: false } } } }); // anchored after the stable heading, so it joins the cache prefix
const chain = makeLlmPromptChain<RunRequest>();

const first = await chain.dispatch({ dispatcher: scoped, request: itemRequest(items[0]) });
// Replays `first`'s thread, then sends the lead plus only the live blocks that changed. The site's glossary rode `first`'s prompt and is not re-sent.
const second = await chain.dispatch({ dispatcher: scoped, request: itemRequest(items[1]), previous: first });
```

A budgeted live context:

```ts
import { budgetLlmLiveContextBlocks, LLM_PROMPT_PREFIX_RESERVE_TOKENS } from '@dereekb/llm';

const budgeted = budgetLlmLiveContextBlocks({
  blocks: [
    { key: 'heading', text: '## Live context', priority: 9, required: true, volatile: false }, // the heading leads, so it stays on the prefix
    { key: 'history', text: historyText, priority: 1, shrink: [recentHistoryText] }
  ],
  reservedPrefixTokens: LLM_PROMPT_PREFIX_RESERVE_TOKENS
});

const request = { capability: 'summarize', renderLiveContext: () => budgeted.blocks };
budgeted.trimmed; // [{ priority: 1, action: 'shrunk', savedTokens: … }] when the history had to shrink
```

## Saving and resuming a chain

A chain lives on its in-memory handles. To send a message, stop, and follow up in a later process, store each
message's `thread` and resume from it. What a message needs stored:

- **The thread** — `executed.thread`, a `ReadonlyArray<LlmThreadTurn>`, oldest first:

  ```ts
  interface LlmThreadTurn {
    readonly role: LlmThreadRole; // 'user' | 'assistant'
    readonly content: string; // the exact text sent or received
    readonly cacheSegments?: LlmPromptCacheSegments; // { cachePrefix: string; volatileSuffix: string }
  }
  ```

  A `user` turn holds the final prompt sent (a retry's correction included). An `assistant` turn holds the reply as
  the run returned it (repaired when a repair landed), cut at `threadTurnMaxChars` (8,000 by default, ` […truncated
  for replay]` appended). On a validated dispatch whose replies failed to decode and never recovered, it holds
  `degenerateThreadPlaceholder` instead. It is strings throughout, so it stores in JSON or Firestore as-is. Each message's thread is the
  whole conversation up to that message, so any stored message can be resumed.
- **What rebuilds the root request** — its capability, any model or tier override, and the host fields. Follow-ups
  inherit these, so the resumed request must route as the original did; a different model forfeits the warm cache. The
  live context is never rendered on a resume (`() => []` is fine).

`cacheSegments` sits on the root turn only, and never changes the text: `cachePrefix + volatileSuffix === content`.
Only an `anthropic/` route over OpenRouter reads it, replaying the root turn in its original cache-breakpoint layout so
the resumed call can hit the provider's cache: the conversation's own entry while it is still alive, and the
capability's shared preamble whenever other calls keep it warm. Every other strategy drops it. Keeping it stores the
root prompt twice; dropping it costs at most a cache miss on an Anthropic model's first resumed follow-up.

```ts
import { isLlmPromptResumableThread, type LlmDispatchRequest } from '@dereekb/llm';

// The root request, built the same way in every process: same capability, same model, same host fields.
const rootRequest = (subjectId: string): LlmDispatchRequest => ({ capability: 'summarize', renderLiveContext: () => renderSubject(subjectId) });

// Process 1: send the first message, then store its thread under the host's own message id.
const first = await dispatcher.preparePrompt(rootRequest(subjectId)).execute();
await messages.set(firstMessageId, { subjectId, thread: first.thread });

// Process 2, later: load a message, resume it, follow up, and store the reply as a new message.
const stored = await messages.get(firstMessageId);

if (isLlmPromptResumableThread(stored.thread)) {
  const head = dispatcher.resumePrompt({ request: rootRequest(stored.subjectId), thread: stored.thread });
  const next = await head.followUp({ content: 'Now shorten it to one line.' }).execute();
  await messages.set(nextMessageId, { subjectId: stored.subjectId, thread: next.thread });
}
```

`messages` stands for the host's store. Resuming `firstMessageId` again later branches a second conversation from the
same point. A `makeLlmPromptChain` instance holds no blocks for a resumed head, so the first item after one sends its
whole live context.
