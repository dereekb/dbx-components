import { describe, expect, it } from 'vitest';
import { runRouteSearch } from './route-search.tool.js';

const SAMPLE_TEXT = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'app', url: '/' },
  { name: 'app.admin', url: '/admin', component: AdminLayoutComponent },
  { name: 'app.admin.users', url: '/users', component: AdminUsersPageComponent, resolve: { user: () => null } },
  { name: 'app.public', url: '/public', component: PublicPageComponent }
];
`;

describe('dbx_route_search', () => {
  it('returns isError when query is missing', async () => {
    const result = await runRouteSearch({ sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns isError when no source input is given', async () => {
    const result = await runRouteSearch({ query: 'admin' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('at least one of');
  });

  it('finds states by name token', async () => {
    const result = await runRouteSearch({ query: 'admin', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('app.admin');
    expect(result.content[0].text).toContain('app.admin.users');
  });

  it('finds states by url segment', async () => {
    const result = await runRouteSearch({ query: 'public', scope: 'url', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.content[0].text).toContain('app.public');
    expect(result.content[0].text).not.toContain('app.admin.users');
  });

  it('finds states by component class name', async () => {
    const result = await runRouteSearch({ query: 'AdminLayoutComponent', scope: 'component', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.content[0].text).toContain('app.admin');
    expect(result.content[0].text).not.toContain('app.public');
  });

  it('finds states by resolve key', async () => {
    const result = await runRouteSearch({ query: 'user', scope: 'resolve', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.content[0].text).toContain('app.admin.users');
  });

  it('reports zero matches gracefully', async () => {
    const result = await runRouteSearch({ query: 'zzzzz', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.content[0].text).toContain('No matches');
  });
});
