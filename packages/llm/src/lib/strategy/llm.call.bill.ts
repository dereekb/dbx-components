/**
 * The PROVIDER-NEUTRAL per-call BILL contract — "what did this one call actually bill?", asked after the fact by the
 * call's generation id.
 *
 * It exists because a provider's synchronous `usage.cost` is not always the bill: ZenMux's is its pre-discount LIST
 * amount (`LlmUsage.costBasis: 'list'`), and on a discounted slug the bill is lower. The bill itself is
 * RETROSPECTIVE — on ZenMux it appears minutes after the call, behind a different credential — so it cannot ride the
 * completion. An {@link LlmCallBillReader} answers it later, and a reconciliation folds the reads over a session's
 * calls.
 *
 * The vocabulary lives here and the provider mapping lives in a provider entry (the ZenMux bill reader), the same
 * split as provider status: a consumer of the reconciliation never learns which gateway answered.
 */

import { type AbortSignalRef, type DollarAmount } from '@dereekb/util';

/**
 * One call's bill, in USD.
 */
export interface LlmCallBill {
  /**
   * The provider generation id the bill was read for (`LlmCompletion.generationId`).
   */
  readonly generationId: string;
  /**
   * What the call BILLED — the truth the synchronous figure approximates.
   */
  readonly billed: DollarAmount;
  /**
   * The provider's pre-discount list amount for the same call, when it reported one.
   */
  readonly listed?: DollarAmount;
  /**
   * The discount the provider applied (`listed - billed`), when it reported one.
   */
  readonly discount?: DollarAmount;
}

/**
 * The outcome of one bill read. `pending` is not a failure: a call bills minutes after it is made, so a recent
 * generation id reads as not-yet-there, and re-reading later is the remedy. `failed` is a read that cannot succeed by
 * waiting (a refused credential, an unreachable gateway, an unreadable body).
 */
export type LlmCallBillRead = { readonly status: 'billed'; readonly bill: LlmCallBill } | { readonly status: 'pending'; readonly generationId: string; readonly detail: string } | { readonly status: 'failed'; readonly generationId: string; readonly detail: string };

/**
 * Optional external cancellation for a bill read.
 */
export interface LlmCallBillReadOptions extends AbortSignalRef {}

/**
 * Reads one call's bill by its generation id. Implementations never throw: every outcome is an
 * {@link LlmCallBillRead}, so one bad id cannot sink a session's reconciliation.
 */
export interface LlmCallBillReader {
  /**
   * The billing provider the reads come from (`'zenmux'`) — display + attribution only.
   */
  readonly providerId: string;
  /**
   * Read one call's bill.
   *
   * @param generationId - The provider generation id.
   * @param options - Optional external cancellation.
   * @returns The outcome.
   */
  read(generationId: string, options?: LlmCallBillReadOptions): Promise<LlmCallBillRead>;
}
