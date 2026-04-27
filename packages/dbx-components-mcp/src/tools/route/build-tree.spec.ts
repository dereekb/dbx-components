import { describe, expect, it } from 'vitest';
import { extractFile } from './extract.js';
import { buildRouteTree } from './build-tree.js';
import { loadRouteTree } from './index.js';

describe('buildRouteTree', () => {
  it('links three states into a single tree by dot-prefix', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';

export const STATES: Ng2StateDeclaration[] = [
  { name: 'app', url: '/' },
  { name: 'app.home', url: '/home' },
  { name: 'app.home.profile', url: '/profile' }
];
`;
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text }] });
    expect(tree.nodeCount).toBe(3);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].data.name).toBe('app');
    expect(tree.roots[0].children).toHaveLength(1);
    const home = tree.roots[0].children[0];
    expect(home.data.name).toBe('app.home');
    expect(home.children[0].data.name).toBe('app.home.profile');
  });

  it('composes full URLs from the parent chain', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'app', url: '/' },
  { name: 'app.home', url: '/home' },
  { name: 'app.home.edit', url: '/edit' }
];
`;
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text }] });
    const edit = tree.byName.get('app.home.edit');
    expect(edit?.fullUrl).toBe('/home/edit');
  });

  it('merges two files where the second supplies child states', () => {
    const rootText = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const rootState: Ng2StateDeclaration = { name: 'root', url: '/' };
export const STATES: Ng2StateDeclaration[] = [rootState];
`;
    const childText = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { rootState } from './root.router';

export const childState: Ng2StateDeclaration = {
  name: 'root.child',
  url: '/child'
};

export const STATES: Ng2StateDeclaration[] = [childState];
`;
    const tree = loadRouteTree({
      sources: [
        { name: 'root.router.ts', text: rootText },
        { name: 'child.router.ts', text: childText }
      ]
    });
    expect(tree.nodeCount).toBe(2);
    const child = tree.byName.get('root.child');
    expect(child?.parent?.data.name).toBe('root');
  });

  it('reports duplicate state names as errors', () => {
    const tree = loadRouteTree({
      sources: [
        { name: 'one.ts', text: `import { type Ng2StateDeclaration } from '@uirouter/angular';\nexport const STATES: Ng2StateDeclaration[] = [{ name: 'a', url: '/a' }];\n` },
        { name: 'two.ts', text: `import { type Ng2StateDeclaration } from '@uirouter/angular';\nexport const STATES: Ng2StateDeclaration[] = [{ name: 'a', url: '/aa' }];\n` }
      ]
    });
    const dupes = tree.issues.filter((i) => i.code === 'DUPLICATE_STATE_NAME');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].severity).toBe('error');
  });

  it('reports orphan states as warnings', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'a.b', url: '/b' }
];
`;
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text }] });
    const orphans = tree.issues.filter((i) => i.code === 'ORPHAN_STATE');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].severity).toBe('warning');
    // Orphan still appears as a root
    expect(tree.roots.map((r) => r.data.name)).toContain('a.b');
  });

  it('detects cycles introduced by explicit parent fields', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'x', url: '/x', parent: 'y' },
  { name: 'y', url: '/y', parent: 'x' }
];
`;
    const issues = buildRouteTree(extractFile({ name: 'cycle.ts', text }).nodes, []).issues;
    const cycles = issues.filter((i) => i.code === 'CYCLE_DETECTED');
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].severity).toBe('error');
  });
});
