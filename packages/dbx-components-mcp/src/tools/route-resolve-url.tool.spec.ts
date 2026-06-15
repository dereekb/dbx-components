/**
 * Spec for `dbx_route_resolve_url`.
 *
 * Each test materialises a minimal fixture workspace under `os.tmpdir()`
 * (project.json + router file + component file), then chdirs into it so the
 * tool's filesystem reads (`apps/*\/project.json` glob, source globs,
 * component-import resolution) all run against the fixture.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRouteResolveUrl } from './route-resolve-url.tool.js';
import { resetAppPortMapCache } from './route/app-port-map.js';

const PROJECT_JSON = JSON.stringify(
  {
    name: 'demo',
    sourceRoot: 'apps/demo/src',
    targets: {
      serve: {
        executor: '@nx/angular:dev-server',
        configurations: {
          development: { port: 9010 },
          production: { port: 9010 }
        }
      }
    }
  },
  null,
  2
);

const ROUTER_FILE = `import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocInteractionLayoutComponent } from './container/layout.component';
import { DocInteractionUploadComponent } from './container/upload.component';
import { ProfilePageComponent } from './container/profile.component';
import { DeepNestedComponent } from './container/deep.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/interaction',
  name: 'doc.interaction',
  component: DocInteractionLayoutComponent
};

export const DOC_INTERACTION_UPLOAD_STATE: Ng2StateDeclaration = {
  url: '/upload',
  name: 'doc.interaction.upload',
  component: DocInteractionUploadComponent
};

export const PROFILE_STATE: Ng2StateDeclaration = {
  url: '/profile/:id',
  name: 'doc.interaction.profile',
  component: ProfilePageComponent
};

export const DEEP_STATE: Ng2StateDeclaration = {
  url: '/test/:id/mytest/{xxx:[0-9]+}',
  name: 'doc.interaction.deep',
  component: DeepNestedComponent,
  params: { extra: { dynamic: true } }
};

export const STATES: Ng2StateDeclaration[] = [
  LAYOUT_STATE,
  DOC_INTERACTION_UPLOAD_STATE,
  PROFILE_STATE,
  DEEP_STATE
];
`;

const UPLOAD_COMPONENT = `export class DocInteractionUploadComponent {}
`;

const LAYOUT_COMPONENT = `export class DocInteractionLayoutComponent {}
`;

const PROFILE_COMPONENT = `/**
 * @dbxRouteModel profile :id - The profile being viewed
 */
