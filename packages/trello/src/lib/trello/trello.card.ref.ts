import { type Maybe } from '@dereekb/util';
import { type TrelloCardId } from '../trello.type';

/**
 * A card's 8-character shortLink, the token in its `https://trello.com/c/<shortLink>` url. Every card api accepts it
 * wherever it accepts a {@link TrelloCardId}.
 */
export type TrelloCardShortLink = string;

/**
 * Matches a Trello card url and captures its shortLink.
 */
export const TRELLO_CARD_URL_REGEX = /https?:\/\/trello\.com\/c\/([A-Za-z0-9_-]+)/g;

/**
 * Every Trello card shortLink linked from `https://trello.com/c/<shortLink>` urls in a block of free text — a prompt, a
 * comment, a description — deduped in first-seen order.
 *
 * @param text - The text to scan.
 * @returns The linked shortLinks (empty when there are none).
 *
 * @example
 * ```ts
 * extractTrelloCardShortLinks('see https://trello.com/c/AbC123xY/42-fix-it');
 * // ['AbC123xY']
 * ```
 */
export function extractTrelloCardShortLinks(text: string): TrelloCardShortLink[] {
  const result: TrelloCardShortLink[] = [];

  for (const match of text.matchAll(TRELLO_CARD_URL_REGEX)) {
    if (!result.includes(match[1])) {
      result.push(match[1]);
    }
  }

  return result;
}

/**
 * Parses a card reference — a Trello card link, a shortLink, or a 24-hex card id — into the value `getCard` accepts.
 *
 * @param text - The reference as typed.
 * @returns The shortLink from a link, else the trimmed input when it is a bare token, else `undefined`.
 *
 * @example
 * ```ts
 * parseTrelloCardRef('https://trello.com/c/sD7bnJf5/12-roll-out'); // 'sD7bnJf5'
 * parseTrelloCardRef('sD7bnJf5'); // 'sD7bnJf5'
 * parseTrelloCardRef('not a card'); // undefined
 * ```
 */
export function parseTrelloCardRef(text: Maybe<string>): Maybe<TrelloCardShortLink | TrelloCardId> {
  const trimmed = (text ?? '').trim();
  const linked = trimmed.length > 0 ? extractTrelloCardShortLinks(trimmed)[0] : undefined;
  return linked ?? (/^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : undefined);
}
