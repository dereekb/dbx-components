import { type Maybe } from '@dereekb/util';
import { type OpenRouterProviderConfig } from './openrouter.config';
import { type CreateEmbeddingsRequest, type OpenRouterCore, type RequestOptions, embeddingsGenerate } from './openrouter.sdk';
import { type OpenRouterModelId } from './openrouter.type';

/**
 * Params for {@link openRouterEmbeddings}.
 */
export interface OpenRouterEmbeddingsParams {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The embeddings model to use.
   */
  readonly model: OpenRouterModelId;
  /**
   * Text(s) to embed.
   */
  readonly input: string | string[];
  /**
   * Output dimensionality, when the model supports reducing it.
   */
  readonly dimensions?: Maybe<number>;
  /**
   * Input type hint (e.g. `search_query`, `search_document`) for models that distinguish them.
   */
  readonly inputType?: Maybe<string>;
  /**
   * Provider routing — the same pinning that matters everywhere else applies here.
   */
  readonly provider?: Maybe<OpenRouterProviderConfig>;
  /**
   * Additional request options.
   */
  readonly options?: Maybe<RequestOptions>;
}

/**
 * One embedding vector.
 */
export interface OpenRouterEmbedding {
  /**
   * Index of this embedding in the input list.
   */
  readonly index: number;
  /**
   * The vector.
   */
  readonly embedding: number[];
}

/**
 * Result of an embeddings request.
 */
export interface OpenRouterEmbeddingsResult {
  readonly model: string;
  readonly embeddings: OpenRouterEmbedding[];
  readonly promptTokens?: Maybe<number>;
  readonly totalTokens?: Maybe<number>;
}

/**
 * Generates embeddings.
 *
 * Base64-encoded embeddings are decoded to numbers before being returned, so a caller never has to
 * branch on the encoding the model happened to use.
 *
 * @param params - The client, model, input, and routing options.
 * @returns The embeddings.
 */
export async function openRouterEmbeddings(params: OpenRouterEmbeddingsParams): Promise<OpenRouterEmbeddingsResult> {
  const { client, model, input, dimensions, inputType, provider, options } = params;

  const requestBody: CreateEmbeddingsRequest['requestBody'] = {
    model,
    input,
    dimensions: dimensions ?? undefined,
    inputType: inputType ?? undefined,
    provider: (provider ?? undefined) as CreateEmbeddingsRequest['requestBody']['provider']
  };

  const result = await embeddingsGenerate(client, { requestBody }, options ?? undefined);

  if (!result.ok) {
    throw result.error;
  }

  const response = result.value;

  if (typeof response === 'string') {
    throw new TypeError('OpenRouter returned a non-JSON embeddings response.');
  }

  const embeddings = response.data.map((entry, index) => ({ index: entry.index ?? index, embedding: openRouterEmbeddingVector(entry.embedding) }));

  return { model: response.model, embeddings, promptTokens: response.usage?.promptTokens, totalTokens: response.usage?.totalTokens };
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodes a base64 string to bytes.
 *
 * Hand-rolled rather than using `Buffer` or `atob`: this package's only peer dependency is
 * `@dereekb/util`, so it must not assume a Node or a browser global.
 *
 * @param base64 - The base64 string. Padding is optional.
 * @returns The decoded bytes.
 */
export function openRouterDecodeBase64(base64: string): Uint8Array {
  const clean = base64.replaceAll(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let buffer = 0;
  let bits = 0;
  let offset = 0;

  for (const element of clean) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(element);
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (buffer >> bits) & 0xff;
      offset += 1;
    }
  }

  return bytes;
}

/**
 * Normalizes an embedding to a number array, decoding the base64 (little-endian float32) form.
 *
 * @param embedding - The embedding as returned.
 * @returns The vector.
 */
export function openRouterEmbeddingVector(embedding: number[] | string): number[] {
  let result: number[];

  if (typeof embedding === 'string') {
    const bytes = openRouterDecodeBase64(embedding);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const length = Math.floor(bytes.byteLength / 4);
    result = [];

    for (let i = 0; i < length; i += 1) {
      result.push(view.getFloat32(i * 4, true));
    }
  } else {
    result = embedding;
  }

  return result;
}
