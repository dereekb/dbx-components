/**
 * The ZenMux per-call BILL reader ({@link LlmCallBillReader}) — `GET <base>/management/generation?id=<id>`, the one place
 * ZenMux states what a call actually billed. The only module that knows that endpoint's shape.
 *
 * Facts it encodes:
 *
 * - The bill is `data.ratingResponses.billAmount` (USD); `originAmount` is the pre-discount list amount (= the synchronous
 *   `usage.cost`) and `discountAmount` the difference. Some slugs bill a discount (e.g. half the list); on most the two
 *   are equal.
 * - It accepts the PAY-AS-YOU-GO inference key and reads subscription-key calls too; the subscription key answers
 *   `403 {"success":false,"message":"Invalid API key"}`, and so does the management key per the docs.
 * - An id it has no record of answers `404 {"success":false,"message":"Not Found","data":null}`. A call bills 3–5 minutes
 *   after it is made, so that reads as PENDING, never as a failure: re-reading later is the remedy.
 */

import { readLlmCost, llmProviderErrorMessage, type LlmCallBill, type LlmCallBillRead, type LlmCallBillReader, type LlmCallBillReadOptions, type LlmGenerationId } from '@dereekb/llm';
import { filterMaybeValues, readErrorMessage, type Maybe, type Milliseconds, removeTrailingSlashes } from '@dereekb/util';
import { DEFAULT_LLM_ZENMUX_BASE_URL, LLM_ZENMUX_PROVIDER_ID } from './zenmux.constants';
import { readLlmZenmuxManagement, llmZenmuxGenerationUrl, type LlmZenmuxEnvelope, type LlmZenmuxManagementReadConfig } from './zenmux.management';

/**
 * How long one bill read may take before it is reported failed.
 */
export const DEFAULT_LLM_ZENMUX_BILL_READ_TIMEOUT_MS: Milliseconds = 15_000;

/**
 * Config for {@link makeLlmZenmuxGenerationBillReader}.
 */
export interface LlmZenmuxGenerationBillReaderConfig extends LlmZenmuxManagementReadConfig {
  /**
   * The PAY-AS-YOU-GO inference key — the one credential `management/generation` accepts. It reads subscription-key calls
   * too.
   */
  readonly apiKey: string;
}

/**
 * The `management/generation` payload subset the bill reader reads.
 */
interface ZenmuxGenerationData {
  readonly ratingResponses?: Maybe<{ readonly billAmount?: unknown; readonly originAmount?: unknown; readonly discountAmount?: unknown }>;
}

/**
 * Map one parsed `management/generation` body onto a read outcome.
 *
 * @param generationId - The id that was read.
 * @param envelope - The parsed body.
 * @returns The outcome.
 */
function zenmuxBillReadOf(generationId: LlmGenerationId, envelope: LlmZenmuxEnvelope<ZenmuxGenerationData>): LlmCallBillRead {
  const rating = envelope.data?.ratingResponses;
  const billed = readLlmCost(rating?.billAmount);
  let read: LlmCallBillRead;

  if (billed == null) {
    // A 200 with no rating yet is the same "not billed yet" a 404 is, said differently.
    read = { status: 'pending', generationId, detail: envelope.message ?? 'no rating on the generation yet' };
  } else {
    const listed = readLlmCost(rating?.originAmount);
    const discount = readLlmCost(rating?.discountAmount);
    const bill: LlmCallBill = filterMaybeValues({ generationId, billed, listed, discount });
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
export function makeLlmZenmuxGenerationBillReader(config: LlmZenmuxGenerationBillReaderConfig): LlmCallBillReader {
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? DEFAULT_LLM_ZENMUX_BASE_URL);
  const apiKey = config.apiKey.trim();
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_ZENMUX_BILL_READ_TIMEOUT_MS;

  return {
    providerId: LLM_ZENMUX_PROVIDER_ID,
    async read(generationId: LlmGenerationId, options?: LlmCallBillReadOptions): Promise<LlmCallBillRead> {
      const url = llmZenmuxGenerationUrl(baseUrl, generationId);
      let read: LlmCallBillRead;

      try {
        // Built INSIDE the try: should the runtime's abort-signal API throw, it reads as a failed bill, not a throw.
        const managementRead = await readLlmZenmuxManagement<ZenmuxGenerationData>({ fetch: config.fetch, url, apiKey, timeoutMs, signal: options?.signal });
        const envelope = managementRead.json;

        if (managementRead.response.ok) {
          // Swallow site `llm/zenmux-generation-bill.envelope`. A non-JSON (or JSON `null`) body means something in front
          // of the gateway answered (a proxy page): this read's failure, not a throw.
          read = envelope == null ? { status: 'failed', generationId, detail: 'unparseable response body' } : zenmuxBillReadOf(generationId, envelope);
        } else if (managementRead.response.status === 404) {
          read = { status: 'pending', generationId, detail: llmProviderErrorMessage(managementRead) ?? 'Not Found' };
        } else {
          // The provider's own words: a `403 Invalid API key` means a key other than the pay-as-you-go one was passed.
          const message = llmProviderErrorMessage(managementRead);
          const words = message == null ? '' : `: ${message}`;
          read = { status: 'failed', generationId, detail: `HTTP ${managementRead.response.status}${words}` };
        }
      } catch (error) {
        // Swallow site `llm/zenmux-generation-bill.transport`. An unreachable bill endpoint is a FAILED read, never a throw.
        read = { status: 'failed', generationId, detail: readErrorMessage(error) };
      }

      return read;
    }
  };
}
