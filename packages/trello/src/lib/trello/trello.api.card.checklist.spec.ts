import { describe, expect, it, vi } from 'vitest';
import { type TrelloContext } from './trello.factory';
import { fakeTrelloContext } from './trello.fake';
import { addCheckItemToChecklist, addChecklistToCard, deleteChecklist, deleteCheckItemFromCard, getChecklist, listCardChecklists, updateCardCheckItem, updateChecklist } from './trello.api.card.checklist';

function stubContext() {
  const fetchJson = vi.fn().mockResolvedValue({});
  const context = { fetchJson } as unknown as TrelloContext;
  return { context, fetchJson };
}

describe('trello.api.card.checklist', () => {
  describe('listCardChecklists()', () => {
    it('maps checkItemFields to checkItem_fields', async () => {
      const { context, fetchJson } = stubContext();
      await listCardChecklists(context)({ cardId: 'c', checkItems: 'all', checkItemFields: 'name,state' });
      expect(fetchJson).toHaveBeenCalledWith('/cards/c/checklists?checkItems=all&checkItem_fields=name%2Cstate', 'GET');
    });

    it('drops empty values from the query', async () => {
      const { context, fetchJson } = stubContext();
      await listCardChecklists(context)({ cardId: 'c' });
      expect(fetchJson).toHaveBeenCalledWith('/cards/c/checklists?', 'GET');
    });
  });

  describe('getChecklist()', () => {
    it('requests the checklist with its query', async () => {
      const { context, fetchJson } = stubContext();
      await getChecklist(context)({ checklistId: 'k', checkItems: 'none', fields: 'name' });
      expect(fetchJson).toHaveBeenCalledWith('/checklists/k?checkItems=none&fields=name', 'GET');
    });
  });

  describe('addChecklistToCard()', () => {
    it('posts the checklist params as a query', async () => {
      const { context, fetchJson } = stubContext();
      await addChecklistToCard(context)({ cardId: 'c', name: 'Acceptance', pos: 'top' });
      expect(fetchJson).toHaveBeenCalledWith('/cards/c/checklists?name=Acceptance&pos=top', 'POST');
    });
  });

  describe('updateChecklist()', () => {
    it('puts a JSON body', async () => {
      const { context, fetchJson } = stubContext();
      await updateChecklist(context)({ checklistId: 'k', name: 'Renamed' });
      expect(fetchJson).toHaveBeenCalledWith('/checklists/k', 'PUT', { name: 'Renamed' });
    });
  });

  describe('deleteChecklist()', () => {
    it('deletes the checklist', async () => {
      const { context, fetchJson } = stubContext();
      await expect(deleteChecklist(context)({ checklistId: 'k' })).resolves.toBeUndefined();
      expect(fetchJson).toHaveBeenCalledWith('/checklists/k', 'DELETE');
    });
  });

  describe('addCheckItemToChecklist()', () => {
    it('posts the item params as a query', async () => {
      const { context, fetchJson } = stubContext();
      await addCheckItemToChecklist(context)({ checklistId: 'k', name: 'Write the spec', checked: true, pos: 'bottom' });
      expect(fetchJson).toHaveBeenCalledWith('/checklists/k/checkItems?name=Write+the+spec&checked=true&pos=bottom', 'POST');
    });
  });

  describe('updateCardCheckItem()', () => {
    it('puts a JSON body', async () => {
      const { context, fetchJson } = stubContext();
      await updateCardCheckItem(context)({ cardId: 'c', checkItemId: 'i', state: 'complete' });
      expect(fetchJson).toHaveBeenCalledWith('/cards/c/checkItem/i', 'PUT', { state: 'complete' });
    });

    it('sends cleared fields as a query "null" and keeps the rest in the JSON body', async () => {
      const fake = fakeTrelloContext({ routes: { 'PUT /cards/c/checkItem/i': { id: 'i' } } });
      await updateCardCheckItem(fake.trelloContext)({ cardId: 'c', checkItemId: 'i', due: null, dueReminder: null, idMember: null, state: 'complete' });

      const request = fake.requests[0];
      expect(request.method).toBe('PUT');
      expect(request.path).toBe('/cards/c/checkItem/i');
      expect(request.query.get('due')).toBe('null');
      expect(request.query.get('dueReminder')).toBe('null');
      expect(request.query.get('idMember')).toBe('null');
      expect(request.body).toEqual({ state: 'complete' });
    });
  });

  describe('deleteCheckItemFromCard()', () => {
    it('deletes the item', async () => {
      const { context, fetchJson } = stubContext();
      await expect(deleteCheckItemFromCard(context)({ cardId: 'c', checkItemId: 'i' })).resolves.toBeUndefined();
      expect(fetchJson).toHaveBeenCalledWith('/cards/c/checkItem/i', 'DELETE');
    });
  });
});
