/**
 * **Reconcile a run's logged LLM spend against what the provider actually BILLED.**
 *
 * A logged `llm_call`'s `usage.cost` is whatever the provider said synchronously; on ZenMux that is the pre-discount
 * LIST amount (`costBasis: 'list'`), an upper bound a ledger renders `<=`. This fold asks a {@link LlmCallBillReader}
 * for each call's bill by its generation id and reports list vs billed, per model and in total, so a developer
 * budgeting the next billed round reads the real figure instead of a 2× one.
 *
 * Read-only by design: it returns a reconciliation and writes nothing. Pending reads (the bill lags the call by
 * minutes) and failed ones are COUNTED, never folded as zero, so a half-reconciled run says so.
 */

import { type AbortSignalRef, asFiniteNumber, compareStringsByCodeUnit, type DollarAmount, type Maybe, type PercentDecimal, type Count } from '@dereekb/util';
import type { LlmCallLogPayloadBase } from '../record/llm.call.payload';
import type { LlmCallBillRead, LlmCallBillReader } from '../strategy/llm.call.bill';
import { formatLlmUsageCost } from './llm.usage.cost';
import { type LlmProviderStatusProviderId } from '../strategy/llm.provider.status';
import { type LlmGenerationId, type LlmModelId } from '../model/llm.value';

/**
 * How many bill reads run at once by default — a small pool, because a gateway's limit on these reads is unknown and a
 * reconciliation is never in a hurry.
 */
export const DEFAULT_LLM_BILL_RECONCILE_CONCURRENCY: Count = 4;

/**
 * The most failure / pending details a reconciliation keeps (the counts stay exact).
 */
export const LLM_BILL_RECONCILE_MAX_DETAILS: Count = 10;

/**
 * The label the markdown renders for the bucket of calls with no recorded model (the row whose `model` is
 * `undefined`). The rows sort by this label, so the bucket keeps its place among the rendered rows.
 */
const UNKNOWN_MODEL_BUCKET = '(unknown model)';

/**
 * One reconciled slice — a model, or the whole run.
 */
export interface LlmBillReconcileCell {
  /**
   * Calls with a generation id that were asked about.
   */
  readonly calls: Count;
  /**
   * Calls whose bill was read.
   */
  readonly billedCalls: Count;
  /**
   * The logged (synchronous) cost summed over the BILLED calls — the figure the bill is compared against.
   */
  readonly logged: DollarAmount;
  /**
   * The bills summed over the billed calls.
   */
  readonly billed: DollarAmount;
}

/**
 * One served model's reconciled slice.
 */
export interface LlmBillReconcileModelRow {
  /**
   * The served model, or `undefined` for the one bucket of calls that recorded none (rendered as `'(unknown model)'`
   * by {@link renderLlmBillReconciliationMarkdown}).
   */
  readonly model: Maybe<LlmModelId>;
  /**
   * The model's reconciled slice.
   */
  readonly cell: LlmBillReconcileCell;
}

/**
 * One pending or failed read, verbatim.
 */
export interface LlmBillReconcileDetail {
  /**
   * The generation id that was asked about.
   */
  readonly generationId: LlmGenerationId;
  /**
   * `pending` (re-run later) or `failed` (waiting will not fix it).
   */
  readonly status: 'pending' | 'failed';
  /**
   * The reader's detail.
   */
  readonly detail: string;
}

/**
 * The reconciliation of one run's calls.
 */
export interface LlmBillReconciliation {
  /**
   * The billing provider asked ({@link LlmCallBillReader.providerId}).
   */
  readonly providerId: LlmProviderStatusProviderId;
  /**
   * The run total.
   */
  readonly total: LlmBillReconcileCell;
  /**
   * One cell per served model, model-sorted.
   */
  readonly byModel: ReadonlyArray<LlmBillReconcileModelRow>;
  /**
   * Calls whose bill is not there YET (re-run in a few minutes).
   */
  readonly pending: Count;
  /**
   * Calls whose read failed for a reason waiting will not fix.
   */
  readonly failed: Count;
  /**
   * Calls in scope that carried no generation id, so could not be asked about at all.
   */
  readonly withoutGenerationId: Count;
  /**
   * The first few pending / failed reads ({@link LLM_BILL_RECONCILE_MAX_DETAILS}), verbatim.
   */
  readonly details: ReadonlyArray<LlmBillReconcileDetail>;
}

