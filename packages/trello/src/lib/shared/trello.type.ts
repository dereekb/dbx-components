import { type ISO8601DateString, type Maybe } from '@dereekb/util';

/**
 * RGB hex color string for label colors (no preset name).
 */
export type TrelloHexColor = string;

/**
 * One of the canonical Trello label colors. Pass `null` to clear a label color.
 */
export type TrelloLabelColor = 'yellow' | 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'black' | 'sky' | 'pink' | 'lime';

/**
 * Common `pos` value used by lists, cards, and labels.
 *
 * Either a number, or the string `top` or `bottom`.
 */
export type TrelloPosition = number | 'top' | 'bottom';

/**
 * ISO date string used by Trello timestamps.
 */
export type TrelloDateString = ISO8601DateString;

/**
 * Maybe a date string, since Trello often returns null/undefined for unset dates.
 */
export type TrelloMaybeDateString = Maybe<TrelloDateString>;
