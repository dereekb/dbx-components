import { describe, expect, it } from 'vitest';
import { makeTrelloWriteRequest, TRELLO_CLEAR_FIELD_VALUE } from './trello.api.write';

describe('makeTrelloWriteRequest()', () => {
  it('should send a cleared field in the query and no body when nothing else is set', () => {
    const result = makeTrelloWriteRequest({ path: '/cards/c', params: { due: null } });
    expect(result.path).toBe('/cards/c?due=null');
    expect(result.body).toBeUndefined();
  });

  it('should send every cleared field in the query and keep the other fields in the body', () => {
    const result = makeTrelloWriteRequest({ path: '/cards/c', params: { due: null, start: null, name: 'n' } });
    expect(result.path).toBe('/cards/c?due=null&start=null');
    expect(result.body).toEqual({ name: 'n' });
  });

  it('should keep empty strings, false and 0 in the body and drop undefined values', () => {
    const result = makeTrelloWriteRequest({ path: '/cards/c', params: { name: 'n', desc: '', closed: false, pos: 0, due: undefined } });
    expect(result.path).toBe('/cards/c');
    expect(result.body).toEqual({ name: 'n', desc: '', closed: false, pos: 0 });
    expect(result.body).not.toHaveProperty('due');
  });

  it('should return the path unchanged and no body for empty params', () => {
    const result = makeTrelloWriteRequest({ path: '/cards/c', params: {} });
    expect(result.path).toBe('/cards/c');
    expect(result.body).toBeUndefined();
  });

  it('should never put a null value in the body', () => {
    const result = makeTrelloWriteRequest({ path: '/cards/c', params: { due: null, start: null, dueReminder: null, idMember: null, name: 'n', desc: '' } });
    expect(Object.values(result.body ?? {})).not.toContain(null);
    expect(TRELLO_CLEAR_FIELD_VALUE).toBe('null');
  });
});
