import { describe, expect, it } from 'vitest';
import { OpenRouterCore } from '@openrouter/sdk/core';
import { callModelForOpenRouterRequest } from './openrouter.call';
import { openRouterFileSearchTool, openRouterProviderPinnedTo } from './openrouter.config';

/**
 * The `file_search` passthrough spike — live probes against OpenRouter.
 *
 * ## Outcome: PASS
 *
 * OpenRouter **does** forward a hosted `file_search` tool upstream to OpenAI. Probed with a
 * syntactically valid but nonexistent store id, the response carries OpenAI's own
 * `Vector store with id [...] not found.` — an error that can only come from the upstream vector-store
 * lookup, which means the tool was routed rather than stripped or ignored. The tool is echoed back on
 * the response's `tools` array intact. Only a real `vs_…` in the BYOK org is needed to use it.
 *
 * Two further findings, both verified rather than reasoned about:
 *
 *  - **The wire name is `vector_store_ids`.** Sending `vectorStoreIds` gets a flat `400 invalid_prompt`.
 *    That is consistent with `@openrouter/sdk`, which takes `vectorStoreIds` and remaps it on the way
 *    out — so {@link openRouterFileSearchTool} is camelCase on purpose, and anything else is dropped by
 *    the SDK before it ever reaches this API.
 *  - **`provider.require_parameters` did not change the outcome here**, because `openai/gpt-5-nano` has
 *    exactly one provider and so there was never an alternate route to silently drop the parameter on.
 *    Pin it anyway on any model with more than one provider, where the documented behaviour ("providers
 *    will receive only the parameters they support, and ignore the rest") does bite.
 *
 * ## Our side
 *
 * Also done, and probed the same way. `@openrouter/sdk`'s `callModel` destructures `tools` off the
 * request and runs every entry through its client-function converter, so a hosted entry never survives
 * it — which is why a hosted-tool run goes out through `sendOpenRouterResponsesRequest` (a direct,
 * non-streaming `POST /responses`) instead, or through a `ModelResult` carrying the hosted entries
 * appended after client-tool conversion when the run also needs the client-side tool loop. See
 * `openrouter.call.ts`. The probe below sends one through `callModelForOpenRouterRequest` and sees the
 * same upstream vector-store error, so the delivery is verified at the package's own entry point rather
 * than only at the wire.
 *
 * Regardless: **OpenRouter can never create or populate a vector store.** Ingestion always goes direct
 * to OpenAI.
 *
 * ## Running
 *
 * Skipped unless `OPENROUTER_API_KEY` is set, because these make real calls. They are deliberately
 * cheap: the default model is free, and the file_search probe fails at the store lookup before any
 * generation is billed.
 *
 * ```
 * OPENROUTER_API_KEY=sk-or-… pnpm nx test openrouter
 * OPENROUTER_TEST_MODEL_ID=deepseek/deepseek-v4-flash pnpm nx test openrouter
 * OPENROUTER_FILE_SEARCH_VECTOR_STORE_ID=vs_… pnpm nx test openrouter   # the full end-to-end assertion
 * ```
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CREDENTIALS_PRESENT = Boolean(OPENROUTER_API_KEY);

/**
 * Model used by the live probes. Free by default — override for a specific provider.
 */
export const OPENROUTER_SPIKE_DEFAULT_TEST_MODEL = 'nvidia/nemotron-nano-9b-v2:free';

/**
 * Model used by the `file_search` probe. Must be an OpenAI model: a `vs_…` id resolves only against the
 * OpenAI org that owns it, so no other provider can answer the question.
 */
export const OPENROUTER_SPIKE_DEFAULT_FILE_SEARCH_MODEL = 'openai/gpt-5-nano';

const TEST_MODEL = process.env.OPENROUTER_TEST_MODEL_ID ?? OPENROUTER_SPIKE_DEFAULT_TEST_MODEL;
const FILE_SEARCH_MODEL = process.env.OPENROUTER_FILE_SEARCH_MODEL_ID ?? OPENROUTER_SPIKE_DEFAULT_FILE_SEARCH_MODEL;
const VECTOR_STORE_ID = process.env.OPENROUTER_FILE_SEARCH_VECTOR_STORE_ID;

/**
 * A store id that is well-formed but cannot exist. Probing with it separates "OpenRouter forwarded the
 * tool and OpenAI rejected the id" from "OpenRouter ignored the tool" — which is the whole question,
 * and it costs nothing because the request fails before any tokens are generated.
 */
const UNRESOLVABLE_VECTOR_STORE_ID = 'vs_0000000000000000000000';

interface OpenRouterProbeResponse {
  readonly id?: string;
  readonly model?: string;
  readonly status?: string;
  readonly error?: { readonly code?: string | number; readonly message?: string } | null;
  readonly output?: { readonly type?: string; readonly results?: unknown[] }[];
  readonly output_text?: string;
  readonly tools?: unknown[];
  readonly usage?: { readonly cost?: number; readonly is_byok?: boolean };
}

/**
 * POSTs one request to OpenRouter's `/responses` endpoint.
 *
 * @param apiKey - A live OpenRouter key.
 * @param body - The raw request body, in WIRE casing.
 * @returns The status and parsed body.
 */
