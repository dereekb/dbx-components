import { describe, expect, it } from 'vitest';
import { updateCard } from './trello.api.card';
import { fakeTrelloContext } from './trello.fake';

describe('updateCard()', () => {
  function makeFake() {
    return fakeTrelloContext({ routes: { 'PUT /cards/c': { id: 'c' } } });
  }

  it('should clear the due date with a query "null" and send no JSON body', async () => {
    const fake = makeFake();
    await updateCard(fake.trelloContext)({ cardId: 'c', due: null });

    expect(fake.requests).toHaveLength(1);
    const request = fake.requests[0];
    expect(request.method).toBe('PUT');
    expect(request.path).toBe('/cards/c');
    expect(request.query.get('due')).toBe('null');
    expect(request.body).toBeUndefined();
  });

  it('should clear the start date with a query "null" and send no JSON body', async () => {
    const fake = makeFake();
    await updateCard(fake.trelloContext)({ cardId: 'c', start: null });

    const request = fake.requests[0];
    expect(request.method).toBe('PUT');
    expect(request.path).toBe('/cards/c');
    expect(request.query.get('start')).toBe('null');
    expect(request.body).toBeUndefined();
  });

  it('should send cleared dates in the query and every other field in the JSON body', async () => {
    const fake = makeFake();
    await updateCard(fake.trelloContext)({ cardId: 'c', due: null, start: null, name: 'Renamed', dueComplete: false, idLabels: ['l1', 'l2'] });

    const request = fake.requests[0];
    expect(request.query.get('due')).toBe('null');
    expect(request.query.get('start')).toBe('null');
    expect(request.body).toEqual({ name: 'Renamed', dueComplete: false, idLabels: 'l1,l2' });
  });

  it('should send a set date in the JSON body with no query', async () => {
    const fake = makeFake();
    await updateCard(fake.trelloContext)({ cardId: 'c', due: '2026-12-01T00:00:00.000Z' });

    const request = fake.requests[0];
    expect(request.url).toBe('https://api.trello.com/1/cards/c');
    expect(request.body).toEqual({ due: '2026-12-01T00:00:00.000Z' });
  });

  it('should send an empty label list as an empty idLabels string in the JSON body', async () => {
    const fake = makeFake();
    await updateCard(fake.trelloContext)({ cardId: 'c', idLabels: [] });

    const request = fake.requests[0];
    expect(request.url).toBe('https://api.trello.com/1/cards/c');
    expect(request.body).toEqual({ idLabels: '' });
  });
});
