import { describe, expect, it } from 'vitest';
import type { CssUtilityEntry } from '../manifest/css-utilities-schema.js';
import { createCssUtilityRegistryFromEntries, parseDeclarations } from './css-utilities-runtime.js';

const ENTRIES: readonly CssUtilityEntry[] = [
  {
    slug: 'flex-bar',
    selector: '.dbx-flex-bar',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/flex/_flex.scss',
    line: 9,
    declarations: [
      { property: 'display', value: 'flex' },
      { property: 'align-items', value: 'center' },
      { property: 'overflow-x', value: 'auto' },
      { property: 'overflow-y', value: 'hidden' }
    ],
    role: 'flex',
    intent: 'horizontal action bar'
  },
  {
    slug: 'flex-center',
    selector: '.dbx-flex-center',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/flex/_flex.scss',
    line: 26,
    declarations: [
      { property: 'display', value: 'flex' },
      { property: 'align-items', value: 'center' },
      { property: 'justify-content', value: 'center' }
    ],
    role: 'flex',
    intent: 'center children both axes'
  },
  {
    slug: 'flex-fill-0',
    selector: '.dbx-flex-fill-0',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/flex/_flex.scss',
    line: 44,
    declarations: [
      { property: 'flex', value: '1' },
      { property: 'min-width', value: '0' }
    ],
    role: 'flex',
    intent: 'fill remaining space and allow children to truncate'
  },
  {
    slug: 'flex-fill',
    selector: '.dbx-flex-fill',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/flex/_flex.scss',
    line: 38,
    declarations: [{ property: 'flex', value: '1' }],
    role: 'flex',
    intent: 'fill remaining space inside a flex container'
  },
  {
    slug: 'flex-column',
    selector: '.dbx-flex-column',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/flex/_flex.scss',
    line: 32,
    declarations: [
      { property: 'display', value: 'flex' },
      { property: 'flex-direction', value: 'column' }
    ],
    role: 'flex',
    intent: 'vertical flex stack'
  }
];

describe('parseDeclarations', () => {
  it('parses semi-colon separated declarations into a property→value map', () => {
    const map = parseDeclarations('display: flex; align-items: center; gap: 8px');
    expect(map.size).toBe(3);
    expect(map.get('display')).toBe('flex');
    expect(map.get('align-items')).toBe('center');
    expect(map.get('gap')).toBe('8px');
  });

  it('lowercases property names and collapses whitespace in values', () => {
    const map = parseDeclarations('  Display:   FLEX ; Min-Width:  0  ;');
    expect(map.get('display')).toBe('flex');
    expect(map.get('min-width')).toBe('0');
  });
});

describe('createCssUtilityRegistryFromEntries', () => {
  it('looks up entries by selector and slug', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    expect(registry.findByName('.dbx-flex-fill-0')?.slug).toBe('flex-fill-0');
    expect(registry.findByName('dbx-flex-fill-0')?.slug).toBe('flex-fill-0');
    expect(registry.findByName('flex-fill-0')?.slug).toBe('flex-fill-0');
  });

  it('returns dbx-flex-fill-0 as the top match for "flex: 1; min-width: 0;"', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.searchByDeclarations('flex: 1; min-width: 0;');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].entry.slug).toBe('flex-fill-0');
  });

  it('returns dbx-flex-bar as a strong candidate for the bar pattern', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.searchByDeclarations('display: flex; align-items: center; overflow-x: auto; overflow-y: hidden;');
    const top = matches[0];
    expect(top.entry.slug).toBe('flex-bar');
  });

  it('finds candidates by intent substring', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.findByIntent('vertical flex stack');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].entry.slug).toBe('flex-column');
  });

  it('returns empty array when raw declarations are empty', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    expect(registry.searchByDeclarations('')).toEqual([]);
  });
});

describe('createCssUtilityRegistryFromEntries — parent grouping', () => {
  const PARENT_ENTRIES: readonly CssUtilityEntry[] = [
    {
      slug: 'list-two-line-item',
      selector: '.dbx-list-two-line-item',
      source: '@dereekb/dbx-web',
      module: '@dereekb/dbx-web',
      file: 'src/lib/layout/list/_list.scss',
      line: 10,
      declarations: [
        { property: 'display', value: 'flex' },
        { property: 'flex-direction', value: 'row' },
        { property: 'align-items', value: 'center' }
      ],
      role: 'layout',
      intent: 'two-line list row'
    },
    {
      slug: 'list-two-line-item-icon',
      selector: '.dbx-list-two-line-item-icon',
      source: '@dereekb/dbx-web',
      module: '@dereekb/dbx-web',
      file: 'src/lib/layout/list/_list.scss',
      line: 20,
      declarations: [{ property: 'padding', value: '0 16px' }],
      role: 'layout',
      intent: 'leading-icon slot for two-line list rows',
      parent: 'list-two-line-item'
    },
    {
      slug: 'list-two-line-item-title',
      selector: '.dbx-list-two-line-item-title',
      source: '@dereekb/dbx-web',
      module: '@dereekb/dbx-web',
      file: 'src/lib/layout/list/_list.scss',
      line: 30,
      declarations: [{ property: 'font-weight', value: 'bold' }],
      role: 'text',
      intent: 'title slot for two-line list rows',
      parent: 'list-two-line-item'
    }
  ];

  it('builds a byParent index keyed by parent slug', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const children = registry.byParent.get('list-two-line-item');
    expect(children?.length).toBe(2);
    expect(children?.map((c) => c.slug)).toEqual(['list-two-line-item-icon', 'list-two-line-item-title']);
  });

  it('findChildrenOf returns children sorted by slug', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const children = registry.findChildrenOf('list-two-line-item');
    expect(children.map((c) => c.slug)).toEqual(['list-two-line-item-icon', 'list-two-line-item-title']);
  });

  it('findChildrenOf returns empty for an unknown parent', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    expect(registry.findChildrenOf('does-not-exist')).toEqual([]);
  });

  it('findByIntent excludes children by default', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.findByIntent('two-line list');
    expect(matches.map((m) => m.entry.slug)).toEqual(['list-two-line-item']);
  });

  it('findByIntent re-includes children when includeChildren is true', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.findByIntent('two-line list', { includeChildren: true });
    const slugs = matches.map((m) => m.entry.slug).sort((a, b) => a.localeCompare(b));
    expect(slugs).toEqual(['list-two-line-item', 'list-two-line-item-icon', 'list-two-line-item-title']);
  });

  it("findByIntent scoped to parent returns only that parent's children", () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.findByIntent('list', { parent: 'list-two-line-item' });
    expect(matches.map((m) => m.entry.slug).sort((a, b) => a.localeCompare(b))).toEqual(['list-two-line-item-icon', 'list-two-line-item-title']);
  });

  it('searchByDeclarations excludes children by default', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.searchByDeclarations('padding: 0 16px;');
    expect(matches.every((m) => m.entry.parent === undefined)).toBe(true);
  });

  it("searchByDeclarations scoped to a parent returns only that parent's children", () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    const matches = registry.searchByDeclarations('padding: 0 16px;', { parent: 'list-two-line-item' });
    const slugs = matches.map((m) => m.entry.slug);
    expect(slugs).toContain('list-two-line-item-icon');
    expect(slugs).not.toContain('list-two-line-item');
  });

  it('findByName resolves a child entry directly', () => {
    const registry = createCssUtilityRegistryFromEntries({ entries: PARENT_ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
    expect(registry.findByName('dbx-list-two-line-item-icon')?.parent).toBe('list-two-line-item');
  });
});