export class ProfilePageComponent {}
`;

const DEEP_COMPONENT = `export class DeepNestedComponent {}
`;

interface Fixture {
  readonly root: string;
  readonly originalCwd: string;
}

function setupFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'dbx-route-resolve-url-'));
  const appDir = join(root, 'apps', 'demo');
  const routerDir = join(appDir, 'src', 'app', 'modules', 'doc', 'modules', 'interaction');
  const containerDir = join(routerDir, 'container');
  mkdirSync(containerDir, { recursive: true });
  writeFileSync(join(appDir, 'project.json'), PROJECT_JSON, 'utf8');
  writeFileSync(join(routerDir, 'doc.interaction.router.ts'), ROUTER_FILE, 'utf8');
  writeFileSync(join(containerDir, 'upload.component.ts'), UPLOAD_COMPONENT, 'utf8');
  writeFileSync(join(containerDir, 'layout.component.ts'), LAYOUT_COMPONENT, 'utf8');
  writeFileSync(join(containerDir, 'profile.component.ts'), PROFILE_COMPONENT, 'utf8');
  writeFileSync(join(containerDir, 'deep.component.ts'), DEEP_COMPONENT, 'utf8');
  const originalCwd = process.cwd();
  process.chdir(root);
  resetAppPortMapCache();
  const result: Fixture = { root, originalCwd };
  return result;
}

function teardownFixture(fx: Fixture): void {
  process.chdir(fx.originalCwd);
  resetAppPortMapCache();
  rmSync(fx.root, { recursive: true, force: true });
}

describe('dbx_route_resolve_url', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = setupFixture();
  });
  afterEach(() => {
    teardownFixture(fx);
  });

  it('rejects invalid args', async () => {
    const result = await runRouteResolveUrl({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('resolves a full localhost URL to the owning state', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/upload' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('/interaction/upload → doc.interaction.upload');
    expect(text).toContain('Matched via literal URL');
    expect(text).toContain('**App:** `demo` (port 9010)');
    expect(text).toContain('**State name:** `doc.interaction.upload`');
    expect(text).toContain('**Declared as:** `DOC_INTERACTION_UPLOAD_STATE`');
    expect(text).toContain('**Component class:** `DocInteractionUploadComponent`');
    expect(text).toContain('apps/demo/src/app/modules/doc/modules/interaction/doc.interaction.router.ts:');
    expect(text).toContain('apps/demo/src/app/modules/doc/modules/interaction/container/upload.component.ts');
    expect(text).not.toContain('## Siblings');
  });

  it('includes siblings only when includeSiblings=true', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/upload', includeSiblings: true });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('## Siblings');
    expect(text).toContain('doc.interaction.profile');
  });

  it('resolves a bare path when given an app override', async () => {
    const result = await runRouteResolveUrl({ url: '/interaction/upload', app: 'demo' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('doc.interaction.upload');
    expect(result.content[0].text).toContain('Matched via literal URL');
  });

  it('errors when a bare path has no app override', async () => {
    const result = await runRouteResolveUrl({ url: '/interaction/upload' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('URL has no port');
    expect(result.content[0].text).toContain('demo');
  });

  it('errors when the port is unknown', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9999/whatever' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No app found for port `9999`');
    expect(result.content[0].text).toContain('demo=9010');
  });

  it('errors when the app override is unknown', async () => {
    const result = await runRouteResolveUrl({ url: '/foo', app: 'nope' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown app `nope`');
  });

  it('matches a param-aware path and extracts param values', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/profile/123' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('doc.interaction.profile');
    expect(text).toContain('Matched via param URL pattern');
    expect(text).toContain('## URL params (extracted)');
    expect(text).toContain('`id` = `123`');
    expect(text).toContain('## URL path params');
  });

  it('renders the Page models section from component @dbxRouteModel tags', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/profile/123' });
    const text = result.content[0].text;
    expect(text).toContain('## Page models');
    expect(text).toContain('`profile` (id) `:id` — The profile being viewed');
  });

  it('shows "None declared" in Page models for an unannotated page', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/upload' });
    const text = result.content[0].text;
    expect(text).toContain('## Page models');
    expect(text).toContain('_None declared.');
  });

  it('includes the resolved models[] in JSON output', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/profile/123', format: 'json' });
    const parsed = JSON.parse(result.content[0].text) as { models: ReadonlyArray<{ modelType: string; kind: string; keyTemplate?: string }> };
    expect(parsed.models).toEqual([{ modelType: 'profile', kind: 'id', keyTemplate: ':id', description: 'The profile being viewed' }]);
  });

  it('renders a Validation callout for an id-like param with no @dbxRouteModel binding', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/test/42/mytest/9000' });
    const text = result.content[0].text;
    expect(text).toContain('## Validation');
    expect(text).toContain('Route param `:id` has no `@dbxRouteModel` binding');
  });

  it('omits the Validation section when the id-like param is bound', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/profile/123' });
    expect(result.content[0].text).not.toContain('## Validation');
  });

  it('includes missingRouteModels[] in JSON output', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/test/42/mytest/9000', format: 'json' });
    const parsed = JSON.parse(result.content[0].text) as { missingRouteModels: string[] };
    expect(parsed.missingRouteModels).toContain('id');
  });

  it('captures `:` and `{name:type}` params from the composed URL', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/test/42/mytest/9000' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('doc.interaction.deep');
    expect(text).toContain('## URL path params');
    expect(text).toContain('- `id`');
    expect(text).toContain('- `xxx`');
    expect(text).toContain('## Declared params (state.params)');
    expect(text).toContain('- `extra`');
  });

  it('captures search params from the URL', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/upload?tab=settings' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('## Search params');
    expect(text).toContain('`tab` = `settings`');
  });

  it('returns not_found with candidates when the path does not match any state', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/nope' });
    expect(result.isError).toBe(true);
    const text = result.content[0].text;
    expect(text).toContain('No state matched');
    expect(text).toContain('Closest candidates:');
    expect(text).toContain('doc.interaction');
  });

  it('returns parseable JSON when format=json (siblings null by default)', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/upload', format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text) as {
      kind: string;
      app: { name: string; ports: number[] };
      state: { name: string; declaredAs: string; component: string };
      componentFile: { path: string } | null;
      urlParamKeys: string[];
      ancestors: { name: string }[];
      siblings: { name: string }[] | null;
    };
    expect(parsed.kind).toBe('match');
    expect(parsed.app.name).toBe('demo');
    expect(parsed.app.ports).toContain(9010);
    expect(parsed.state.name).toBe('doc.interaction.upload');
    expect(parsed.state.declaredAs).toBe('DOC_INTERACTION_UPLOAD_STATE');
    expect(parsed.state.component).toBe('DocInteractionUploadComponent');
    expect(parsed.componentFile?.path).toContain('container/upload.component.ts');
    expect(parsed.urlParamKeys).toEqual([]);
    expect(parsed.ancestors.length).toBeGreaterThanOrEqual(2);
    expect(parsed.siblings).toBeNull();
  });

  it('includes siblings array in JSON when includeSiblings=true', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/upload', format: 'json', includeSiblings: true });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text) as { siblings: { name: string }[] };
    expect(parsed.siblings.map((s) => s.name)).toContain('doc.interaction.profile');
  });

  it('reports urlParamKeys in JSON for `:` and `{name:type}` segments', async () => {
    const result = await runRouteResolveUrl({ url: 'http://localhost:9010/interaction/test/1/mytest/2', format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text) as { urlParamKeys: string[]; state: { paramKeys: string[] } };
    expect(parsed.urlParamKeys).toEqual(['id', 'xxx']);
    expect(parsed.state.paramKeys).toEqual(['extra']);
  });
});
