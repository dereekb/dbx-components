/**
 * `reconcileLlmCallBills` — logged (list) spend vs the provider's bills, per model and in total. A pending read is
 * counted and kept out of both sums; a failed one likewise; the figures are real billed calls.
 */

import { describe, it, expect } from 'vitest';
import type { DollarAmount, Maybe } from '@dereekb/util';
import type { LlmCallLogPayload } from '../record/llm.call.payload';
import type { LlmCallBillRead, LlmCallBillReader } from '../strategy/llm.call.bill';
import type { LlmUsage } from '../strategy/llm.usage';
import { computeLlmBilledShare, type LlmBillReconcileCell, reconcileLlmCallBills, renderLlmBillReconciliationMarkdown } from './llm.bill.reconcile';

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

/**
 * A logged list-price usage (ZenMux: the pre-discount list amount, `costBasis: 'list'`).
 *
 * @param cost - The logged cost.
 * @returns The usage.
 */
function listUsage(cost: DollarAmount): LlmUsage {
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost, costBasis: 'list' };
}

/**
 * A logged exact usage (OpenRouter: an exact, final cost, so no `costBasis`).
 *
 * @param cost - The logged cost.
 * @returns The usage.
 */
function exactUsage(cost: DollarAmount): LlmUsage {
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost };
}

/**
 * A usage with tokens only and no cost — the shape a bare endpoint reports.
 */
const NO_COST_USAGE: LlmUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

/**
 * The decision-lane keys of a ZenMux System One decision row, spread over a {@link rowOf} payload (`LLM_ZENMUX_DECISION_STRATEGY_KIND`, written as a literal
 * because core specs do not import the `/zenmux` entry).
 */
const DECISION_ROW: Partial<LlmCallLogPayload> = { decision: 'PickRow', strategyId: 'zenmux-decision', strategyKind: 'zenmux-systemone' };

/**
 * One logged `llm_call` payload with any usage (absent keys are omitted, as {@link call} does); spread
 * {@link DECISION_ROW} over it for a decision-lane row.
 *
 * @param generationId - The generation id (absent ⇒ none).
 * @param model - The served model.
 * @param usage - The logged usage (absent ⇒ none).
 * @returns The payload.
 */
function rowOf(generationId: Maybe<string>, model: string, usage: Maybe<LlmUsage>): LlmCallLogPayload {
  return { capability: 'summarize', model, ...(generationId == null ? {} : { generationId }), ...(usage == null ? {} : { usage }) };
}

/**
 * A billed read for one generation id.
 *
 * @param generationId - The generation id.
 * @param amount - The billed amount.
 * @returns The read.
 */
