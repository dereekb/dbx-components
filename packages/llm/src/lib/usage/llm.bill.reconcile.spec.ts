/**
 * `reconcileLlmCallBills` — logged (list) spend vs the provider's bills, per model and in total. A pending read is
 * counted and kept out of both sums; a failed one likewise; the figures are real billed calls.
 */

import { describe, it, expect } from 'vitest';
import type { LlmCallLogPayload } from '../record/llm.call.payload';
import type { LlmCallBillRead, LlmCallBillReader } from '../strategy/llm.call.bill';
import { llmBilledShareOf, reconcileLlmCallBills, renderLlmBillReconciliationMarkdown } from './llm.bill.reconcile';

/**
 * A reader answering from a fixed table (absent ⇒ pending), recording the peak number of reads in flight.
 *
 * @param table - Generation id → read.
 * @returns The reader, its in-flight peak and its read count.
 */
function tableReader(table: Readonly<Record<string, LlmCallBillRead>>): { readonly reader: LlmCallBillReader; readonly peak: () => number; readonly reads: () => number } {
  let inFlight = 0;
  let peak = 0;
  let reads = 0;
  const reader: LlmCallBillReader = {
    providerId: 'zenmux',
    async read(generationId) {
      reads += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return table[generationId] ?? { status: 'pending', generationId, detail: 'Not Found' };
    }
  };
  return { reader, peak: () => peak, reads: () => reads };
}

/**
 * One logged `llm_call` payload.
 *
 * @param generationId - The generation id (absent ⇒ none).
 * @param model - The served model.
 * @param cost - The logged cost.
 * @returns The payload.
 */
function call(generationId: string | undefined, model: string, cost: number): LlmCallLogPayload {
  return { capability: 'summarize', model, ...(generationId == null ? {} : { generationId }), usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost, costBasis: 'list' } };
}

describe('reconcileLlmCallBills', () => {
  it('folds billed vs logged per model, keeping pending and id-less calls out of the sums', async () => {
    const { reader } = tableReader({
      d1: { status: 'billed', bill: { generationId: 'd1', billed: 0.000252375, listed: 0.00050475, discount: 0.000252375 } },
      d2: { status: 'billed', bill: { generationId: 'd2', billed: 0.000098295, listed: 0.00019659 } },
      h1: { status: 'billed', bill: { generationId: 'h1', billed: 0.0003534, listed: 0.0003534 } }
    });
    const reconciliation = await reconcileLlmCallBills({
      calls: [call('d1', 'vendor-b/model-flash', 0.00050475), call('d2', 'vendor-b/model-flash', 0.00019659), call('h1', 'vendor-a/model-small', 0.0003534), call('fresh', 'vendor-a/model-small', 0.001), call(undefined, 'x', 0.5)],
      reader
    });

    expect(reconciliation.total.calls).toBe(4);
    expect(reconciliation.total.billedCalls).toBe(3);
    expect(reconciliation.pending).toBe(1);
    expect(reconciliation.failed).toBe(0);
    expect(reconciliation.withoutGenerationId).toBe(1);
    expect(reconciliation.total.billed).toBeCloseTo(0.00070407, 9);
    expect(reconciliation.total.logged).toBeCloseTo(0.00105474, 9);

    const flash = reconciliation.byModel.find((entry) => entry.model === 'vendor-b/model-flash')?.cell;

    expect(flash == null ? undefined : llmBilledShareOf(flash)).toBeCloseTo(0.5, 9);
    expect(reconciliation.byModel.map((entry) => entry.model)).toEqual(['vendor-a/model-small', 'vendor-b/model-flash']);
    expect(reconciliation.details).toEqual([{ generationId: 'fresh', status: 'pending', detail: 'Not Found' }]);
  });

  it('counts failed reads apart from pending ones', async () => {
    const { reader } = tableReader({ g: { status: 'failed', generationId: 'g', detail: 'HTTP 403: Invalid API key' } });
    const reconciliation = await reconcileLlmCallBills({ calls: [call('g', 'm', 0.1)], reader });

    expect(reconciliation.failed).toBe(1);
    expect(reconciliation.pending).toBe(0);
    expect(reconciliation.total.billed).toBe(0);
    expect(reconciliation.total.logged).toBe(0);
  });

  it('bounds the reads in flight by the concurrency', async () => {
    const tracked = tableReader({});
    await reconcileLlmCallBills({ calls: Array.from({ length: 9 }, (_, index) => call(`g${index}`, 'm', 0.1)), reader: tracked.reader, concurrency: 2 });

    expect(tracked.peak()).toBe(2);
  });

  it('renders the billed total, the per-model rows and the pending note', async () => {
    const { reader } = tableReader({ d1: { status: 'billed', bill: { generationId: 'd1', billed: 0.000252375 } } });
    const markdown = renderLlmBillReconciliationMarkdown(await reconcileLlmCallBills({ calls: [call('d1', 'vendor-b/model-flash', 0.00050475), call('fresh', 'vendor-b/model-flash', 0.1)], reader }), 'sess-1');

    expect(markdown).toContain('## Billed vs logged LLM spend (zenmux, session sess-1)');
    expect(markdown).toContain('**Billed:** $0.000252 over 1 of 2 call(s)');
    expect(markdown).toContain('| vendor-b/model-flash | 2 | 1 | $0.000505 | $0.000252 | 50.0% |');
    expect(markdown).toContain('1 call(s) not billed yet');
  });

  it('reads nothing once the signal has aborted, counting every call as a cancelled pending read', async () => {
    const tracked = tableReader({});
    const controller = new AbortController();
    controller.abort();
    const reconciliation = await reconcileLlmCallBills({ calls: [call('a', 'm', 0.1), call('b', 'm', 0.1)], reader: tracked.reader, signal: controller.signal });

    expect(tracked.reads()).toBe(0);
    expect(reconciliation.pending).toBe(2);
    expect(reconciliation.details.map((entry) => entry.detail)).toEqual(['not read (cancelled)', 'not read (cancelled)']);
  });

  it('counts an empty and an absent generation id as calls without one', async () => {
    const tracked = tableReader({});
    const reconciliation = await reconcileLlmCallBills({ calls: [call('', 'm', 0.1), call(undefined, 'm', 0.1)], reader: tracked.reader });

    expect(tracked.reads()).toBe(0);
    expect(reconciliation.withoutGenerationId).toBe(2);
    expect(reconciliation.total.calls).toBe(0);
  });

  it('renders the no-calls-in-scope line when nothing could be asked about', async () => {
    const { reader } = tableReader({});
    const markdown = renderLlmBillReconciliationMarkdown(await reconcileLlmCallBills({ calls: [call(undefined, 'm', 0.1)], reader }), 'sess-2');

    expect(markdown).toContain('- No reconcilable calls in scope (1 call(s) carried no generation id).');
  });
});
