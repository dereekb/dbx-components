/**
 * Craft identity — the plain-string names craft notes are keyed by. Craft notes are authored prompt supplements
 * selected per site; the note model, its loading, its selection and its judge build on these names in this folder.
 * Every name is an open `string`: a host declares its own note tiers. A site's kind is the prompt site's own
 * `LlmPromptSiteKind`.
 */

/**
 * A craft note's id — unique within one tier; a higher tier's note of the same id shadows a lower one.
 */
export type LlmCraftNoteId = string;

/**
 * The tier a craft note was loaded from — tiers are host-ordered sources (built-in, machine, workspace, …), and a
 * higher tier shadows a lower one note by note.
 */
export type LlmCraftNoteTier = string;