/**
 * Config for {@link reconcileLlmCallBills}.
 */
export interface ReconcileLlmCallBillsConfig extends AbortSignalRef {
  /**
   * The logged `llm_call` payloads to reconcile (the caller has already chosen which).
   */
  readonly calls: ReadonlyArray<Pick<LlmCallLogPayloadBase, 'generationId' | 'model' | 'usage'>>;
  /**
   * The bill reader.
   */
  readonly reader: LlmCallBillReader;
  /**
   * How many reads run at once; defaults to {@link DEFAULT_LLM_BILL_RECONCILE_CONCURRENCY}.
   */
  readonly concurrency?: Count;
}

/**
 * A mutable cell accumulator.
 */
interface MutableCell {
  calls: Count;
  billedCalls: Count;
  logged: number;
  billed: number;
}

/**
 * Read every call's bill (bounded concurrency) and fold list vs billed.
 *
 * Only calls with a non-empty generation id are asked about; the rest count toward `withoutGenerationId`. A small
 * worker pool pulls the reads in order and stops pulling once `signal` aborts; an unread slot counts as `pending` with
 * the detail `'not read (cancelled)'`. Pending and failed reads are counted but never folded into either sum.
 *
 * @param config - The calls, the reader, and the optional concurrency / cancellation.
 * @returns The reconciliation.
 *
 * @example
 * ```ts
 * const reconciliation = await reconcileLlmCallBills({ calls: payloads, reader: zenmuxBillReader });
 * console.log(renderLlmBillReconciliationMarkdown(reconciliation, runId));
 * ```
 */
export async function reconcileLlmCallBills(config: ReconcileLlmCallBillsConfig): Promise<LlmBillReconciliation> {
  const asked = config.calls.filter((call) => call.generationId != null && call.generationId.length > 0);
  const concurrency = Math.max(1, Math.floor(config.concurrency ?? DEFAULT_LLM_BILL_RECONCILE_CONCURRENCY));
  const reads: Maybe<LlmCallBillRead>[] = Array.from({ length: asked.length });
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < asked.length && config.signal?.aborted !== true) {
      const index = next;
      next += 1;
      reads[index] = await config.reader.read(asked[index].generationId as string, config.signal == null ? undefined : { signal: config.signal });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, asked.length) }, () => worker()));

  const total: MutableCell = { calls: 0, billedCalls: 0, logged: 0, billed: 0 };
  const byModel = new Map<Maybe<LlmModelId>, MutableCell>();
  const details: LlmBillReconcileDetail[] = [];
  let pending = 0;
  let failed = 0;

  asked.forEach((call, index) => {
    const model = call.model ?? undefined;
    const cell = byModel.get(model) ?? { calls: 0, billedCalls: 0, logged: 0, billed: 0 };
    byModel.set(model, cell);
    cell.calls += 1;
    total.calls += 1;
    // An unread slot is a cancelled read: it counts as pending (nothing is known, and re-running answers it).
    const read: LlmCallBillRead = reads[index] ?? { status: 'pending', generationId: call.generationId as string, detail: 'not read (cancelled)' };

    if (read.status === 'billed') {
      const logged = asFiniteNumber(call.usage?.cost) ?? 0;
      cell.billedCalls += 1;
      cell.logged += logged;
      cell.billed += read.bill.billed;
      total.billedCalls += 1;
      total.logged += logged;
      total.billed += read.bill.billed;
    } else {
      if (read.status === 'pending') {
        pending += 1;
      } else {
        failed += 1;
      }

      if (details.length < LLM_BILL_RECONCILE_MAX_DETAILS) {
        details.push({ generationId: read.generationId, status: read.status, detail: read.detail });
      }
    }
  });

  return {
    providerId: config.reader.providerId,
    total: { ...total },
    byModel: Array.from(byModel.entries())
      .sort(([a], [b]) => compareStringsByCodeUnit(a ?? UNKNOWN_MODEL_BUCKET, b ?? UNKNOWN_MODEL_BUCKET))
      .map(([model, cell]) => ({ model, cell: { ...cell } })),
    pending,
    failed,
    withoutGenerationId: config.calls.length - asked.length,
    details
  };
}

