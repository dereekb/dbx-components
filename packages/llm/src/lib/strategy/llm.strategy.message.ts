/**
 * Provider-neutral helpers that turn the strategy contract's thread and attachment shapes into the parts every chat
 * wire accepts. A transport that needs more (breakpoint blocks, a provider's own envelope) builds that itself on top.
 */
import { type LlmAttachment, type LlmThreadRole, type LlmThreadTurn } from './llm.strategy';

/**
 * One replayed thread turn as a plain-text chat message — the provider-neutral shape every chat wire accepts.
 */
export interface LlmThreadChatMessage {
  /**
   * Whether the turn was a sent user prompt or the assistant reply to it.
   */
  readonly role: LlmThreadRole;
  /**
   * The turn's exact text.
   */
  readonly content: string;
}

/**
 * Map a replayed thread onto plain-text chat messages, oldest first. Drops each turn's `cacheSegments`: a transport
 * that replays breakpoint blocks builds them itself.
 *
 * @param thread - The prior turns, oldest first.
 * @returns One plain-text chat message per turn, in order.
 *
 * @example
 * ```ts
 * toLlmThreadChatMessages([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }]);
 * // [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }]
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmThreadChatMessages(thread: ReadonlyArray<LlmThreadTurn>): LlmThreadChatMessage[] {
  return thread.map((turn) => ({ role: turn.role, content: turn.content }));
}

/**
 * Build the inline `data:<mime>;base64,<dataBase64>` URL an image part carries.
 *
 * @param attachment - The attachment's MIME type and base64 bytes.
 * @returns The data URL.
 *
 * @example
 * ```ts
 * toLlmAttachmentDataUrl({ mime: 'image/png', dataBase64: 'QUJD' }); // 'data:image/png;base64,QUJD'
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmAttachmentDataUrl(attachment: Pick<LlmAttachment, 'mime' | 'dataBase64'>): string {
  return `data:${attachment.mime};base64,${attachment.dataBase64}`;
}
