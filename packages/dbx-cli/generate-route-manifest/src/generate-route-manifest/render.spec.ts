import { describe, expect, it } from 'vitest';
import type { RouteSource } from '@dereekb/dbx-cli';
import { extractModelTypesFromModelsInput, renderRouteManifest } from './render';

const FIXED_NOW = new Date('2026-05-25T00:00:00.000Z');

const ROUTER = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { GuestbookListComponent } from './list.component';

/**
 * @dbxRouteModelList guestbook
 */
export const GUESTBOOK_LIST_STATE: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.list',
  url: '/guestbook',
  component: GuestbookListComponent
};

export const GUESTBOOK_ITEM_STATE: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.list.guestbook',
  url: '/:id'
};

export const STATES: Ng2StateDeclaration[] = [GUESTBOOK_LIST_STATE, GUESTBOOK_ITEM_STATE];
`;

const LIST_COMPONENT = `
/**
 * @dbxRouteModel guestbook :id - The guestbook
 */
export class GuestbookListComponent {}
`;

function sources(): readonly RouteSource[] {
  return [
    { name: 'apps/demo/src/guestbook.router.ts', text: ROUTER },
    { name: 'apps/demo/src/list.component.ts', text: LIST_COMPONENT }
  ];
}

describe('renderRouteManifest', () => {
  it('renders a stable manifest for a guestbook fixture', () => {
    const { manifest } = renderRouteManifest({ app: { name: 'demo', baseUrl: 'https://demo.example.co' }, sources: sources() }, FIXED_NOW);
    expect(manifest).toEqual({
      version: 1,
      generatedAt: '2026-05-25T00:00:00.000Z',
      app: { name: 'demo', baseUrl: 'https://demo.example.co' },
      states: [
        {
          name: 'demo.app.guestbook.list',
          url: '/guestbook',
          fullUrl: '/guestbook',
          paramKeys: [],
          urlParamKeys: [],
          component: 'GuestbookListComponent',
          componentFile: 'apps/demo/src/list.component.ts',
          models: [{ modelType: 'guestbook', kind: 'list' }]
        },
        {
          name: 'demo.app.guestbook.list.guestbook',
          url: '/:id',
          fullUrl: '/guestbook/:id',
          parentName: 'demo.app.guestbook.list',
          paramKeys: [],
          urlParamKeys: ['id'],
          models: [{ modelType: 'guestbook', kind: 'list', from: 'demo.app.guestbook.list' }]
        }
      ]
    });
  });

  it('passes model types from a models-input through to unknown-model-type validation', () => {
    const { warnings } = renderRouteManifest({ app: { name: 'demo' }, sources: sources(), modelTypes: ['profile'] }, FIXED_NOW);
    expect(warnings.some((w) => w.kind === 'unknown-model-type' && w.modelType === 'guestbook')).toBe(true);
  });
});

describe('extractModelTypesFromModelsInput', () => {
  it('reads modelType from each model entry', () => {
    expect(extractModelTypesFromModelsInput({ models: [{ modelType: 'guestbook' }, { modelType: 'profile' }] })).toEqual(['guestbook', 'profile']);
  });

  it('returns an empty list for an unrecognized shape', () => {
    expect(extractModelTypesFromModelsInput({})).toEqual([]);
    expect(extractModelTypesFromModelsInput(null)).toEqual([]);
  });
});
