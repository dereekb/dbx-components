import { type Maybe, arrayToMap } from '@dereekb/util';
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
 * A file reference paired with however it is being carried on THIS attempt.
 *
 * Exactly one of `fileUrl` / `fileData` is expected. Which one depends on whether the object is
 * reachable from the public internet: a signed url is cheap and keeps the request small, and inline
 * base64 is the fallback for an object OpenRouter cannot dereference — most notably anything living in
 * the Firebase storage emulator, where "signed" urls point at localhost.
 */
export interface OpenRouterAttachedFileReference {
  readonly file: OpenRouterFileReference;
  /**
   * The signed url, minted for THIS attempt.
   *
   * Never persist this — see {@link OpenRouterFileReference} for why a url cannot outlive the attempt that
   * minted it.
   */
  readonly fileUrl?: Maybe<string>;
  /**
   * A `data:<mime>;base64,…` url carrying the file inline on THIS attempt.
   *
   * Never persist this either, for a different reason: it is the whole file, re-read on every attempt,
   * and a run task document has a 1 MiB ceiling.
   */
  readonly fileData?: Maybe<string>;
}

/**
 * Expands attached file references into file content parts.
 *
 * @param files - The attached file references.
 * @returns One content part per file.
 */
export function openRouterInputFilePartsForAttachedFiles(files: Maybe<OpenRouterAttachedFileReference[]>): OpenRouterInputFilePart[] {
  return (files ?? []).map(({ file, fileUrl, fileData }) => (fileData != null ? openRouterInputFileDataPart(fileData, file.filename) : openRouterInputFileUrlPart(fileUrl as string, file.filename)));
}

/**
 * Rewrites the `input_file` parts of an already-assembled conversation with the attachment resolved for
 * THIS attempt, matching on filename.
 *
 * A conversation persisted mid-run carries whatever the attempt that persisted it was carrying —
 * a url that has since expired, or (with inline attachments stripped on save) nothing at all. Replaying
 * it unchanged is the failure mode most likely to reach production unnoticed, because it only shows up
 * on a retry or a deferred resume. Resolving fresh per attempt is only half the fix; the other half is
 * making sure the stored history is re-pointed at the fresh attachment too.
 *
 * The field the attachment does NOT carry is REMOVED rather than left alone: a stored `fileUrl` sitting
 * next to a fresh `fileData` would send OpenRouter both, and it is not defined which one wins. Removed
 * rather than nulled, because this output goes on the wire — the SDK validates `input_file` against a
 * schema where an explicit `null` is not a legal absent value.
 *
 * A part whose filename matches nothing in `files` is left alone: it came from somewhere other than
 * this task's file list, and guessing at it would be worse than leaving it.
 *
 * @param messages - The assembled conversation.
 * @param files - The files attached for this attempt.
 * @returns The conversation with fresh attachments, or the input unchanged when there is nothing to rewrite.
 */
export function openRouterMessagesWithFreshFileAttachments<T extends { readonly role: string; readonly content: unknown }>(messages: Maybe<T[]>, files: Maybe<OpenRouterAttachedFileReference[]>): T[] {
  const attachmentsByFilename = arrayToMap(files ?? [], (attached) => attached.file.filename);
  let result: T[] = messages ?? [];

  if (attachmentsByFilename.size > 0 && result.length > 0) {
    result = result.map((message) => {
      let updated = message;

      if (Array.isArray(message.content)) {
        const content = (message.content as OpenRouterInputContentPart[]).map((part) => {
          let updatedPart = part;

          if (part.type === 'input_file' && part.filename != null) {
            const fresh = attachmentsByFilename.get(part.filename);

            if (fresh != null) {
              const { fileUrl: _staleUrl, fileData: _staleData, ...rest } = part;
              updatedPart = { ...rest, ...(fresh.fileData != null ? { fileData: fresh.fileData } : { fileUrl: fresh.fileUrl }) };
            }
          }

          return updatedPart;
        });

        updated = { ...message, content };
      }

      return updated;
    });
  }

  return result;
}

