import { describe, expect, it } from 'vitest';
import { parseRouteModelTag } from './route-models-extract.js';

describe('parseRouteModelTag', () => {
  it('parses an id key template from a :param', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'profile :uid' });
    expect(result).toEqual({ ok: true, model: { modelType: 'profile', kind: 'id', keyTemplate: ':uid', description: undefined, routeParams: ['uid'] } });
  });

  it('parses an id key template from {authUid} with no route params', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'profile {authUid}' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.kind).toBe('id');
      expect(result.model.keyTemplate).toBe('{authUid}');
      expect(result.model.routeParams).toEqual([]);
    }
  });

  it('splits a description at the first " - "', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'guestbook :id - The guestbook - with dashes' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.modelType).toBe('guestbook');
      expect(result.model.keyTemplate).toBe(':id');
      expect(result.model.description).toBe('The guestbook - with dashes');
    }
  });

  it('parses a multi-segment subcollection key template', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'guestbookEntry gb/:id/gbe/{authUid}' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.kind).toBe('key');
      expect(result.model.keyTemplate).toBe('gb/:id/gbe/{authUid}');
      expect(result.model.routeParams).toEqual(['id']);
    }
  });

  it('parses a list tag with no key template', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModelList', text: 'guestbook - Published entries' });
    expect(result).toEqual({ ok: true, model: { modelType: 'guestbook', kind: 'list', description: 'Published entries', routeParams: [] } });
  });

  it('rejects a model tag missing a key template', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'profile' });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid model type', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: '9bad :id' });
    expect(result.ok).toBe(false);
  });

  it('rejects a single-segment key template that is not a placeholder', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'profile uid' });
    expect(result.ok).toBe(false);
  });

  it('rejects an odd-segment-count key template', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModel', text: 'thing gb/:id/extra' });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown tag name', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModelWeird', text: 'profile :id' });
    expect(result.ok).toBe(false);
  });

  it('rejects a list tag with extra tokens', () => {
    const result = parseRouteModelTag({ name: 'dbxRouteModelList', text: 'profile :id' });
    expect(result.ok).toBe(false);
  });
});
