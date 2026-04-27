import { describe, expect, it } from 'vitest';
import { formatRouteTree } from './format.js';
import { loadRouteTree } from './index.js';

const SAMPLE_TEXT = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'app', url: '/' },
  { name: 'app.home', url: '/home' },
  { name: 'app.home.edit', url: '/edit' },
  { name: 'app.home.edit.deep', url: '/deep' }
];
`;

describe('formatRouteTree', () => {
  it('produces a markdown tree by default', () => {
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    const text = formatRouteTree({ tree, format: 'markdown', depthLimit: undefined, title: 'sample' });
    expect(text).toContain('# State tree (sample)');
    expect(text).toContain('**app**');
    expect(text).toContain('**app.home**');
    expect(text).toContain('**app.home.edit**');
    expect(text).toContain('**app.home.edit.deep**');
  });

  it('truncates by depth_limit', () => {
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    const text = formatRouteTree({ tree, format: 'markdown', depthLimit: 1, title: 'sample' });
    expect(text).toContain('**app**');
    expect(text).toContain('**app.home**');
    expect(text).not.toContain('**app.home.edit**');
    expect(text).toContain('hidden by depth_limit');
  });

  it('round-trips through JSON.parse for format=json', () => {
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    const text = formatRouteTree({ tree, format: 'json', depthLimit: undefined, title: 'sample' });
    const parsed = JSON.parse(text) as { readonly nodeCount: number; readonly roots: ReadonlyArray<{ readonly name: string; readonly children: ReadonlyArray<{ readonly name: string }> }> };
    expect(parsed.nodeCount).toBe(4);
    expect(parsed.roots).toHaveLength(1);
    expect(parsed.roots[0].name).toBe('app');
    expect(parsed.roots[0].children[0].name).toBe('app.home');
  });

  it('emits a flat listing for format=flat', () => {
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    const text = formatRouteTree({ tree, format: 'flat', depthLimit: undefined, title: 'sample' });
    const lines = text.split('\n').filter((l) => l.includes('\t'));
    const names = lines.map((l) => l.split('\t')[0]);
    expect(names).toEqual(['app', 'app.home', 'app.home.edit', 'app.home.edit.deep']);
  });

  it('appends an Issues section when issues are present', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'lone.child', url: '/lc' }
];
`;
    const tree = loadRouteTree({ sources: [{ name: 'a.ts', text }] });
    const out = formatRouteTree({ tree, format: 'markdown', depthLimit: undefined, title: 't' });
    expect(out).toContain('## Issues');
    expect(out).toContain('ORPHAN_STATE');
  });
});
