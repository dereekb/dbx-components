/**
 * ZenMux's management API: the one envelope every endpoint answers in, the URL builders, and the one authenticated read the
 * status source, the bill reader and the credential probe share.
 */

import { resolveLlmFetch } from '@dereekb/llm';
import { type AbortSignalRef, makeTimeoutAbortSignal, type Maybe, type Milliseconds } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonTextResult, readFetchJsonText } from '@dereekb/util/fetch';

/**
 * The envelope every ZenMux management endpoint answers in.
 */
export interface ZenmuxEnvelope<T> {
  readonly success?: boolean;
  readonly message?: string;
  readonly data?: Maybe<T>;
}

/**
 * What every ZenMux management reader is configured with.
 */
export interface ZenmuxManagementReadConfig {
  /**
   * The API base URL; defaults to `DEFAULT_ZENMUX_BASE_URL`. Trailing slashes are stripped.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * The HTTP seam — a spec's fake. Absent ⇒ the global `fetch`, read at call time.
   */
  readonly fetch?: Maybe<ConfiguredFetch>;
  /**
   * The per-read timeout; each reader has its own default.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
}

/**
 * Build a management endpoint URL.
 *
 * @param baseUrl - The trimmed API base URL.
 * @param path - The path below `/management`, e.g. `subscription/detail`.
 * @returns `{baseUrl}/management/{path}`.
 */
export function zenmuxManagementUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/management/${path}`;
}

/**
 * Build the `management/generation` URL for one generation id. The id is URI-encoded.
 *
 * @param baseUrl - The trimmed API base URL.
 * @param generationId - The generation to look up.
 * @returns `{baseUrl}/management/generation?id={generationId}`.
 */
export function zenmuxGenerationUrl(baseUrl: string, generationId: string): string {
  return zenmuxManagementUrl(baseUrl, `generation?id=${encodeURIComponent(generationId)}`);
}

/**
 * Input of {@link readZenmuxManagement}.
 */
export interface ReadZenmuxManagementInput extends AbortSignalRef {
  readonly fetch: Maybe<ConfiguredFetch>;
  readonly url: string;
  readonly apiKey: string;
  readonly timeoutMs: Milliseconds;
}

/**
 * One authenticated management GET, its body read as text once. Resolves for any status and any body; rejects only on a
 * transport failure (or a throwing abort-signal API), which each reader's own catch maps.
 *
 * @param input - The seam, URL, key, timeout and optional caller signal.
 * @returns The response, its text and the decoded envelope.
 */
export async function readZenmuxManagement<T>(input: ReadZenmuxManagementInput): Promise<FetchJsonTextResult<ZenmuxEnvelope<T>>> {
  const signal = makeTimeoutAbortSignal({ timeout: input.timeoutMs, signal: input.signal });
  return readFetchJsonText<ZenmuxEnvelope<T>>(resolveLlmFetch(input.fetch)(input.url, { method: 'GET', headers: { Authorization: `Bearer ${input.apiKey}` }, signal }));
}