/**
 * The billed share of the logged figure (`billed / logged`), or `undefined` when nothing logged was billed. It may
 * exceed 1: a billed call with no logged cost adds to `billed` but nothing to `logged`.
 *
 * @param cell - The reconciled slice.
 * @returns The ratio.
 *
 * @example
 * ```ts
 * computeLlmBilledShare(reconciliation.total); // e.g. 0.5 when the bill is half the list figure
 * ```
 */
export function computeLlmBilledShare(cell: LlmBillReconcileCell): Maybe<PercentDecimal> {
  return cell.billedCalls > 0 && cell.logged > 0 ? cell.billed / cell.logged : undefined;
}

/**
 * Render a reconciliation as markdown — the run totals, one row per model, and the pending / failed reads.
 *
 * @param reconciliation - The reconciliation.
 * @param sessionId - The run / session it covers (the heading).
 * @returns The markdown.
 *
 * @example
 * ```ts
 * const markdown = renderLlmBillReconciliationMarkdown(await reconcileLlmCallBills({ calls, reader }), runId);
 * ```
 */
export function renderLlmBillReconciliationMarkdown(reconciliation: LlmBillReconciliation, sessionId: string): string {
  const money = (value: DollarAmount): string => formatLlmUsageCost({ cost: value, calls: 1, partial: false });
  const share = (cell: LlmBillReconcileCell): string => {
    const ratio = computeLlmBilledShare(cell);
    return ratio == null ? 'n/a' : `${(ratio * 100).toFixed(1)}%`;
  };
  const { total } = reconciliation;
  const lines: string[] = [`## Billed vs logged LLM spend (${reconciliation.providerId}, session ${sessionId})`];

  if (total.calls === 0) {
    lines.push(`- No reconcilable calls in scope (${reconciliation.withoutGenerationId} call(s) carried no generation id).`);
  } else {
    lines.push(
      `- **Billed:** ${money(total.billed)} over ${total.billedCalls} of ${total.calls} call(s) · **logged (list) for the same calls:** ${money(total.logged)} · **billed share:** ${share(total)}`,
      '',
      '| model | calls | billed calls | logged | billed | billed share |',
      '|---|---|---|---|---|---|',
      ...reconciliation.byModel.map(({ model, cell }) => `| ${model ?? UNKNOWN_MODEL_BUCKET} | ${cell.calls} | ${cell.billedCalls} | ${money(cell.logged)} | ${money(cell.billed)} | ${share(cell)} |`)
    );
  }

  if (reconciliation.pending > 0) {
    lines.push('', `- _${reconciliation.pending} call(s) not billed yet (a call bills minutes after it is made): re-run to fold them in._`);
  }

  if (reconciliation.failed > 0) {
    lines.push(`- ⚠️ ${reconciliation.failed} read(s) failed; the totals above exclude them.`);
  }

  if (reconciliation.details.length > 0) {
    lines.push(...reconciliation.details.map((entry) => `  - \`${entry.generationId}\` ${entry.status}: ${entry.detail}`));
  }

  if (reconciliation.withoutGenerationId > 0 && total.calls > 0) {
    lines.push(`- _${reconciliation.withoutGenerationId} call(s) in scope carried no generation id and could not be asked about._`);
  }

  return lines.join('\n');
}