export async function postOpenRouterResponse(apiKey: string, body: Record<string, unknown>): Promise<{ status: number; body: OpenRouterProbeResponse }> {
  const response = await fetch('https://openrouter.ai/api/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  return { status: response.status, body: (await response.json()) as OpenRouterProbeResponse };
}

describe.skipIf(!CREDENTIALS_PRESENT)('OpenRouter live probes', () => {
  it('should accept the request shape this package emits', async () => {
    const { status, body } = await postOpenRouterResponse(OPENROUTER_API_KEY as string, {
      model: TEST_MODEL,
      input: 'Reply with exactly: OK',
      max_output_tokens: 400,
      // The correlation handle the broadcast webhook reads back off the OTLP span.
      trace: { additionalProperties: { runTaskKey: 'spike_probe' } }
    });

    expect(status, `OpenRouter rejected the request: ${JSON.stringify(body.error)}`).toBe(200);
    expect(body.error ?? null).toBeNull();
    expect(body.model).toContain(TEST_MODEL.split(':')[0]);
  }, 60_000);

  it('should forward a hosted file_search tool upstream rather than ignore it', async () => {
    const { status, body } = await postOpenRouterResponse(OPENROUTER_API_KEY as string, {
      model: FILE_SEARCH_MODEL,
      input: 'Search the attached knowledge base and quote one sentence from it verbatim.',
      max_output_tokens: 400,
      tools: [{ type: 'file_search', vector_store_ids: [VECTOR_STORE_ID ?? UNRESOLVABLE_VECTOR_STORE_ID] }],
      include: ['file_search_call.results'],
      provider: { only: ['openai'], allow_fallbacks: false, require_parameters: true }
    });

    expect(status).toBe(200);

    if (VECTOR_STORE_ID) {
      // The full assertion, once a real store exists: the hosted tool ran and returned grounded chunks.
      const fileSearchCall = (body.output ?? []).find((item) => item.type === 'file_search_call');
      expect(fileSearchCall, `No file_search_call output item. Fall back to querying the vector store on api.openai.com directly. Response: ${JSON.stringify(body.error ?? body.status)}`).toBeDefined();
      expect(fileSearchCall?.results ?? []).not.toHaveLength(0);
    } else {
      // Without a real store, the ROUTING question is still answerable — and it is the one that matters.
      // An upstream "vector store not found" can only be produced by OpenAI resolving the id, which means
      // OpenRouter forwarded the tool. Silently dropping it would instead yield a cheerful, ungrounded
      // answer and no error at all.
      expect(body.error?.message ?? '', `Expected an upstream vector-store lookup failure; got ${JSON.stringify({ error: body.error, output: (body.output ?? []).map((x) => x.type) })}`).toMatch(/vector store/i);
      expect(JSON.stringify(body.tools ?? [])).toContain('vector_store_ids');
    }
  }, 60_000);

  it('should deliver a hosted file_search tool through this package own dispatch path', async () => {
    // The probes above prove the WIRE shape works. This one proves our layer delivers it: a config
    // carrying a hosted tool routes off `callModel` (which would mangle it) onto the direct `/responses`
    // path, and the tool still reaches OpenAI.
    const client = new OpenRouterCore({ apiKey: OPENROUTER_API_KEY as string });

    const result = await callModelForOpenRouterRequest({
      client,
      request: {
        config: {
          model: FILE_SEARCH_MODEL,
          maxOutputTokens: 400,
          tools: [openRouterFileSearchTool([VECTOR_STORE_ID ?? UNRESOLVABLE_VECTOR_STORE_ID], 5)],
          include: ['file_search_call.results'],
          provider: openRouterProviderPinnedTo('openai')
        },
        input: [{ role: 'user', content: 'Search the attached knowledge base and quote one sentence from it verbatim.' }]
      }
    });

    if (VECTOR_STORE_ID) {
      const fileSearchCall = (result.response.output ?? []).find((item) => (item as { type?: string }).type === 'file_search_call');
      expect(fileSearchCall, `No file_search_call output item. Response: ${JSON.stringify(result.error)}`).toBeDefined();
    } else {
      // Same reasoning as the raw probe: only an upstream vector-store lookup can produce this error, so
      // seeing it means our request carried the tool all the way through rather than dropping it.
      expect(result.error?.message ?? '', `Expected an upstream vector-store lookup failure; got ${JSON.stringify(result.error)}`).toMatch(/vector store/i);
    }
  }, 60_000);

  it('should reject the camelCased field name, which is why the SDK remaps it', async () => {
    // `openRouterFileSearchTool` emits `vectorStoreIds` because the SDK remaps it to the wire name. This
    // pins the other half of that contract: the wire itself does NOT accept the camelCase spelling, so a
    // config that reaches the API unremapped is a 400 rather than a silent no-op.
    const { status } = await postOpenRouterResponse(OPENROUTER_API_KEY as string, {
      model: FILE_SEARCH_MODEL,
      input: 'Say OK.',
      max_output_tokens: 400,
      tools: [{ type: 'file_search', vectorStoreIds: [UNRESOLVABLE_VECTOR_STORE_ID] }],
      provider: { only: ['openai'], allow_fallbacks: false, require_parameters: true }
    });

    expect(status).toBe(400);
  }, 60_000);
});
