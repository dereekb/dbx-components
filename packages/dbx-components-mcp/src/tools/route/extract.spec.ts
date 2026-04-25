import { describe, expect, it } from 'vitest';
import { extractFile } from './extract.js';

describe('extractFile', () => {
  it('extracts a typed single-state const', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { HomeComponent } from './home.component';

export const homeState: Ng2StateDeclaration = {
  parent: 'root',
  url: '/home',
  name: 'app.home',
  component: HomeComponent
};
`;
    const result = extractFile({ name: 'home.router.ts', text });
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.name).toBe('app.home');
    expect(node.url).toBe('/home');
    expect(node.component).toBe('HomeComponent');
    expect(node.explicitParent).toBe('root');
    expect(node.abstract).toBe(false);
    expect(node.futureState).toBe(false);
  });

  it('extracts inline state objects from a typed STATES array', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';

export const STATES: Ng2StateDeclaration[] = [
  { name: 'a', url: '/a' },
  { name: 'a.b', url: '/b', component: BComponent }
];
`;
    const result = extractFile({ name: 'multi.router.ts', text });
    expect(result.nodes.map((n) => n.name).sort()).toEqual(['a', 'a.b']);
    const b = result.nodes.find((n) => n.name === 'a.b');
    expect(b?.component).toBe('BComponent');
  });

  it('resolves identifier references inside an array literal', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';

export const layoutState: Ng2StateDeclaration = {
  name: 'root',
  url: '/'
};
export const homeState: Ng2StateDeclaration = {
  name: 'root.home',
  url: '/home'
};

export const STATES = [layoutState, homeState];
`;
    const result = extractFile({ name: 'mixed.router.ts', text });
    expect(result.nodes.map((n) => n.name).sort()).toEqual(['root', 'root.home']);
  });

  it('extracts states from provideStates({ states: [...] })', () => {
    const text = `
import { provideStates } from '@uirouter/angular';

export const providers = [
  provideStates({
    states: [
      { name: 'p', url: '/p' },
      { name: 'p.child', url: '/c' }
    ]
  })
];
`;
    const result = extractFile({ name: 'provide.ts', text });
    expect(result.nodes.map((n) => n.name).sort()).toEqual(['p', 'p.child']);
  });

  it('extracts states from UIRouterModule.forChild({ states })', () => {
    const text = `
import { UIRouterModule } from '@uirouter/angular';

export const STATES = [
  { name: 'm', url: '/m' }
];

@NgModule({
  imports: [UIRouterModule.forChild({ states: STATES })]
})
export class FooModule {}
`;
    const result = extractFile({ name: 'foo.module.ts', text });
    expect(result.nodes.map((n) => n.name)).toContain('m');
  });

  it('captures abstract, redirectTo, and future-state markers', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';

export const layoutState: Ng2StateDeclaration = {
  name: 'app',
  url: '/',
  abstract: true,
  redirectTo: 'app.home'
};

export const futureState: Ng2StateDeclaration = {
  name: 'app.lazy.**',
  url: '/lazy'
};
`;
    const result = extractFile({ name: 'flags.router.ts', text });
    const layout = result.nodes.find((n) => n.name === 'app');
    expect(layout?.abstract).toBe(true);
    expect(layout?.redirectTo).toBe('app.home');
    const lazy = result.nodes.find((n) => n.name === 'app.lazy.**');
    expect(lazy?.futureState).toBe(true);
  });

  it('records params and resolve keys', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';

export const detailState: Ng2StateDeclaration = {
  name: 'detail',
  url: '/detail/:id',
  params: { id: { type: 'string' }, mode: { type: 'string' } },
  resolve: { profile: () => null, settings: () => null }
};
`;
    const result = extractFile({ name: 'detail.router.ts', text });
    expect(result.nodes[0].paramKeys.sort()).toEqual(['id', 'mode']);
    expect(result.nodes[0].resolveKeys.sort()).toEqual(['profile', 'settings']);
  });

  it('reports states with a non-string-literal name as info issues', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
const NAME = 'dynamic.state';

export const dynState: Ng2StateDeclaration = {
  name: NAME,
  url: '/d'
};
`;
    const result = extractFile({ name: 'dynamic.router.ts', text });
    expect(result.nodes).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'DYNAMIC_STATE_NAME' && i.severity === 'info')).toBe(true);
  });
});
