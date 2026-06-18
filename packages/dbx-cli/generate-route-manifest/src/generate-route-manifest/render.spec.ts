import { describe, expect, it } from 'vitest';
import type { RouteManifestWarning, RouteSource } from '@dereekb/dbx-cli';
import { countRouteManifestGenerationErrors, extractModelTypesFromModelsInput, formatRouteManifestWarning, renderRouteManifest } from './render';

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
      version: 2,
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

describe('formatRouteManifestWarning', () => {
  it('prefixes error-severity findings with `error:`', () => {
    expect(formatRouteManifestWarning({ kind: 'malformed-tag', severity: 'error', message: 'bad tag' })).toBe('[generate-route-manifest] error: malformed-tag: bad tag');
  });

  it('prefixes warning-severity findings with `warning:`', () => {
    expect(formatRouteManifestWarning({ kind: 'missing-route-model', severity: 'warning', message: 'gap', stateName: 's', param: 'id' })).toBe('[generate-route-manifest] warning: missing-route-model: gap');
  });
});

describe('countRouteManifestGenerationErrors', () => {
  const warnings: readonly RouteManifestWarning[] = [
    { kind: 'malformed-tag', severity: 'error', message: 'm' },
    { kind: 'missing-route-model', severity: 'warning', message: 'w', param: 'id' },
    { kind: 'unknown-model-type', severity: 'warning', message: 'u' }
  ];

  it('counts only error-severity findings by default (exit-on-error)', () => {
    expect(countRouteManifestGenerationErrors({ warnings, strict: false })).toBe(1);
  });

  it('counts every finding under --strict', () => {
    expect(countRouteManifestGenerationErrors({ warnings, strict: true })).toBe(3);
  });

  it('returns 0 when only warnings are present and not strict (manifest is written)', () => {
    const warningsOnly = warnings.filter((w) => w.severity === 'warning');
    expect(countRouteManifestGenerationErrors({ warnings: warningsOnly, strict: false })).toBe(0);
  });

  it('drops allowlisted warning kinds from the count under --strict (the error still blocks)', () => {
    // Both warning kinds allowlisted → only the malformed-tag error remains.
    expect(countRouteManifestGenerationErrors({ warnings, strict: true, allowWarning: ['missing-route-model', 'unknown-model-type'] })).toBe(1);
    // A non-allowlisted warning still blocks under --strict.
    expect(countRouteManifestGenerationErrors({ warnings, strict: true, allowWarning: ['missing-route-model'] })).toBe(2);
  });

  it('never allowlists an error-severity finding (malformed-tag)', () => {
    expect(countRouteManifestGenerationErrors({ warnings, strict: false, allowWarning: ['malformed-tag'] })).toBe(1);
  });

  it('fails when non-allowlisted warnings exceed --max-warnings', () => {
    const warningsOnly = warnings.filter((w) => w.severity === 'warning'); // 2 warnings
    expect(countRouteManifestGenerationErrors({ warnings: warningsOnly, strict: false, maxWarnings: 2 })).toBe(0);
    expect(countRouteManifestGenerationErrors({ warnings: warningsOnly, strict: false, maxWarnings: 1 })).toBeGreaterThan(0);
    // --max-warnings=0 with both kinds allowlisted → still passes.
    expect(countRouteManifestGenerationErrors({ warnings: warningsOnly, strict: false, maxWarnings: 0, allowWarning: ['missing-route-model', 'unknown-model-type'] })).toBe(0);
  });
});

describe('generation failure wiring', () => {
  it('surfaces an error-severity finding for a malformed @dbxRouteModel tag, failing generation', () => {
    const badComponent = `
/**
 * @dbxRouteModel guestbook
 */
export class GuestbookListComponent {}
`;
    const badSources: readonly RouteSource[] = [
      { name: 'apps/demo/src/guestbook.router.ts', text: ROUTER },
      { name: 'apps/demo/src/list.component.ts', text: badComponent }
    ];
    const { warnings } = renderRouteManifest({ app: { name: 'demo' }, sources: badSources }, FIXED_NOW);
    expect(warnings.some((w) => w.kind === 'malformed-tag' && w.severity === 'error')).toBe(true);
    expect(countRouteManifestGenerationErrors({ warnings, strict: false })).toBeGreaterThan(0);
  });
});
