import { describe, expect, it } from 'vitest';
import { extractTrelloCardShortLinks, parseTrelloCardRef } from './trello.card.ref';

describe('extractTrelloCardShortLinks()', () => {
  it('returns every linked shortLink, deduped in first-seen order', () => {
    const text = 'see https://trello.com/c/AbC123xY/42-fix-it and http://trello.com/c/Zz9 then https://trello.com/c/AbC123xY again';
    expect(extractTrelloCardShortLinks(text)).toEqual(['AbC123xY', 'Zz9']);
  });

  it('returns an empty array when there are no links', () => {
    expect(extractTrelloCardShortLinks('no cards here')).toEqual([]);
  });
});

describe('parseTrelloCardRef()', () => {
  it('parses a card link', () => {
    expect(parseTrelloCardRef('https://trello.com/c/sD7bnJf5/12-roll-out')).toBe('sD7bnJf5');
  });

  it('accepts a bare shortLink or id', () => {
    expect(parseTrelloCardRef(' sD7bnJf5 ')).toBe('sD7bnJf5');
    expect(parseTrelloCardRef('5f1e0c3a9b8d7e6f5a4b3c2d')).toBe('5f1e0c3a9b8d7e6f5a4b3c2d');
  });

  it('rejects anything else', () => {
    expect(parseTrelloCardRef('not a card')).toBeUndefined();
    expect(parseTrelloCardRef(undefined)).toBeUndefined();
    expect(parseTrelloCardRef('')).toBeUndefined();
  });
});
