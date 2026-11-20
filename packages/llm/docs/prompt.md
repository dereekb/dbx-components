# Prompt building

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

The contracts a prompt is built against: the capability a call is made for, the slot layout that orders a prompt, the
contributor seam that supplements it, the live context a capability renders and the templates that supply authored
text, and the assembly that turns them into bytes. Around them sit the helpers a dispatcher and its host share: site
scopes, prompt handles and chains, a live-context token budget, a cache-prefix watch and two library contributors.

- **Capabilities.** An `LlmCapabilityDescriptor` is one capability's reply contract: its key, its reply protocol (`json`,
  `json-envelope` or `line`; `resolveLlmReplyProtocol` applies request, then descriptor, then the host default), its
  routing and output controls (it fits the routing compile and the model precedence as-is), the arktype schema and
  parser, the schema projections the output contract and `response_format` read, a frames policy keyed by slot id, and
  `traits` — the host's own flags, which the library never reads.
- **Dispatch.** `LlmDispatchRequest` is what a capability hands a dispatcher (the live-context renderer, overrides, a
  validator, a critic, a site, the parent call context, `meta`, an abort `signal`). `LlmDispatcher` dispatches it or
  prepares an `LlmPrompt`, which executes once and chains follow-ups onto the same thread (`ExecutedLlmPrompt`). Hosts
  extend the request and result types and pass them as `R` and `X`.
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
- **Templates.** An `LlmPromptTemplateResolver` returns a dispatch's templates per role (`reply-protocol`,
  `instructions`, `context`, the last split at `{{liveContext}}`) with their `source`, plus a by-key lookup for
  contributors. `makeLlmTieredPromptTemplateResolver` is the library's: tiers lowest first, the last definition of a key
  wins, a capability-scoped template beats a shared one. A host with another cascade supplies its own resolver.
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
  merge key by key). `withLlmPromptSite({ dispatcher, site })` returns a dispatcher whose every request,
  dispatched or prepared, carries the site — the request's own site winning, a later wrapper narrower than an earlier
  one. It never changes a byte; a contributor reading the site does.
- **Prompt handles.** `makeLlmPromptFactory({ runPromptRequest })` builds `LlmPrompt`s that execute once (a rejected
  execution is cached too) and chain follow-ups onto the same thread. A recorded reply is capped at 8,000 characters
  (`threadTurnMaxChars`), and a reply the run marks `degenerate` is recorded as a placeholder
  (`degenerateThreadPlaceholder`), so no later follow-up replays — and re-bills — a garbage turn.
- **Chains.** `makeLlmPromptChain({ lead })` is one chained-follow-up instance. `chain.dispatch({ dispatcher, request,
  previous })` fires a root, or chains a follow-up onto `previous` whose message is the lead plus only the live blocks
  that changed since the thread last saw them (unchanged ones are named, not re-sent). The instance holds what each
  handle sent, weakly; two instances never share it.
- **Budget.** `estimateLlmTokens` is `ceil(length / 4)`; `estimateLlmRequestPromptTokens` estimates a whole request
  (prompt, replayed thread, response schema). `budgetLlmLiveContextBlocks` keeps a live context under a token budget
  (default 12,000, less `reservedPrefixTokens`) by shrinking, then dropping, the lowest-priority blocks — never a
  `required` one, and never blocking a send. `toLlmBudgetTrimSummary` folds the trim report for a host's log.
- **Cache watch.** `makeLlmPromptCachePrefixWatch()` hashes each dispatch's cacheable prefix (16 hex chars of SHA-256)
  and compares it with the previous dispatch of the same capability and partition, naming the first segment — and its
  key — that moved, or the first one appended. It keeps digests, never prompt bytes.
- **Library contributors.** `makeLlmModelAddendumPromptContributor({ promptAddendumByModel })` places the resolved model's
  `promptAddendum` (from `llmModelPromptAddenda(config)`) in the `model-addendum` slot; `llmModelAddendumSegment` mints
  the same segment, and `restampLlmModelAddendum` swaps a captured prompt's addendum for another model's, placing it
  where the layout puts the addendum slot (before the first captured segment whose slot comes later, else last).
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

const scoped = withLlmPromptSite<RunRequest>({ dispatcher, site: { supply: { glossary: { text: 'Glossary: SKU = stock-keeping unit.', anchor: { after: 'heading' }, volatile: false } } } });
const chain = makeLlmPromptChain<RunRequest>();

const first = await chain.dispatch({ dispatcher: scoped, request: itemRequest(items[0]) });
// Replays `first`'s thread, then sends the lead plus only the live blocks that changed ("Unchanged …" names the rest).
const second = await chain.dispatch({ dispatcher: scoped, request: itemRequest(items[1]), previous: first });
```

A budgeted live context:

```ts
import { budgetLlmLiveContextBlocks, LLM_PROMPT_PREFIX_RESERVE_TOKENS } from '@dereekb/llm';

const budgeted = budgetLlmLiveContextBlocks({
  blocks: [
    { key: 'heading', text: '## Live context', priority: 9, required: true, volatile: false },
    { key: 'history', text: historyText, priority: 1, shrink: [recentHistoryText] }
  ],
  reservedPrefixTokens: LLM_PROMPT_PREFIX_RESERVE_TOKENS
});

const request = { capability: 'summarize', renderLiveContext: () => budgeted.blocks };
budgeted.trimmed; // [{ priority: 1, action: 'shrunk', savedTokens: … }] when the history had to shrink
```
