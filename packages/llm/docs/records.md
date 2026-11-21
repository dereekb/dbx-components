# Call records, readers and reconcile

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

## Call records and observability

What a dispatcher records about each call, and the seams a host observes it through.

- **Errors.** `isLlmAbortError` (a client deadline or cancel; test it first, since a connection timeout is also
  transient by class), `classifyLlmError` (`transient | permanent | unknown`, through `@dereekb/util/fetch`'s
  `classifyFetchError` with `LLM_ERROR_CLASSIFICATION_CONFIG`, the `openai` SDK's class sets),
  `isRetryableLlmErrorClassification` (the one resend rule both lanes apply), `formatLlmErrorSummary` (one bounded log line
  naming what was thrown) and `LlmDispatchFaultError` / `isLlmDispatchFaultError` (the structured rejection of a send
  error the policy does not resend). The generic predicates (`isFetchAbortError`, `isFetchNetworkError`,
  `classifyFetchError`) live in `@dereekb/util/fetch`.
- **Decode failures.** The seven `LlmDecodeFailureClass`es, `classifyLlmDecodeFailure` (the failure family) and
  `classifyLlmReplyOutcome` (what the reply looked like), the finish-reason predicates (`isLlmLengthCappedFinish`,
  `isLlmCleanStopFinish`, `isLlmReasoningOnlyReply`), the three sentinels a dispatcher stamps on a synthesized reply
  (`LLM_TIMEOUT_FINISH_REASON`, `LLM_TRANSPORT_FINISH_REASON`, `LLM_UNRETRYABLE_FINISH_REASON`, together
  `LLM_SEND_FAILURE_FINISH_REASONS`) and the bounded excerpt helpers. Every failed send, on either lane, files a call
  row carrying one of the three, so a ledger counts send failures with `isLlmSendFailureFinishReason(row.finishReason)`
  — not by pairing start rows with call rows, which misses `__unretryable__`. The decode-failure payload's `cachePrefixHash` is the same 16-hex `llmPromptCacheHash` the call
  record carries, so the two join on one key: on a root dispatch it is the cache watch's hash of the stable prefix;
  a chained follow-up has no prefix, so it carries the hash of the whole prompt it sent.
- **Retry lever.** `chooseLlmRetryLever` picks the ONE thing the next attempt changes (budget, model, reasoning off /
  low, structured output off, or nothing, with the reason); `applyLlmRetryLever` applies it.
- **Call records.** `LlmCallRecord`, `LlmCallStartRecord`, `LlmDecodeFailureRecord` and their event-type tags. A host's
  own fields sit at the top level: pass them as `H`. `llmCallTelemetry` projects the per-call telemetry block. Every
  root dispatch's call record carries `cachePrefixHash` (the cache watch's hash of its stable prefix) at the top level,
  whether or not the call context times; `phases` keeps only the timing and the `promptChars` / `cachePrefixChars`
  sizes.
  `LlmCallLogPayload` is the persisted read-side view of a record, and `toLlmCallLogPayload` writes it (see
  [Readers, ledger and reconcile](#readers-ledger-and-reconcile)). Each placed or cut supplement row
  (`LlmCallSupplement`) carries a `hash` and a `bytes` size; `bytes` counts UTF-16 code units (`.length`), not bytes,
  and keeps its name because the row is persisted (as does the craft cut reason `'max-bytes'`).
- **Call context.** `makeLlmCallContext` times spans (`time` / `timeAsync`) into a nested profile of `child`
  contexts; `detached` starts a new root for work a context schedules but does not contain (it records one link to
  its origin and lands in the origin's `detachedProfiles`, never in `children`). Breadcrumbs (`diag`) and swallows go
  to the host's `onDiag` / `onSwallow` with the context's attribution, timing on or off. A child or detached
  attribution override merges over the parent's: an `undefined` field inherits the parent's value, a `null` overrides
  it. A dispatch reports its gaps through the dispatcher's `onGap`, not through the context. `noopLlmCallContext()` is
  the shared do-nothing context.
- **Taps.** `makeLlmDispatchTapRegistry` is a read-only observation seam: a tap that throws is counted in `health()`,
  never propagated. A tap may return any thenable; its rejection counts as an async failure. `makeLlmDispatchCollector` keeps every event.
- **Swallow sites.** `LlmSwallowSink`, the declaration vocabulary, `LLM_SWALLOW_SITES` (the library's declared
  fail-open catches) and `makeLlmSwallowSiteRegistry` to merge them with a host's own.

```ts
import { makeLlmCallContext, type LlmCallRecord } from '@dereekb/llm';

interface RequestAttribution {
  readonly requestId?: string;
  readonly tenantId?: string;
}

type AppCallRecord = LlmCallRecord<RequestAttribution>; // requestId / tenantId sit beside capability, prompt, result…

const context = makeLlmCallContext<RequestAttribution>({
  label: 'request',
  attribution: { requestId: 'r1' },
  onDiag: (record, attribution) => logger.debug({ ...attribution, ...record }),
  onSwallow: (site, cause, attribution) => logger.warn({ site, cause, ...attribution })
});

await context.child('attempt-1').timeAsync('complete', () => strategy.complete(request));
const profile = context.profile(); // nested spans, breadcrumbs and swallows
```

```ts
import { classifyLlmError, formatLlmErrorSummary } from '@dereekb/llm';

try {
  return await strategy.complete(request);
} catch (error) {
  if (classifyLlmError(error) === 'transient') {
    logger.info(`resending: ${formatLlmErrorSummary(error)}`);
  }

  throw error;
}
```

## Readers, ledger and reconcile

What a host persists for each call, the readers that read it back, and the math that turns the rows into spend.

- **Persisted payload.** `toLlmCallLogPayload(record, { keepIo, keepPhases })` writes `LlmCallLogPayload` for each
  `LlmCallRecord`: flat, every field optional except `capability`. It writes the library's keys only; a host places its
  own (`H`) beside them in the payload, or on its event envelope. `decodeOutcome` and `decodeStatus` are plain strings,
  since a logged row may name a value this build does not know. `text` is the MODEL's own bytes (the pre-repair text),
  so a tape replays what the model said and the deterministic repair re-runs on replay. What it writes, in order, and
  when (each key only when its value is present; a decision record's `stamp` keys lead):

  | payload key(s) | from the `LlmCallRecord` | kept when |
  |---|---|---|
  | `capability` | `record.capability` | always |
  | `promptSegments` | `record.segments` | `keepIo` |
  | `text` | `record.result.repair?.originalText ?? record.result.text` | `keepIo` |
  | `failedAttempts` | `record.failedAttempts` | `keepIo`, only when non-empty |
  | `strategyId`, `strategyKind`, `model`, `provider`, `usage`, `latencyMs`, `generationId`, `finishReason`, `repair` | `llmCallTelemetry(record.result)` | always |
  | `tier` | `record.tier` | always |
  | `schemaEnforced`, `attempts`, `decodeStatus`, `decodeOutcome`, `lengthCapped` | `record.result` | always |
  | `lever` | `record.result.valueJson` (the accepted reply value) | `keepIo` |
  | `validationErrors` | `record.result` | always |
  | `subject`, `decision` | the record's own fields | always |
  | `supplements` | `record.supplements` | only when non-empty |
  | `reasoningOff`, `estimatedPromptTokens`, `cachePrefixHash` | the record's own fields | always |
  | `phases` | `record.phases` | `keepPhases` |

- **Readers.** `readLlmCallPrompt`, `readLlmCallPromptSegments` and `readLlmCallFailedAttempts` take `unknown` and
  answer on a persisted payload, a flat-`prompt` one (no segments), or an in-memory `LlmCallRecord`; a malformed field reads
  as `undefined`, never a throw. Never dereference `promptSegments` yourself — a flat row has only `prompt`, and the
  prompt reader joins the segments when that is all there is. Every other reader, and the tape, reads the ROW: project
  a record with `toLlmCallLogPayload` first.
  - `formatLlmCallAttempts(event, { repliesPointer })` returns the one-line retry summary of an `llm_call` event
    (`attempts 2 retried · #1 schema-validation: … → reasoning-low`, with ` (<repliesPointer>)` appended when given),
    or `undefined` for a clean call and for any other event.
  - `isDecisionLlmCallRow(payload, kinds)` marks a decision-lane row: its lane (`strategyKind`, else `strategyId`) is
    in `kinds`, or it carries a `decision` id. Build `kinds` once with `readLlmDecisionStrategyKinds(adapters)`; rows this
    library's dispatcher wrote always carry `decision`, so `kinds` only matters for rows without one.
- **Usage cells.** `LlmUsageCell` (calls, prompt / completion / cached / reasoning tokens, cost, and
  `uncacheablePromptTokens` when above zero), with `toLlmUsageCell(usage, uncacheable)`, `addLlmUsageCells`,
  `accumulateLlmUsageCell(map, key, cell)` and `toLlmKeyedUsageCells(map)` (sorted by key). Cells are plain JSON: a
  persisted cell missing a field adds it as `0`, never `NaN`, and a re-fold of persisted cells is byte-stable.
- **Cost honesty.** `formatLlmUsageCost({ cost, calls, partial, listed })` renders `n/a` when no call priced itself,
  `>=$x` when some call did not (a lower bound), `<=$x` for list prices (an upper bound on the bill), `~$x` when both
  hold, and `$x` otherwise. A zero-call row is an exact `$0`. `resolveLlmUsageCostMarker` takes custom spellings (`≥`,
  `≤`), and `readLlmUsageCostFlags` maps a fold's `costPartial` / `costListed` flags onto a read.
- **Rates.** `computeLlmCacheHitRate` (cached over CACHEABLE prompt tokens, so decision-lane calls, which have no prompt
  cache, do not dilute it), `computeLlmReasoningShare`, `isUncacheableLlmCall(payload, kinds)` (a `decision` id, or a
  `strategyKind` in `kinds` — no `strategyId` fallback, unlike `isDecisionLlmCallRow`), `toLlmCapabilityCacheRows`,
  `renderLlmCacheHitLine({ cell, cachePartial, reasoningPartial })` and `formatLlmUsageRate`. `undefined` means
  "nothing to divide by", never 0%.
- **Bill reconcile.** `reconcileLlmCallBills({ calls, reader, concurrency?, signal? })` reads each call's bill through
  any `LlmCallBillReader` (e.g. `/zenmux`'s `makeLlmZenmuxGenerationBillReader`) and folds billed against logged cost per
  model. Pending and failed reads are counted and kept as details, never folded as zero; once `signal` aborts, no new
  read starts and each unread call is pending. A billed call whose row logged no cost (no `usage`, no `usage.cost`, or an
  unreadable one) is a hole, not a free call: its bill counts, the cell counts it in `loggedMissing`, the logged figure
  renders as a lower bound (`>=$x`, or `n/a` when no billed call logged a cost), and its billed share is `undefined`.
  `computeLlmBilledShare` gives billed / logged (a `PercentDecimal` that may exceed 1 when a bill is above its logged
  figure), and `renderLlmBillReconciliationMarkdown(reconciliation, sessionId)` renders the result. Calls with no
  recorded model fold into one `byModel` row whose `model` is `undefined`; the markdown labels it `(unknown model)`.

```ts
import {
  accumulateLlmUsageCell,
  addLlmUsageCells,
  emptyLlmUsageCell,
  formatLlmUsageCost,
  isUncacheableLlmCall,
  readLlmDecisionStrategyKinds,
  toLlmKeyedUsageCells,
  toLlmUsageCell,
  reconcileLlmCallBills,
  renderLlmBillReconciliationMarkdown,
  renderLlmCacheHitLine,
  type LlmCallLogPayload,
  type LlmUsageCell
} from '@dereekb/llm';

declare const rows: ReadonlyArray<LlmCallLogPayload>; // read back from the host's log

const decisionKinds = readLlmDecisionStrategyKinds(adapters);
const byModel = new Map<string, LlmUsageCell>();
let total = emptyLlmUsageCell();
let costPartial = false;

for (const row of rows) {
  const cell = toLlmUsageCell(row.usage, isUncacheableLlmCall(row, decisionKinds));
  total = addLlmUsageCells(total, cell);
  accumulateLlmUsageCell(byModel, row.model ?? '(unknown model)', cell);
  costPartial ||= row.usage?.cost == null;
}

for (const { key, cell } of toLlmKeyedUsageCells(byModel)) {
  console.log(`${key}: ${cell.calls} call(s) ${formatLlmUsageCost({ cost: cell.cost, calls: cell.calls, partial: costPartial })}`);
}

console.log(renderLlmCacheHitLine({ cell: total })); // cache 73.2% hit (6,000/8,200 prompt tok) · reasoning …

const reconciliation = await reconcileLlmCallBills({ calls: rows, reader: billReader });
console.log(renderLlmBillReconciliationMarkdown(reconciliation, 'session-1'));
```