/**
 * Strips the attachment payload off every `input_file` part, keeping `filename` as the rejoin key.
 *
 * Applied on the way INTO Firestore. An attachment is resolved per attempt and is meaningless the
 * moment that attempt ends — a signed url has expired, and inline base64 is the whole file, on a
 * document with a 1 MiB ceiling and a `msg` field that already grows without bound. Nothing is lost:
 * {@link openRouterMessagesWithFreshFileAttachments} re-points the stored parts on the way back out.
 *
 * @param messages - The conversation about to be persisted.
 * @returns The conversation with attachment payloads removed.
 */
export function openRouterMessagesWithoutFileAttachmentData<T extends { readonly role: string; readonly content: unknown }>(messages: Maybe<T[]>): T[] {
  return (messages ?? []).map((message) => {
    let updated = message;

    if (Array.isArray(message.content)) {
      const content = (message.content as OpenRouterInputContentPart[]).map((part) => (part.type === 'input_file' ? { ...part, fileUrl: null, fileData: null } : part));
      updated = { ...message, content };
    }

    return updated;
  });
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
 * Renders one cached annotation as message text.
 *
 * @param annotation - The cached annotation.
 * @returns The text carrying the parse.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterFileAnnotationText(annotation: OpenRouterFileAnnotation): string {
  const content = typeof annotation.content === 'string' ? annotation.content : JSON.stringify(annotation.content ?? null);
  return `<file name="${annotation.filename ?? annotation.hash}" hash="${annotation.hash}">\n${content}\n</file>`;
}

/**
 * Builds the assistant message that carries cached `file-parser` output back, so an already-parsed file
 * is not parsed again.
 *
 * It carries the parse TWICE, deliberately, and for an empirical reason rather than a defensive one:
 *
 *  - `annotations` is OpenRouter's own documented echo format, so the shape is kept and the mechanism
 *    starts working the day the Responses API models it. Today it does not: the SDK validates the request
 *    body against a closed union whose message variants have no `annotations` field, so the property is
 *    STRIPPED during outbound serialization. Verified against the wire, not assumed.
 *  - The parse is therefore ALSO rendered into `content`, as ordinary text, which does survive. Paired
 *    with the request builder dropping the file part for an already-parsed file, that is what makes the
 *    cache real today.
 *
 * @param annotations - The cached annotations.
 * @returns The message, or undefined when there is nothing cached to resubmit.
 */
export function openRouterFileAnnotationMessage(annotations: Maybe<OpenRouterFileAnnotation[]>): Maybe<OpenRouterFileAnnotationEchoMessage> {
  let result: Maybe<OpenRouterFileAnnotationEchoMessage>;

  if (annotations != null && annotations.length > 0) {
    result = {
      role: 'assistant',
      content: annotations.map(openRouterFileAnnotationText).join('\n'),
      annotations: annotations.map((annotation) => ({ type: 'file' as const, file: { hash: annotation.hash, name: annotation.filename, content: annotation.content } }))
    };
  }

  return result;
}

/**
 * Drops the files whose parse is already cached.
 *
 * Not re-sending the document is what actually prevents a re-parse. The annotation echo alone cannot:
 * the SDK strips it, and even where it survives it is a hint the provider is free to ignore, so a run
 * that relied on it would pay for the parse again with no error to show for it.
 *
 * A file is matched to its cached parse by filename, which is the only handle both sides share — the
 * annotation's `hash` is assigned by OpenRouter and the reference's `storagePath` is ours.
 *
 * @param files - The files attached for this attempt.
 * @param annotations - The cached annotations.
 * @returns The files that still need sending.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterUnparsedAttachedFiles(files: Maybe<OpenRouterAttachedFileReference[]>, annotations: Maybe<OpenRouterFileAnnotation[]>): OpenRouterAttachedFileReference[] {
  const cachedFilenames = new Set((annotations ?? []).map((annotation) => annotation.filename).filter((filename): filename is string => filename != null));
  return (files ?? []).filter(({ file }) => !cachedFilenames.has(file.filename));
}