function billedRead(generationId: string, amount: DollarAmount): LlmCallBillRead {
  return { status: 'billed', bill: { generationId, billed: amount } };
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
    expect(reconciliation.total.loggedMissing).toBe(0);

    const flash = reconciliation.byModel.find((entry) => entry.model === 'vendor-b/model-flash')?.cell;

    expect(flash == null ? undefined : computeLlmBilledShare(flash)).toBeCloseTo(0.5, 9);
    expect(reconciliation.byModel.map((entry) => entry.model)).toEqual(['vendor-a/model-small', 'vendor-b/model-flash']);
    expect(reconciliation.details).toEqual([{ generationId: 'fresh', status: 'pending', detail: 'Not Found' }]);
  });

  it('orders the per-model rows by code unit — an uppercase vendor before a lowercase one', async () => {
    const { reader } = tableReader({
      a: { status: 'billed', bill: { generationId: 'a', billed: 0.1, listed: 0.1 } },
      b: { status: 'billed', bill: { generationId: 'b', billed: 0.1, listed: 0.1 } }
    });
    const reconciliation = await reconcileLlmCallBills({ calls: [call('a', 'vendor-a/model', 0.1), call('b', 'Vendor-B/model', 0.1)], reader });

    expect(reconciliation.byModel.map((entry) => entry.model)).toEqual(['Vendor-B/model', 'vendor-a/model']);
  });

  it('folds calls with no recorded model into one bucket whose row reads model undefined and renders as (unknown model)', async () => {
    const { reader } = tableReader({
      u1: { status: 'billed', bill: { generationId: 'u1', billed: 0.1, listed: 0.1 } },
      u2: { status: 'billed', bill: { generationId: 'u2', billed: 0.1, listed: 0.1 } },
      k1: { status: 'billed', bill: { generationId: 'k1', billed: 0.2, listed: 0.2 } }
    });
    const noModel = (generationId: string): LlmCallLogPayload => ({ ...call(generationId, 'unused', 0.1), model: undefined });
    const reconciliation = await reconcileLlmCallBills({ calls: [call('k1', 'vendor-a/model', 0.2), noModel('u1'), noModel('u2')], reader });

    expect(reconciliation.byModel.map((entry) => entry.model)).toEqual([undefined, 'vendor-a/model']);
    expect(reconciliation.byModel[0].cell.calls).toBe(2);

    const markdown = renderLlmBillReconciliationMarkdown(reconciliation, 'sess-3');
    expect(markdown).toMatch(/\| \(unknown model\) \| 2 \| 2 \| [^\n]*\n\| vendor-a\/model \| 1 \| 1 \|/);
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

  it('renders a reconciliation with no cost hole byte-for-byte (list and exact prices, pending, failed, id-less)', async () => {
    const { reader } = tableReader({
      a1: billedRead('a1', 0.25),
      b1: billedRead('b1', 0.2),
      b2: { status: 'failed', generationId: 'b2', detail: 'HTTP 403: Invalid API key' }
    });
    const reconciliation = await reconcileLlmCallBills({
      calls: [rowOf('a1', 'vendor-a/model', listUsage(0.5)), rowOf('a2', 'vendor-a/model', listUsage(0.5)), rowOf('b1', 'vendor-b/model', exactUsage(0.2)), rowOf('b2', 'vendor-b/model', listUsage(0.1)), rowOf(undefined, 'vendor-a/model', listUsage(0.5))],
      reader
    });

    expect(reconciliation.total.loggedMissing).toBe(0);
    expect(renderLlmBillReconciliationMarkdown(reconciliation, 'sess-pin')).toBe(
      [
        '## Billed vs logged LLM spend (zenmux, session sess-pin)',
        '- **Billed:** $0.450000 over 2 of 4 call(s) · **logged (list) for the same calls:** $0.700000 · **billed share:** 64.3%',
        '',
        '| model | calls | billed calls | logged | billed | billed share |',
        '|---|---|---|---|---|---|',
        '| vendor-a/model | 2 | 1 | $0.500000 | $0.250000 | 50.0% |',
        '| vendor-b/model | 2 | 1 | $0.200000 | $0.200000 | 100.0% |',
        '',
        '- _1 call(s) not billed yet (a call bills minutes after it is made): re-run to fold them in._',
        '- ⚠️ 1 read(s) failed; the totals above exclude them.',
        '  - `a2` pending: Not Found',
        '  - `b2` failed: HTTP 403: Invalid API key',
        '- _1 call(s) in scope carried no generation id and could not be asked about._'
      ].join('\n')
    );
  });

  describe('cost holes', () => {
    /**
     * One case of the cost-hole matrix: the calls, the reads, the expected total and the rendered lines.
     */
    interface CostHoleCase {
      readonly name: string;
      readonly calls: ReadonlyArray<LlmCallLogPayload>;
      readonly reads: Readonly<Record<string, LlmCallBillRead>>;
      readonly billedCalls: number;
      readonly loggedMissing: number;
      readonly logged: number;
      readonly billed: number;
      readonly share: Maybe<number>;
      readonly lines: ReadonlyArray<string>;
      readonly hole: boolean;
      readonly withoutGenerationId?: number;
    }

    const HOLE_NOTE = '- _1 billed call(s) logged no cost: the logged figures above leave them out, so the rows they fall in show no billed share._';
    const SINGLE_HOLE_LINES: ReadonlyArray<string> = ['- **Billed:** $0.250000 over 1 of 1 call(s) · **logged (list) for the same calls:** n/a · **billed share:** n/a', '| m | 1 | 1 | n/a | $0.250000 | n/a |', HOLE_NOTE];
    const ALL_LOGGED_LINES: ReadonlyArray<string> = ['- **Billed:** $0.500000 over 2 of 2 call(s) · **logged (list) for the same calls:** $1.000000 · **billed share:** 50.0%', '| m | 2 | 2 | $1.000000 | $0.500000 | 50.0% |'];

    const cases: ReadonlyArray<CostHoleCase> = [
      { name: 'A all logged, list price (ZenMux)', calls: [rowOf('g1', 'm', listUsage(0.5)), rowOf('g2', 'm', listUsage(0.5))], reads: { g1: billedRead('g1', 0.25), g2: billedRead('g2', 0.25) }, billedCalls: 2, loggedMissing: 0, logged: 1, billed: 0.5, share: 0.5, lines: ALL_LOGGED_LINES, hole: false },
      // The basis does not change the text: an exact cost renders exactly as a list one.
      { name: 'B all logged, exact cost (OpenRouter)', calls: [rowOf('g1', 'm', exactUsage(0.5)), rowOf('g2', 'm', exactUsage(0.5))], reads: { g1: billedRead('g1', 0.25), g2: billedRead('g2', 0.25) }, billedCalls: 2, loggedMissing: 0, logged: 1, billed: 0.5, share: 0.5, lines: ALL_LOGGED_LINES, hole: false },
      { name: 'C no usage on the row', calls: [rowOf('g1', 'm', undefined)], reads: { g1: billedRead('g1', 0.25) }, billedCalls: 1, loggedMissing: 1, logged: 0, billed: 0.25, share: undefined, lines: SINGLE_HOLE_LINES, hole: true },
      { name: 'D usage with no cost (bare endpoint)', calls: [rowOf('g1', 'm', NO_COST_USAGE)], reads: { g1: billedRead('g1', 0.25) }, billedCalls: 1, loggedMissing: 1, logged: 0, billed: 0.25, share: undefined, lines: SINGLE_HOLE_LINES, hole: true },
      { name: 'E unreadable cost', calls: [rowOf('g1', 'm', exactUsage(Number.NaN))], reads: { g1: billedRead('g1', 0.25) }, billedCalls: 1, loggedMissing: 1, logged: 0, billed: 0.25, share: undefined, lines: SINGLE_HOLE_LINES, hole: true },
      {
        name: 'F partial logged cost',
        calls: [rowOf('g1', 'm', listUsage(2)), rowOf('g2', 'm', NO_COST_USAGE)],
        reads: { g1: billedRead('g1', 1), g2: billedRead('g2', 1) },
        billedCalls: 2,
        loggedMissing: 1,
        logged: 2,
        billed: 2,
        share: undefined,
        lines: ['- **Billed:** $2.000000 over 2 of 2 call(s) · **logged (list) for the same calls:** >=$2.000000 · **billed share:** n/a', '| m | 2 | 2 | >=$2.000000 | $2.000000 | n/a |', HOLE_NOTE],
        hole: true
      },
      { name: 'H a measured $0 is not a hole', calls: [rowOf('g1', 'm', exactUsage(0))], reads: { g1: billedRead('g1', 0) }, billedCalls: 1, loggedMissing: 0, logged: 0, billed: 0, share: undefined, lines: ['| m | 1 | 1 | $0.000000 | $0.000000 | n/a |'], hole: false },
      {
        name: 'I a pending or failed call with no cost is not a hole',
        calls: [rowOf('p1', 'm', NO_COST_USAGE), rowOf('f1', 'm', NO_COST_USAGE)],
        reads: { f1: { status: 'failed', generationId: 'f1', detail: 'HTTP 403: Invalid API key' } },
        billedCalls: 0,
        loggedMissing: 0,
        logged: 0,
        billed: 0,
        share: undefined,
        lines: ['| m | 2 | 0 | $0.000000 | $0.000000 | n/a |'],
        hole: false
      },
      {
        name: 'J a call with no generation id and no cost is not a hole',
        calls: [rowOf('g1', 'm', listUsage(0.5)), rowOf(undefined, 'm', NO_COST_USAGE)],
        reads: { g1: billedRead('g1', 0.25) },
        billedCalls: 1,
        loggedMissing: 0,
        logged: 0.5,
        billed: 0.25,
        share: 0.5,
        lines: ['| m | 1 | 1 | $0.500000 | $0.250000 | 50.0% |'],
        hole: false,
        withoutGenerationId: 1
      },
      {
        name: 'K1 decision-lane row, no reported cost',
        calls: [{ ...rowOf('d1', 'typesafe/jev-1.14', NO_COST_USAGE), ...DECISION_ROW }],
        reads: { d1: billedRead('d1', 0.25) },
        billedCalls: 1,
        loggedMissing: 1,
        logged: 0,
        billed: 0.25,
        share: undefined,
        lines: ['| typesafe/jev-1.14 | 1 | 1 | n/a | $0.250000 | n/a |', HOLE_NOTE],
        hole: true
      },
      {
        name: 'K2 decision-lane row, list cost (ZenMux decision)',
        calls: [{ ...rowOf('d2', 'typesafe/jev-1.14', listUsage(0.5)), ...DECISION_ROW }],
        reads: { d2: billedRead('d2', 0.25) },
        billedCalls: 1,
        loggedMissing: 0,
        logged: 0.5,
        billed: 0.25,
        share: 0.5,
        lines: ['| typesafe/jev-1.14 | 1 | 1 | $0.500000 | $0.250000 | 50.0% |'],
        hole: false
      },
      // A host's JSON row can hold a string cost: the hole check uses the same coercion as the fold, so it is logged.
      {
        name: 'L numeric-string cost off a read-back row',
        calls: [rowOf('g1', 'm', { ...NO_COST_USAGE, cost: '0.5' as unknown as DollarAmount })],
        reads: { g1: billedRead('g1', 0.25) },
        billedCalls: 1,
        loggedMissing: 0,
        logged: 0.5,
        billed: 0.25,
        share: 0.5,
        lines: ['| m | 1 | 1 | $0.500000 | $0.250000 | 50.0% |'],
        hole: false
      }
    ];

    it.each(cases)('$name', async (testCase) => {
      const { reader } = tableReader(testCase.reads);
      const reconciliation = await reconcileLlmCallBills({ calls: testCase.calls, reader });
      const { total } = reconciliation;

      expect(total.billedCalls).toBe(testCase.billedCalls);
      expect(total.loggedMissing).toBe(testCase.loggedMissing);
      expect(total.logged).toBeCloseTo(testCase.logged, 9);
      expect(total.billed).toBeCloseTo(testCase.billed, 9);
      expect(reconciliation.withoutGenerationId).toBe(testCase.withoutGenerationId ?? 0);

      const share = computeLlmBilledShare(total);

      if (testCase.share == null) {
        expect(share).toBeUndefined();
      } else {
        expect(share).toBeCloseTo(testCase.share, 9);
      }

      const markdown = renderLlmBillReconciliationMarkdown(reconciliation, 'sess-matrix');
      testCase.lines.forEach((line) => expect(markdown).toContain(line));

      if (testCase.hole) {
        expect(markdown).toContain('billed call(s) logged no cost');
      } else {
        expect(markdown).not.toContain('billed call(s) logged no cost');
      }
    });

    it("renders a hole as a lower-bound logged figure, no share and one note, leaving the hole-free model's row unchanged", async () => {
      const { reader } = tableReader({ a1: billedRead('a1', 0.25), b1: billedRead('b1', 0.25) });
      const reconciliation = await reconcileLlmCallBills({ calls: [rowOf('a1', 'vendor-a/model', listUsage(0.5)), rowOf('b1', 'vendor-b/model', NO_COST_USAGE)], reader });

      expect(reconciliation.byModel.map((row) => row.cell.loggedMissing)).toEqual([0, 1]);

      const markdown = renderLlmBillReconciliationMarkdown(reconciliation, 'sess-hole');

      expect(markdown).toBe(
        [
          '## Billed vs logged LLM spend (zenmux, session sess-hole)',
          '- **Billed:** $0.500000 over 2 of 2 call(s) · **logged (list) for the same calls:** >=$0.500000 · **billed share:** n/a',
          '',
          '| model | calls | billed calls | logged | billed | billed share |',
          '|---|---|---|---|---|---|',
          '| vendor-a/model | 1 | 1 | $0.500000 | $0.250000 | 50.0% |',
          '| vendor-b/model | 1 | 1 | n/a | $0.250000 | n/a |',
          '',
          HOLE_NOTE
        ].join('\n')
      );

      // The hole-free model's row is the same text it renders with no hole anywhere.
      const alone = renderLlmBillReconciliationMarkdown(await reconcileLlmCallBills({ calls: [rowOf('a1', 'vendor-a/model', listUsage(0.5))], reader: tableReader({ a1: billedRead('a1', 0.25) }).reader }), 'sess-alone');
      const vendorARow = (text: string): Maybe<string> => text.split('\n').find((line) => line.startsWith('| vendor-a/model |'));

      expect(vendorARow(markdown)).toBe(vendorARow(alone));
    });
  });

  describe('computeLlmBilledShare()', () => {
    it.each<{ readonly label: string; readonly cell: LlmBillReconcileCell; readonly expected: Maybe<number> }>([
      { label: 'a comparable pair', cell: { calls: 2, billedCalls: 2, logged: 1, billed: 0.5, loggedMissing: 0 }, expected: 0.5 },
      { label: 'a billed call that logged no cost', cell: { calls: 2, billedCalls: 2, logged: 1, billed: 0.5, loggedMissing: 1 }, expected: undefined },
      { label: 'nothing logged', cell: { calls: 1, billedCalls: 1, logged: 0, billed: 0.25, loggedMissing: 0 }, expected: undefined },
      { label: 'nothing billed', cell: { calls: 1, billedCalls: 0, logged: 0, billed: 0, loggedMissing: 0 }, expected: undefined },
      { label: 'a bill above its logged figure (the share may exceed 1)', cell: { calls: 1, billedCalls: 1, logged: 0.1, billed: 0.2, loggedMissing: 0 }, expected: 2 }
    ])('returns $expected for $label', ({ cell, expected }) => {
      const share = computeLlmBilledShare(cell);

      if (expected == null) {
        expect(share).toBeUndefined();
      } else {
        expect(share).toBeCloseTo(expected, 9);
      }
    });
  });
});
