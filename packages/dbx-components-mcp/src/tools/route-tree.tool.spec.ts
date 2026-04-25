import { describe, expect, it } from 'vitest';
import { runRouteTree } from './route-tree.tool.js';

describe('dbx_route_tree', () => {
  it('returns isError when no input form is supplied', async () => {
    const result = await runRouteTree({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('at least one of');
  });

  it('returns isError for malformed sources payload', async () => {
    const result = await runRouteTree({ sources: [{ name: 'x.ts' }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('renders a markdown tree from inline sources', async () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'a', url: '/a' },
  { name: 'a.b', url: '/b' }
];
`;
    const result = await runRouteTree({ sources: [{ name: 'a.ts', text }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# State tree');
    expect(result.content[0].text).toContain('**a**');
    expect(result.content[0].text).toContain('**a.b**');
  });

  it('respects format=json with a parseable payload', async () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'a', url: '/a' }
];
`;
    const result = await runRouteTree({ sources: [{ name: 'a.ts', text }], format: 'json' });
    const parsed = JSON.parse(result.content[0].text) as { readonly nodeCount: number };
    expect(parsed.nodeCount).toBe(1);
  });

  it('rejects path traversal in cwd', async () => {
    const result = await runRouteTree({ paths: ['demo.router.ts'], cwd: '../../../etc' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('outside the server cwd');
  });
});
