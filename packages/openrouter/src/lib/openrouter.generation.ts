import { type Maybe } from '@dereekb/util';
import { type GenerationContentData, type GenerationResponseData, type OpenRouterCore, type RequestOptions, generationsGetGeneration, generationsListGenerationContent } from './openrouter.sdk';
import { type OpenRouterGenerationId } from './openrouter.type';

/**
 * Params for {@link openRouterGeneration} and {@link openRouterGenerationContent}.
 */
export interface OpenRouterGenerationParams {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The generation id, as stored on a run task's `gi`.
   */
  readonly id: OpenRouterGenerationId;
  /**
   * Additional request options.
   */
  readonly options?: Maybe<RequestOptions>;
}

/**
 * Loads a generation's metadata — finish reason, cancellation, BYOK, latency, and the full token/cost
 * breakdown, which is finalised server-side and so can be more complete than the usage the response
 * carried.
 *
 * This is an AUDIT surface, never the system of record. What it returns is tied to account logging
 * settings (nothing is retained under ZDR / logging-disabled), its retention is undocumented, and it is
 * keyed per generation rather than per conversation — which is why a run task stores its own output and
 * keeps `gi (generationIds)` only for lookups like this one.
 *
 * @param params - The client and generation id.
 * @returns The generation metadata.
 * @throws {Error} When the lookup fails, including the 404 a generation that was never retained produces.
 */
export async function openRouterGeneration(params: OpenRouterGenerationParams): Promise<GenerationResponseData> {
  const { client, id, options } = params;
  const result = await generationsGetGeneration(client, { id }, options ?? undefined);

  if (!result.ok) {
    throw result.error;
  }

  return result.value.data;
}

/**
 * Loads a generation's stored content — prompt, completion, reasoning, and output.
 *
 * Subject to every caveat on {@link openRouterGeneration}: this reloads what OpenRouter happened to
 * retain, not what the run produced.
 *
 * @param params - The client and generation id.
 * @returns The stored content.
 * @throws {Error} When the lookup fails.
 */
export async function openRouterGenerationContent(params: OpenRouterGenerationParams): Promise<GenerationContentData> {
  const { client, id, options } = params;
  const result = await generationsListGenerationContent(client, { id }, options ?? undefined);

  if (!result.ok) {
    throw result.error;
  }

  return result.value.data;
}
