import { type FirestoreModelId, type FirestoreModelKey } from '@dereekb/firebase';
import { type OpenRouterPromptVersionNumber } from '@dereekb/openrouter';

/**
 * An {@link OpenRouterPrompt} id.
 *
 * This is the prompt's stable human-readable key (`kaia-resume-parser`) rather than a generated id —
 * the whole point of the model is that a call site names the prompt it wants in readable text instead
 * of quoting an opaque `pmpt_…`.
 */
export type OpenRouterPromptId = FirestoreModelId;

/**
 * An {@link OpenRouterPrompt} key.
 */
export type OpenRouterPromptModelKey = FirestoreModelKey;

/**
 * An {@link OpenRouterPromptVersion} id: the version number, zero-padded so lexical document
 * ordering matches numeric ordering.
 */
export type OpenRouterPromptVersionId = FirestoreModelId;

/**
 * An {@link OpenRouterPromptVersion} key.
 */
export type OpenRouterPromptVersionModelKey = FirestoreModelKey;

/**
 * Number of digits an {@link OpenRouterPromptVersionId} is padded to.
 *
 * Padding is what makes `orderBy(documentId())` on the subcollection return v2 before v10. Six digits
 * is far past any realistic version count while staying readable.
 */
export const OPENROUTER_PROMPT_VERSION_ID_DIGITS = 6;

/**
 * Converts a version number to its zero-padded document id.
 *
 * @param version - The version number.
 * @returns The document id.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterPromptVersionId(version: OpenRouterPromptVersionNumber): OpenRouterPromptVersionId {
  return String(version).padStart(OPENROUTER_PROMPT_VERSION_ID_DIGITS, '0');
}

/**
 * Reads the version number back out of a version document id.
 *
 * @param id - The document id.
 * @returns The version number, or NaN when the id is not a number.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterPromptVersionNumberFromId(id: OpenRouterPromptVersionId): OpenRouterPromptVersionNumber {
  return Number(id);
}

/**
 * An {@link OpenRouterRunTask} id — the caller-supplied run key.
 */
export type OpenRouterRunTaskId = FirestoreModelId;

/**
 * An {@link OpenRouterRunTask} key.
 */
export type OpenRouterRunTaskModelKey = FirestoreModelKey;
