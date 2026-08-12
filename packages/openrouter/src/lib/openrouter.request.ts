import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfig, mergeOpenRouterModelConfig } from './openrouter.config';
import { type OpenRouterAttachedFileReference, type OpenRouterFileAnnotationEchoMessage, type OpenRouterInput, type OpenRouterInputMessage, openRouterFileAnnotationMessage, openRouterInputFilePartsForAttachedFiles, openRouterInputMessages, openRouterUnparsedAttachedFiles } from './openrouter.input';
import { type OpenRouterResolvedPrompt } from './openrouter.prompt';
import { type OpenRouterRunTaskKey } from './openrouter.type';

/**
 * Trace metadata attached to a request.
 *
 * OpenRouter includes custom metadata from the `trace` field as span attributes in the OTLP payload
 * its broadcast webhook posts, so this is the correlation handle that lets a completion trace be
 * matched back to the run that produced it — the same job `metadata.taskKey` does on OpenAI today.
 */
export interface OpenRouterRequestTrace {
  /**
   * The run task this request belongs to.
   */
  readonly runTaskKey?: Maybe<OpenRouterRunTaskKey>;
  /**
   * Any additional properties to carry through as span attributes.
   */
  readonly [key: string]: unknown;
}

/**
 * Params for {@link openRouterPromptRequest}.
 */
export interface OpenRouterPromptRequestParams {
  /**
   * The resolved prompt version supplying instructions, seed messages, and base config.
   */
  readonly prompt: OpenRouterResolvedPrompt;
  /**
   * The caller's dynamic input.
   */
  readonly input?: Maybe<OpenRouterInput>;
  /**
   * Per-run config overrides, applied on top of the version's config.
   */
  readonly overrides?: Maybe<OpenRouterModelConfig>;
  /**
   * Files to attach, each already resolved to a url or inline data for THIS attempt.
   */
  readonly files?: Maybe<OpenRouterAttachedFileReference[]>;
  /**
   * Cached `file-parser` annotations to echo back so an already-parsed file is not re-parsed.
   */
  readonly fileAnnotations?: Maybe<Parameters<typeof openRouterFileAnnotationMessage>[0]>;
  /**
   * Prior conversation history to continue from.
   *
   * This is what replaces `previous_response_id`: OpenRouter is stateless, so continuing a
   * conversation means resending its history.
   */
  readonly history?: Maybe<OpenRouterInputMessage[]>;
  /**
   * Trace metadata for cost/usage reconciliation.
   */
  readonly trace?: Maybe<OpenRouterRequestTrace>;
}

/**
 * A built request: the merged config plus the assembled input, ready to spread into `callModel`.
 */
export interface OpenRouterPromptRequest {
  /**
   * The merged model config (version config with overrides applied).
   */
  readonly config: OpenRouterModelConfig;
  /**
   * The system prompt.
   */
  readonly instructions?: Maybe<string>;
  /**
   * The assembled input messages, static content first.
   */
  readonly input: (OpenRouterInputMessage | OpenRouterFileAnnotationEchoMessage)[];
  /**
   * Trace metadata, when any was supplied.
   */
  readonly trace?: Maybe<OpenRouterRequestTrace>;
}

/**
 * Builds a request from a resolved prompt version plus a caller's dynamic input.
 *
 * Content is emitted STATIC FIRST — seed messages, then annotation echoes, then continued history,
 * then the caller's input, with attached files appended to the final user message. That ordering is
 * not cosmetic: a prompt cache only hits on a shared prefix, so putting the per-call content last is
 * what keeps the static prefix cacheable across runs of the same prompt.
 *
 * @param params - The prompt, input, overrides, files, history, and trace.
 * @returns The built request.
 */
export function openRouterPromptRequest(params: OpenRouterPromptRequestParams): OpenRouterPromptRequest {
  const { prompt, input, overrides, files, fileAnnotations, history, trace } = params;

  const config = mergeOpenRouterModelConfig([prompt.config, overrides]);
  const seedMessages: OpenRouterInputMessage[] = (prompt.messages ?? []).map(({ role, content }) => ({ role, content }));
  const annotationMessage = openRouterFileAnnotationMessage(fileAnnotations);
  const inputMessages = openRouterInputMessages(input);
  // A file whose parse is already cached is NOT re-attached. Sending it again is what causes the
  // re-parse; the annotation echo alone cannot prevent one.
  const fileParts = openRouterInputFilePartsForAttachedFiles(openRouterUnparsedAttachedFiles(files, fileAnnotations));

  const messages: (OpenRouterInputMessage | OpenRouterFileAnnotationEchoMessage)[] = [...seedMessages];

  if (annotationMessage != null) {
    messages.push(annotationMessage);
  }

  if (history != null && history.length > 0) {
    messages.push(...history);
  }

  messages.push(...inputMessages);

  if (fileParts.length > 0) {
    // Files ride on the last user message so they sit alongside the text that refers to them. When
    // the caller passed no input at all (a file-only run) a user message is created to carry them.
    const lastUserIndex = messages.findLastIndex((x) => x.role === 'user');

    if (lastUserIndex >= 0) {
      const target = messages[lastUserIndex] as OpenRouterInputMessage;
      const content = typeof target.content === 'string' ? [{ type: 'input_text' as const, text: target.content }] : target.content;
      messages[lastUserIndex] = { role: target.role, content: [...content, ...fileParts] };
    } else {
      messages.push({ role: 'user', content: fileParts });
    }
  }

  return { config, instructions: prompt.instructions, input: messages, trace };
}
