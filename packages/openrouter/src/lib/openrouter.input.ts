import { type Maybe } from '@dereekb/util';
import { type OpenRouterFileAnnotation, type OpenRouterFileReference } from './openrouter.type';

/**
 * Role of an input message.
 */
export type OpenRouterInputRole = 'user' | 'system' | 'assistant' | 'developer';

/**
 * A text content part.
 */
export interface OpenRouterInputTextPart {
  readonly type: 'input_text';
  readonly text: string;
}

/**
 * An image content part.
 *
 * Images go in as ordinary image parts — there is no need to wrap one in a PDF the way OpenAI's
 * background-mode file bug forced.
 */
export interface OpenRouterInputImagePart {
  readonly type: 'input_image';
  readonly imageUrl: string;
  readonly detail: 'auto' | 'low' | 'high' | 'original';
}

/**
 * A file content part.
 *
 * OpenRouter takes the file inline in the message — there is no upload step and nothing to clean up
 * afterwards. `fileUrl` is preferred (OpenRouter's docs: "Send publicly accessible PDFs directly
 * without downloading or encoding"); `fileData` is the base64 fallback for an object we will not
 * expose by URL, at the cost of bloating both the request and the stored run task.
 *
 * `fileId` (the OpenRouter Files blob store) is deliberately not modeled: it reintroduces exactly the
 * "files live on their servers and are never deleted" problem this package removes.
 */
export interface OpenRouterInputFilePart {
  readonly type: 'input_file';
  readonly fileUrl?: Maybe<string>;
  readonly fileData?: Maybe<string>;
  readonly filename?: Maybe<string>;
}

/**
 * Any input content part.
 */
export type OpenRouterInputContentPart = OpenRouterInputTextPart | OpenRouterInputImagePart | OpenRouterInputFilePart;

/**
 * A single input message.
 */
export interface OpenRouterInputMessage {
  readonly role: OpenRouterInputRole;
  readonly content: string | OpenRouterInputContentPart[];
}

/**
 * Input to a request: a bare string (shorthand for a single user message) or a list of messages.
 */
export type OpenRouterInput = string | OpenRouterInputMessage[];

/**
 * Normalizes input to a message array.
 *
 * @param input - The input to normalize.
 * @returns The messages, empty when no input was given.
 */
export function openRouterInputMessages(input: Maybe<OpenRouterInput>): OpenRouterInputMessage[] {
  let result: OpenRouterInputMessage[];

  if (input == null) {
    result = [];
  } else if (typeof input === 'string') {
    result = [{ role: 'user', content: [{ type: 'input_text', text: input }] }];
  } else {
    result = input;
  }

  return result;
}

/**
 * Builds a text content part.
 *
 * @param text - The text.
 * @returns The content part.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterInputTextPart(text: string): OpenRouterInputTextPart {
  return { type: 'input_text', text };
}

/**
 * Builds an image content part.
 *
 * @param imageUrl - The image url (a signed url, a data url, or any publicly reachable url).
 * @param detail - Detail level. Defaults to `auto`.
 * @returns The content part.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterInputImagePart(imageUrl: string, detail: OpenRouterInputImagePart['detail'] = 'auto'): OpenRouterInputImagePart {
  return { type: 'input_image', imageUrl, detail };
}

/**
 * Builds a file content part from a url.
 *
 * @param fileUrl - The url the parser will dereference. Must be reachable from the public internet.
 * @param filename - Filename to present; its extension is what tells OpenRouter how to treat the file.
 * @returns The content part.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterInputFileUrlPart(fileUrl: string, filename: string): OpenRouterInputFilePart {
  return { type: 'input_file', fileUrl, filename };
}

/**
 * Builds a file content part from base64 data.
 *
 * @param base64 - Base64 content, with or without a `data:` prefix.
 * @param filename - Filename to present.
 * @param contentType - Mime type used to build the `data:` prefix when the input lacks one. Defaults to `application/pdf`.
 * @returns The content part.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterInputFileDataPart(base64: string, filename: string, contentType = 'application/pdf'): OpenRouterInputFilePart {
  const fileData = base64.startsWith('data:') ? base64 : `data:${contentType};base64,${base64}`;
  return { type: 'input_file', fileData, filename };
}

/**
 * A file reference paired with the url that was minted for it on this attempt.
 */
export interface OpenRouterSignedFileReference {
  readonly file: OpenRouterFileReference;
  /**
   * The signed url, minted for THIS attempt.
   *
   * Never persist this. A run task can sit queued for a sweep interval, be retried, and (with
   * deferred tools) resume much later, so a url minted at enqueue time would 403 by the time it was
   * used.
   */
  readonly signedUrl: string;
}

/**
 * Expands signed file references into file content parts.
 *
 * @param files - The signed file references.
 * @returns One content part per file.
 */
export function openRouterInputFilePartsForSignedFiles(files: Maybe<OpenRouterSignedFileReference[]>): OpenRouterInputFilePart[] {
  return (files ?? []).map(({ file, signedUrl }) => openRouterInputFileUrlPart(signedUrl, file.filename));
}

/**
 * An assistant message echoing `file-parser` annotations back to OpenRouter.
 *
 * `annotations` is not part of the modeled input-message shape, so this is its own type. It is carried
 * through the request builder as-is.
 */
export interface OpenRouterFileAnnotationEchoMessage {
  readonly role: 'assistant';
  readonly content: string;
  readonly annotations: readonly { readonly type: 'file'; readonly file: { readonly hash: string; readonly name?: Maybe<string>; readonly content?: Maybe<unknown> } }[];
}

/**
 * Builds the assistant message that echoes cached `file-parser` annotations back so an already-parsed
 * file is not parsed again.
 *
 * Responses include annotations carrying a file `hash` plus the parsed content; echoing them back in
 * the conversation history skips re-parsing — which under `mistral-ocr` is $2/1,000 pages, and under
 * any engine is latency spent re-reading a document we already read.
 *
 * NOTE: the echo shape follows OpenRouter's documented annotation format. A provider that does not
 * recognize it ignores the field and re-parses, so a mismatch costs a re-parse rather than an error —
 * which is also why a run must never depend on the cache having been honoured.
 *
 * @param annotations - The cached annotations.
 * @returns The message, or undefined when there is nothing cached to resubmit.
 */
export function openRouterFileAnnotationMessage(annotations: Maybe<OpenRouterFileAnnotation[]>): Maybe<OpenRouterFileAnnotationEchoMessage> {
  let result: Maybe<OpenRouterFileAnnotationEchoMessage>;

  if (annotations != null && annotations.length > 0) {
    result = {
      role: 'assistant',
      content: '',
      annotations: annotations.map((annotation) => ({ type: 'file' as const, file: { hash: annotation.hash, name: annotation.filename, content: annotation.content } }))
    };
  }

  return result;
}
