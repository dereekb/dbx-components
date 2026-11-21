# Craft notes

Entry: `@dereekb/llm/craft` (opt-in; the root does not export it) · [← @dereekb/llm](../README.md)

Craft is the opt-in `@dereekb/llm/craft` entry: the root does not export it.

A craft note is authored know-how about a target (a page type, a reply channel) that a contributor places, verbatim, in
the `craft` slot of the prompts written for it. Code composes no English around a note. Notes come from ordered tiers,
are matched against the request's site, are optionally judged by one decision call, and are budgeted.

- **Notes.** A markdown file with a frontmatter block: `id` (`^[a-z0-9][a-z0-9-]{1,63}$`), `title`, `sites`, `where`,
  `ask`, `floor` (default 0.6), `unserved` (default `omit`), `priority` (default 4, 0–8) and `enabled`. The body is at
  most 1,500 characters (UTF-16 code units; `DEFAULT_LLM_CRAFT_NOTE_MAX_CHARS`, overridable by the registry's
  `noteMaxChars`) and is never truncated. The frontmatter is read by `@dereekb/util` `parseMarkdownFrontmatter`: bare,
  double-quoted (JSON) and single-quoted scalars, `[a, b]` and `- item` lists, one level of nesting, and comments, and
  every refusal names its line. Craft adds the required fence, the schema and the cross-field rules.
  `parseLlmCraftNote` / `parseLlmCraftNoteSet`.
- **Sites.** `makeLlmCraftSiteRegistry({ sites })` declares each kind's facts (`closed` / `open` / `boolean`), its
  free-text inputs and its limits (`LlmCraftSiteLimits`): `maxNotes` 4 notes, `maxChars` 3,000 body characters,
  `judgeMax` 8 judged notes and `judgeInputMax` 600 characters per judged input, each overridable per registry and per
  site. Characters are UTF-16 code units; a note past `maxChars` is cut `max-bytes` (the stored reason's name). `llmCraftNoteUnknownWhereValues` names a `where` value your vocabulary cannot
  produce, for an authoring check.
- **Tiers.** Lowest precedence first; a higher tier shadows by id, and `enabled: false` is a tombstone. A tier is a
  static array or a per-request reader. `makeLlmCraftNoteRowReader` parses stored rows, memoized, and a tombstone row
  hides its id whatever text it kept.
- **Selection.** AND across `where` keys, OR within a list, and a missing fact never matches; then the host guard; rank
  (priority, then specificity, then id); `judgeMax`; the floor and the unserved posture; the budget.
  `selectLlmCraftNotes` selects in one step when the verdicts are known.
- **Judge.** `makeLlmCraftJudge({ sites, dispatcher, available, onUnavailable, swallow })` asks one Noul question per
  asked note (its `ask` verbatim). Its state is only the named inputs, clipped. `dispatcher` is a value or a getter read
  on every call — a getter is the usual case, since the judge rides the contributor of the very dispatcher it asks,
  which is built after it. `available(params)` and `onUnavailable(params)` see the call's `LlmCraftJudgeParams` (the
  dispatch `request`, the site `kind`, the `asked` notes and the `inputs`), so one judge can gate per call. It makes at
  most one call per dispatch, under the request's capability, and a fault or a closed gate answers nothing (each note
  takes its `unserved` posture). The call record is stamped `{ craft: { asked, kept } }` under decision
  `CraftNoteSelect`.
- **Contributor.** `makeLlmCraftPromptContributor({ sites, tiers, guard, judge, headings, slot, enabled })` asks its
  `judge` about the judged notes (no judge: each takes its `unserved` posture), gives each group one heading, puts the
  stable group on the cache prefix and the judged group after it as volatile, and records every cut on the call's
  `supplements`. A per-request tier that fails to parse logs one `craft-note-invalid` breadcrumb per file.
- **Building blocks.** For an explain view or an authoring tool: `mergeLlmCraftNoteTiers`, `resolveLlmCraftCandidates`
  then `settleLlmCraftNotes` (or `selectLlmCraftNotes` with known verdicts), `toLlmCraftContributions`,
  `readLlmCraftNoteGroup` and `isLlmCraftNoteKept` (the one keep rule: a verdict at or above the note's floor).

A note file, `apparel-plain.md`:

```md
---
id: apparel-plain
title: Plain apparel pages
sites: [product-page]
where:
  category: [apparel]
ask: "`brief` asks for a garment with no logo or print."
unserved: include
---
Name the fabric and the cut first. Never describe a logo the brief did not ask for.
```

The registry, the tiers, the judge and a judged site:

```ts
import { makeLlmCraftPromptContributor, makeLlmCraftJudge, makeLlmCraftNoteRowReader, makeLlmCraftSiteRegistry } from '@dereekb/llm/craft';

const sites = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open' }, inputs: ['brief'] },
    'support-reply': { facts: { channel: 'closed' }, inputs: ['message'], limits: { maxChars: 2400 } }
  }
});
const readRows = makeLlmCraftNoteRowReader({ tier: 'workspace', sites });

// the judge asks the dispatcher the contributor rides, built below — hence the getter
const judge = makeLlmCraftJudge<ShopRequest>({ sites, dispatcher: () => dispatcher, available: ({ request }) => request.craftJudge !== 'off' });

const craft = makeLlmCraftPromptContributor<ShopRequest, ShopDescriptor>({
  sites,
  tiers: [BUILTIN_CRAFT_NOTES, machine.notes, ({ request }) => readRows(request.craftRows)],
  guard: ({ descriptor }) => descriptor?.traits?.customerFacing === true,
  judge
});

const dispatcher = makeLlmDispatcher({ …, contributors: [craft] });

const site = { kind: 'product-page', facts: { category: 'apparel', brand: 'acme' }, inputs: { brief } };
```
