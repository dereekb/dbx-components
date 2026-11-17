/**
 * The ZenMux per-call BILL reader ({@link LlmCallBillReader}) — `GET <base>/management/generation?id=<id>`, the one place
 * ZenMux states what a call actually billed. The only module that knows that endpoint's shape.
 *
 * Facts it encodes (probed 2026-10-21):
 *
 * - The bill is `data.ratingResponses.billAmount` (USD); `originAmount` is the pre-discount list amount (= the synchronous
 *   `usage.cost`) and `discountAmount` the difference. On `deepseek/deepseek-v4.1-flash`, `google/gemini-3.8-flash` and
 *   `google/gemini-4-argon` the bill is half the list; on the other 14 measured slugs they are equal.
 * - It accepts the PAY-AS-YOU-GO inference key and reads subscription-key calls too; the subscription key answers
 *   `403 {"success":false,"message":"Invalid API key"}`, and so does the management key per the docs.
 * - An id it has no record of answers `404 {"success":false,"message":"Not Found","data":null}`. A call bills 3–5 minutes
 *   after it is made, so that reads as PENDING, never as a failure: re-reading later is the remedy.
 */

import { llmCostOf, llmProviderErrorMessage, type LlmCallBill, type LlmCallBillRead, type LlmCallBillReader, type LlmCallBillReadOptions, type LlmCredentialProbeFetch, type LlmCredentialProbeResponse } from '@dereekb/llm';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { DEFAULT_ZENMUX_BASE_URL, ZENMUX_PROVIDER_ID } from './zenmux.constants';

/**
 * How long one bill read may take before it is reported failed.
 */
export const DEFAULT_ZENMUX_BILL_READ_TIMEOUT_MS: Milliseconds = 15_000;

/**
 * Config for {@link makeZenmuxGenerationBillReader}.
 */
export interface ZenmuxGenerationBillReaderConfig {
  /**
   * The PAY-AS-YOU-GO inference key — the one credential `management/generation` accepts. It reads subscription-key calls
   * too.
   */
  readonly apiKey: string;
  /**
   * The gateway base URL; defaults to {@link DEFAULT_ZENMUX_BASE_URL}. Trailing slashes are stripped.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * The HTTP seam; defaults to the global `fetch`. A spec passes a fake.
   */
  readonly fetch?: LlmCredentialProbeFetch;
  /**
   * The per-read timeout; defaults to {@link DEFAULT_ZENMUX_BILL_READ_TIMEOUT_MS}.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
}

/**
 * The slice of the `management/generation` reply this reader reads.
 */
interface ZenmuxGenerationEnvelope {
  readonly success?: boolean;
  readonly message?: string;
  readonly data?: Maybe<{ readonly ratingResponses?: Maybe<{ readonly billAmount?: unknown; readonly originAmount?: unknown; readonly discountAmount?: unknown }> }>;
}

/**
 * Map one parsed `management/generation` body onto a read outcome.
 *
 * @param generationId - The id that was read.
 * @param envelope - The parsed body.
 * @returns The outcome.
 */
function zenmuxBillReadOf(generationId: string, envelope: ZenmuxGenerationEnvelope): LlmCallBillRead {
  const rating = envelope.data?.ratingResponses;
  const billed = llmCostOf(rating?.billAmount);
  let read: LlmCallBillRead;

  if (billed == null) {
    // A 200 with no rating yet is the same "not billed yet" a 404 is, said differently.
    read = { status: 'pending', generationId, detail: envelope.message ?? 'no rating on the generation yet' };
  } else {
    const listed = llmCostOf(rating?.originAmount);
    const discount = llmCostOf(rating?.discountAmount);
    const bill: LlmCallBill = { generationId, billed, ...(listed == null ? {} : { listed }), ...(discount == null ? {} : { discount }) };
    read = { status: 'billed', bill };
  }

  return read;
}

/**
 * Build the ZenMux bill reader. Construction is inert; every read is one authenticated GET that never throws.
 *
 * @param config - The pay-as-you-go key, and optional base URL / fetch seam / timeout.
 * @returns The bill reader.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeZenmuxGenerationBillReader(config: ZenmuxGenerationBillReaderConfig): LlmCallBillReader {
  const baseUrl = (config.baseUrl ?? DEFAULT_ZENMUX_BASE_URL).replace(/\/+$/, '');
  const apiKey = config.apiKey.trim();
  const timeoutMs = config.timeoutMs ?? DEFAULT_ZENMUX_BILL_READ_TIMEOUT_MS;
  const fetchImpl: LlmCredentialProbeFetch = config.fetch ?? ((url, init) => fetch(url, init) as unknown as Promise<LlmCredentialProbeResponse>);

  return {
    providerId: ZENMUX_PROVIDER_ID,
    async read(generationId: string, options?: LlmCallBillReadOptions): Promise<LlmCallBillRead> {
      const url = `${baseUrl}/management/generation?id=${encodeURIComponent(generationId)}`;
      let read: LlmCallBillRead;

      try {
        // Built INSIDE the try: an engine without `AbortSignal.timeout` / `AbortSignal.any` reads as a failed bill, not a throw.
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const signal = options?.signal == null ? timeoutSignal : AbortSignal.any([timeoutSignal, options.signal]);
        const response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, signal });
        const body = await response.text();

        if (response.ok) {
          let envelope: Maybe<ZenmuxGenerationEnvelope>;

          try {
            envelope = JSON.parse(body) as ZenmuxGenerationEnvelope;
          } catch {
            // Swallow site `llm/zenmux-generation-bill.envelope`. Something in front of the gateway answered (a proxy page):
            // this read's failure, not a throw.
            envelope = undefined;
          }

          read = envelope == null ? { status: 'failed', generationId, detail: 'unparseable response body' } : zenmuxBillReadOf(generationId, envelope);
        } else if (response.status === 404) {
          read = { status: 'pending', generationId, detail: llmProviderErrorMessage(body) ?? 'Not Found' };
        } else {
          // The provider's own words: a `403 Invalid API key` means a key other than the pay-as-you-go one was passed.
          const message = llmProviderErrorMessage(body);
          const words = message == null ? '' : `: ${message}`;
          read = { status: 'failed', generationId, detail: `HTTP ${response.status}${words}` };
        }
      } catch (error) {
        // Swallow site `llm/zenmux-generation-bill.transport`. An unreachable bill endpoint is a FAILED read, never a throw.
        read = { status: 'failed', generationId, detail: error instanceof Error ? error.message : String(error) };
      }

      return read;
    }
  };
}
