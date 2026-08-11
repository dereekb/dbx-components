import { type Maybe } from '@dereekb/util';
import { type OpenRouterCallResult, type OpenRouterCore, type OpenRouterFileReference, type OpenRouterInput, type OpenRouterModelConfig, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, type OpenRouterSignedFileReference, type Tool, callModelForOpenRouterRequest, openRouterPromptRequest } from '@dereekb/openrouter';
import { type OpenRouterPromptService } from './openrouter.prompt.service';

/**
 * Params for {@link callModelForPrompt}.
 */
export interface CallModelForPromptParams {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The prompt service used to resolve the version.
   */
  readonly promptService: OpenRouterPromptService;
  /**
   * The prompt to run.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * Version to pin. Omit to use the prompt's active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The call input.
   */
  readonly input?: Maybe<OpenRouterInput>;
  /**
   * Per-call config overrides.
   */
  readonly configOverrides?: Maybe<OpenRouterModelConfig>;
  /**
   * Files, already signed for this call.
   *
   * Signed rather than by path, unlike the queued path: an inline call runs once, right now, so there is
   * no later attempt for which a URL could have expired.
   */
  readonly files?: Maybe<OpenRouterSignedFileReference[]>;
  /**
   * Client-side tools.
   */
  readonly tools?: Maybe<readonly Tool[]>;
  /**
   * Trace metadata for cost/usage reconciliation.
   */
  readonly trace?: Maybe<Record<string, unknown>>;
}

/**
 * Runs a prompt INLINE and returns the result, with no run task document.
 *
 * Use this wherever a call reliably finishes in a few seconds. The queue exists for calls that do not,
 * and paying for a document, a lease, and a sweep interval on a two-second call buys nothing.
 *
 * @param params - The client, prompt service, prompt, and input.
 * @returns The normalized call result.
 */
export async function callModelForPrompt(params: CallModelForPromptParams): Promise<OpenRouterCallResult> {
  const { client, promptService, promptKey, version, input, configOverrides, files, tools, trace } = params;

  const prompt = await promptService.resolvePrompt({ promptKey, version });
  const request = openRouterPromptRequest({ prompt, input, overrides: configOverrides, files, trace });

  return callModelForOpenRouterRequest({ client, request, tools: tools ?? undefined });
}

/**
 * Params for {@link openRouterSignedFilesForPaths}.
 */
export interface OpenRouterSignedFilesForPathsParams {
  /**
   * The files to sign.
   */
  readonly files: Maybe<OpenRouterFileReference[]>;
  /**
   * Signs one file reference.
   */
  readonly sign: (file: OpenRouterFileReference) => Promise<string>;
}

/**
 * Signs a list of file references.
 *
 * Exists so an inline caller can reuse the run-task service's signing without going through the queue.
 *
 * @param params - The files and the signer.
 * @returns The signed references.
 */
export async function openRouterSignedFilesForPaths(params: OpenRouterSignedFilesForPathsParams): Promise<OpenRouterSignedFileReference[]> {
  const { files, sign } = params;
  return Promise.all((files ?? []).map(async (file) => ({ file, signedUrl: await sign(file) })));
}
