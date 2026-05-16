import { Module, type DynamicModule } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectFail, expectFailAssertErrorType, itShouldFail } from '@dereekb/util/test';
import { TrelloServerFetchResponseError, type TrelloBoardId, type TrelloCardId, type TrelloListId, type TrelloMember } from '@dereekb/trello';
import { TrelloApi } from './trello.api';
import { appTrelloModuleMetadata } from './trello.module';

/**
 * Read-only live API tests for the Trello API.
 *
 * These tests require the following environment variables:
 * - `TRELLO_API_KEY` and `TRELLO_API_TOKEN` (required for module init).
 *
 * Tests against specific objects also require these fixture vars to be set:
 * - `TRELLO_TEST_BOARD_ID` — a board id readable by the test token.
 * - `TRELLO_TEST_LIST_ID` — a list id on the same test board.
 * - `TRELLO_TEST_CARD_ID` — a card id readable by the test token.
 *
 * Write-path tests (create/update/delete) will be added in a follow-up.
 */

const NON_EXISTENT_TRELLO_ID = '0000000000000000000000aa';

const TEST_BOARD_ID = process.env.TRELLO_TEST_BOARD_ID;
const TEST_LIST_ID = process.env.TRELLO_TEST_LIST_ID;
const TEST_CARD_ID = process.env.TRELLO_TEST_CARD_ID;

@Module(appTrelloModuleMetadata())
class TestTrelloModule {}

describe('trello.api', () => {
  let nest: TestingModule;
  let api: TrelloApi;

  beforeEach(async () => {
    const rootModule: DynamicModule = {
      module: TestTrelloModule,
      global: true
    };

    nest = await Test.createTestingModule({
      imports: [rootModule]
    }).compile();

    api = nest.get(TrelloApi);
  });

  describe('members', () => {
    describe('getMe()', () => {
      it('returns the authenticated user', async () => {
        const me: TrelloMember = await api.getMe();
        expect(me).toBeDefined();
        expect(me.id).toBeDefined();
        expect(me.username).toBeDefined();
      });
    });

    describe('getMember()', () => {
      it('returns the same member as getMe() when given memberId: "me"', async () => {
        const me = await api.getMe();
        const member = await api.getMember({ memberId: 'me' });

        expect(member.id).toBe(me.id);
        expect(member.username).toBe(me.username);
      });

      itShouldFail('with a TrelloServerFetchResponseError when the member does not exist', async () => {
        await expectFail(() => api.getMember({ memberId: NON_EXISTENT_TRELLO_ID }), expectFailAssertErrorType(TrelloServerFetchResponseError));
      });
    });
  });

  describe.runIf(TEST_BOARD_ID)('boards', () => {
    const boardId = TEST_BOARD_ID as TrelloBoardId;

    describe('getBoard()', () => {
      it('returns the board by id', async () => {
        const board = await api.getBoard({ boardId });
        expect(board).toBeDefined();
        expect(board.id).toBe(boardId);
        expect(board.name).toBeDefined();
      });

      itShouldFail('with a TrelloServerFetchResponseError when the board does not exist', async () => {
        await expectFail(() => api.getBoard({ boardId: NON_EXISTENT_TRELLO_ID }), expectFailAssertErrorType(TrelloServerFetchResponseError));
      });
    });

    describe('listBoardLists()', () => {
      it('returns an array of lists on the board', async () => {
        const lists = await api.listBoardLists({ boardId });
        expect(Array.isArray(lists)).toBe(true);
        lists.forEach((list) => {
          expect(list.id).toBeDefined();
          expect(list.idBoard).toBe(boardId);
        });
      });
    });

    describe('listBoardCards()', () => {
      it('returns an array of cards on the board', async () => {
        const cards = await api.listBoardCards({ boardId });
        expect(Array.isArray(cards)).toBe(true);
        cards.forEach((card) => {
          expect(card.id).toBeDefined();
          expect(card.idBoard).toBe(boardId);
        });
      });
    });

    describe('listBoardMembers()', () => {
      it('returns an array of members on the board', async () => {
        const members = await api.listBoardMembers({ boardId });
        expect(Array.isArray(members)).toBe(true);
        members.forEach((member) => {
          expect(member.id).toBeDefined();
          expect(member.username).toBeDefined();
        });
      });
    });
  });

  describe.runIf(TEST_LIST_ID)('lists', () => {
    const listId = TEST_LIST_ID as TrelloListId;

    describe('getList()', () => {
      it('returns the list by id', async () => {
        const list = await api.getList({ listId });
        expect(list).toBeDefined();
        expect(list.id).toBe(listId);
        expect(list.idBoard).toBeDefined();
      });
    });

    describe('listCardsInList()', () => {
      it('returns an array of cards in the list', async () => {
        const cards = await api.listCardsInList({ listId });
        expect(Array.isArray(cards)).toBe(true);
        cards.forEach((card) => {
          expect(card.idList).toBe(listId);
        });
      });
    });
  });

  describe.runIf(TEST_CARD_ID)('cards', () => {
    const cardId = TEST_CARD_ID as TrelloCardId;

    describe('getCard()', () => {
      it('returns the card by id', async () => {
        const card = await api.getCard({ cardId });
        expect(card).toBeDefined();
        expect(card.id).toBe(cardId);
        expect(card.idBoard).toBeDefined();
      });

      itShouldFail('with a TrelloServerFetchResponseError when the card does not exist', async () => {
        await expectFail(() => api.getCard({ cardId: NON_EXISTENT_TRELLO_ID }), expectFailAssertErrorType(TrelloServerFetchResponseError));
      });
    });
  });

  describe('webhooks', () => {
    describe('listWebhooksForToken()', () => {
      it('returns an array of webhooks for the configured token', async () => {
        const webhooks = await api.listWebhooksForToken();
        expect(Array.isArray(webhooks)).toBe(true);
        webhooks.forEach((webhook) => {
          expect(webhook.id).toBeDefined();
          expect(webhook.idModel).toBeDefined();
          expect(typeof webhook.active).toBe('boolean');
        });
      });
    });
  });
});
