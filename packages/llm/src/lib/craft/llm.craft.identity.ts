/**
 * Craft identity — the plain-string names a prompt site and its craft notes are keyed by. Craft notes are authored
 * prompt supplements selected per site; the note model, its loading, its selection and its judge build on these
 * names in this folder. Every name is an open `string`: a host declares its own site vocabulary and note tiers.
 */

/**
 * The kind of prompt site a prompt is being built at — the open vocabulary a contributor selects on (e.g.
 * `product-page`, `support-reply`). A host declares its own kinds.
 */
export type LlmCraftSiteKind = string;

/**
 * A craft note's id — unique within one tier; a higher tier's note of the same id shadows a lower one.
 */
export type LlmCraftNoteId = string;

/**
 * The tier a craft note was loaded from — tiers are host-ordered sources (built-in, machine, workspace, …), and a
 * higher tier shadows a lower one note by note.
 */
export type LlmCraftNoteTier = string;
