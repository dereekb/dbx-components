import { Module, type DynamicModule } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { expectFail, expectFailAssertErrorType, itShouldFail } from '@dereekb/util/test';
import { TrelloServerFetchResponseError, type TrelloBoardId, type TrelloCard, type TrelloCardId, type TrelloCommentCardActionData, type TrelloLabelId, type TrelloListId, type TrelloMember } from '@dereekb/trello';
import { TrelloApi } from './trello.api';
import { appTrelloModuleMetadata } from './trello.module';

/**
 * Live API tests for the Trello API.
 *
 * These tests require the following environment variables:
 * - `TRELLO_API_KEY` and `TRELLO_API_TOKEN` (required for module init).
 *
 * The board-specific tests additionally require:
 * - `TRELLO_TEST_BOARD_ID` — a board id (or 8-char shortLink) readable+writable by the
 *   test token. The board must contain at least one label and a list named `test-list`.
 *   All list- and card-specific fixtures are resolved (or created) dynamically against
 *   that board — no additional env vars are needed.
 */

const NON_EXISTENT_TRELLO_ID = '0000000000000000000000aa';

const TEST_BOARD_ID = process.env.TRELLO_TEST_BOARD_ID;

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
    // May be either a canonical 24-char board id or an 8-char shortLink (e.g. "lDnRQCp7").
    // Trello's API accepts both in URLs but always returns the canonical id in payloads.
    const boardId = TEST_BOARD_ID as TrelloBoardId;

    describe('getBoard()', () => {
      it('returns the board by id', async () => {
        const board = await api.getBoard({ boardId });
        expect(board).toBeDefined();
        expect(board.id).toBeDefined();
        expect(board.name).toBeDefined();
      });

      itShouldFail('with a TrelloServerFetchResponseError when the board does not exist', async () => {
        await expectFail(() => api.getBoard({ boardId: NON_EXISTENT_TRELLO_ID }), expectFailAssertErrorType(TrelloServerFetchResponseError));
      });
    });

    describe('listBoardLists()', () => {
      it('returns an array of lists on the board', async () => {
        const board = await api.getBoard({ boardId });
        const lists = await api.listBoardLists({ boardId });
        expect(Array.isArray(lists)).toBe(true);
        lists.forEach((list) => {
          expect(list.id).toBeDefined();
          expect(list.idBoard).toBe(board.id);
        });
      });
    });

    describe('listBoardCards()', () => {
      it('returns an array of cards on the board', async () => {
        const board = await api.getBoard({ boardId });
        const cards = await api.listBoardCards({ boardId });
        expect(Array.isArray(cards)).toBe(true);
        cards.forEach((card) => {
          expect(card.id).toBeDefined();
          expect(card.idBoard).toBe(board.id);
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

    describe('listBoardLabels()', () => {
      it('returns an array of labels on the board', async () => {
        const board = await api.getBoard({ boardId });
        const labels = await api.listBoardLabels({ boardId });
        expect(Array.isArray(labels)).toBe(true);
        labels.forEach((label) => {
          expect(label.id).toBeDefined();
          expect(label.idBoard).toBe(board.id);
        });
      });
    });

    describe('the "test-list" list', () => {
      const TEST_LIST_NAME = 'test-list';
      let listId: TrelloListId;

      beforeEach(async () => {
        const lists = await api.listBoardLists({ boardId });
        const testList = lists.find((list) => list.name === TEST_LIST_NAME);

        if (!testList) {
          throw new Error(`Could not find a list named "${TEST_LIST_NAME}" on board ${boardId}.`);
        }

        listId = testList.id;
      });

      describe('getList()', () => {
        it('returns the list by id', async () => {
          const list = await api.getList({ listId });
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

    describe('cards on the "test-list" list', () => {
      const TEST_LIST_NAME = 'test-list';
      let testListId: TrelloListId;

      beforeEach(async () => {
        const lists = await api.listBoardLists({ boardId });
        const testList = lists.find((list) => list.name === TEST_LIST_NAME);

        if (!testList) {
          throw new Error(`Could not find a list named "${TEST_LIST_NAME}" on board ${boardId}. Create one to run card CRUD tests.`);
        }

        testListId = testList.id;
      });

      afterAll(async () => {
        if (!testListId) return;
        const cards = await api.listCardsInList({ listId: testListId, filter: 'all' });
        await Promise.all(cards.map((card) => api.deleteCard({ cardId: card.id })));
      });

      describe('createCard()', () => {
        it('creates a card on the list', async () => {
          const created = await api.createCard({ idList: testListId, name: `create test ${Date.now()}` });
          expect(created.id).toBeDefined();
          expect(created.idList).toBe(testListId);
          expect(created.closed).toBe(false);
        });
      });

      describe('with an existing card', () => {
        let cardId: TrelloCardId;
        let createdCard: TrelloCard;

        beforeEach(async () => {
          createdCard = await api.createCard({ idList: testListId, name: `existing card ${Date.now()}` });
          cardId = createdCard.id;
        });

        describe('getCard()', () => {
          it('returns the card with idChecklists, dateLastActivity, and badges populated', async () => {
            const card = await api.getCard({ cardId });
            expect(card.id).toBe(cardId);
            expect(Array.isArray(card.idChecklists)).toBe(true);
            expect(card.dateLastActivity).toBeDefined();
            expect(card.badges).toBeDefined();
            expect(typeof card.badges?.attachments).toBe('number');
            expect(typeof card.badges?.comments).toBe('number');
          });

          itShouldFail('with a TrelloServerFetchResponseError when the card does not exist', async () => {
            await expectFail(() => api.getCard({ cardId: NON_EXISTENT_TRELLO_ID }), expectFailAssertErrorType(TrelloServerFetchResponseError));
          });
        });

        describe('updateCard()', () => {
          it('renames the card', async () => {
            const renamed = await api.updateCard({ cardId, name: `${createdCard.name} (renamed)` });
            expect(renamed.name).toBe(`${createdCard.name} (renamed)`);
          });

          it('archives the card when closed=true', async () => {
            const archived = await api.updateCard({ cardId, closed: true });
            expect(archived.closed).toBe(true);
          });

          describe('with an archived card', () => {
            beforeEach(async () => {
              await api.updateCard({ cardId, closed: true });
            });

            it('un-archives the card when closed=false', async () => {
              const unarchived = await api.updateCard({ cardId, closed: false });
              expect(unarchived.closed).toBe(false);
            });
          });
        });

        describe('deleteCard()', () => {
          it('deletes the card', async () => {
            await expect(api.deleteCard({ cardId })).resolves.toBeUndefined();
          });
        });

        describe('listCardActions()', () => {
          it('returns actions on the card including the createCard event', async () => {
            const actions = await api.listCardActions({ cardId, filter: 'all' });
            expect(Array.isArray(actions)).toBe(true);

            const createAction = actions.find((a) => a.type === 'createCard');
            expect(createAction).toBeDefined();
            expect(createAction?.id).toBeDefined();
            expect(createAction?.date).toBeDefined();
            expect(createAction?.idMemberCreator).toBeDefined();
          });

          describe('with a comment on the card', () => {
            let commentText: string;
            let commentId: string;

            beforeEach(async () => {
              commentText = `listCardActions comment ${Date.now()}`;
              const posted = await api.addCommentToCard({ cardId, text: commentText });
              commentId = posted.id;
            });

            it('returns typed comment actions when filter="commentCard"', async () => {
              const comments = await api.listCardActions<TrelloCommentCardActionData>({ cardId, filter: 'commentCard', limit: 1000 });
              expect(Array.isArray(comments)).toBe(true);

              const match = comments.find((c) => c.id === commentId);
              expect(match).toBeDefined();
              expect(match?.type).toBe('commentCard');
              expect(match?.idMemberCreator).toBeDefined();
              expect(match?.date).toBeDefined();
              expect(match?.data.text).toBe(commentText);
              expect(match?.data.card.id).toBe(cardId);
            });
          });
        });

        describe('addCommentToCard()', () => {
          it('posts a comment and returns it as a commentCard action', async () => {
            const text = `addCommentToCard test ${Date.now()}`;
            const action = await api.addCommentToCard({ cardId, text });

            expect(action.id).toBeDefined();
            expect(action.type).toBe('commentCard');
            expect(action.idMemberCreator).toBeDefined();
            expect(action.data.text).toBe(text);
            expect(action.data.card.id).toBe(cardId);
          });
        });

        describe('addLabelToCard()', () => {
          describe('a label exists on the board', () => {
            let labelId: TrelloLabelId;

            beforeEach(async () => {
              const labels = await api.listBoardLabels({ boardId });
              if (labels.length === 0) {
                throw new Error(`No labels found on board ${boardId}. Add at least one label to run addLabelToCard tests.`);
              }
              labelId = labels[0].id;
            });

            it('adds the label to the card', async () => {
              const result = await api.addLabelToCard({ cardId, labelId });
              expect(result).toContain(labelId);
            });
          });
        });
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
