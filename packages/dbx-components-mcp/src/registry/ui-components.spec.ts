import { describe, expect, it } from 'vitest';
import { UI_COMPONENTS, UI_CATEGORY_ORDER, UI_KIND_ORDER, getUiComponent, getUiComponentBySelector, getUiComponents, getUiComponentsByCategory, getUiComponentsByKind } from './index.js';

describe('ui-components registry', () => {
  it('exposes a non-empty list', () => {
    expect(UI_COMPONENTS.length).toBeGreaterThanOrEqual(40);
    expect(getUiComponents()).toBe(UI_COMPONENTS);
  });

  it('gives every entry a unique slug, kebab-case, with a known category and kind', () => {
    const slugs = new Set<string>();
    const knownCategories = new Set<string>(UI_CATEGORY_ORDER);
    const knownKinds = new Set<string>(UI_KIND_ORDER);
    const kebab = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    for (const c of UI_COMPONENTS) {
      expect(slugs.has(c.slug), `duplicate slug: ${c.slug}`).toBe(false);
      slugs.add(c.slug);
      expect(kebab.test(c.slug), `slug not kebab-case: ${c.slug}`).toBe(true);
      expect(knownCategories.has(c.category), `unknown category on ${c.slug}: ${c.category}`).toBe(true);
      expect(knownKinds.has(c.kind), `unknown kind on ${c.slug}: ${c.kind}`).toBe(true);
    }
  });

  it('gives every entry a unique selector', () => {
    const selectors = new Set<string>();
    for (const c of UI_COMPONENTS) {
      expect(selectors.has(c.selector), `duplicate selector: ${c.selector}`).toBe(false);
      selectors.add(c.selector);
    }
  });

  it('every entry ships from a real workspace package', () => {
    const allowed = new Set(['@dereekb/dbx-web', '@dereekb/dbx-core']);
    for (const c of UI_COMPONENTS) {
      expect(allowed.has(c.module), `${c.slug} module not allowed: ${c.module}`).toBe(true);
    }
  });

  it('every entry has a non-empty class name and source path', () => {
    for (const c of UI_COMPONENTS) {
      expect(c.className.length, `${c.slug} missing className`).toBeGreaterThan(0);
      expect(c.sourcePath.length, `${c.slug} missing sourcePath`).toBeGreaterThan(0);
      expect(c.description.length, `${c.slug} missing description`).toBeGreaterThan(0);
      expect(c.example.length, `${c.slug} missing example`).toBeGreaterThan(0);
      expect(c.minimalExample.length, `${c.slug} missing minimalExample`).toBeGreaterThan(0);
    }
  });

  it('all relatedSlugs reference real registry entries', () => {
    const slugs = new Set(UI_COMPONENTS.map((c) => c.slug));
    for (const c of UI_COMPONENTS) {
      for (const ref of c.relatedSlugs) {
        expect(slugs.has(ref), `${c.slug} relatedSlug "${ref}" not in registry`).toBe(true);
      }
    }
  });

  it('PRIMARY index: getUiComponentsByCategory returns matching entries', () => {
    const layout = getUiComponentsByCategory('layout');
    expect(layout.length).toBeGreaterThan(0);
    expect(layout.every((c) => c.category === 'layout')).toBe(true);

    const buttons = getUiComponentsByCategory('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((c) => c.category === 'button')).toBe(true);
  });

  it('getUiComponentsByKind filters by kind', () => {
    const components = getUiComponentsByKind('component');
    const directives = getUiComponentsByKind('directive');
    expect(components.length).toBeGreaterThan(0);
    expect(directives.length).toBeGreaterThan(0);
    expect(components.every((c) => c.kind === 'component')).toBe(true);
    expect(directives.every((c) => c.kind === 'directive')).toBe(true);
  });

  it('looks up entries by slug, className (case-insensitive), and selector', () => {
    expect(getUiComponent('section')?.className).toBe('DbxSectionComponent');
    expect(getUiComponent('DBXSECTIONCOMPONENT')?.slug).toBe('section');
    expect(getUiComponent('dbx-section')?.slug).toBe('section');
    expect(getUiComponent('not-a-real-component')).toBeUndefined();
  });

  it('selector lookup splits comma-separated selectors', () => {
    // dbx-content has selector: 'dbx-content,[dbxContent]'
    const byElement = getUiComponentBySelector('dbx-content');
    const byAttribute = getUiComponentBySelector('[dbxContent]');
    expect(byElement?.slug).toBe('content');
    expect(byAttribute?.slug).toBe('content');
  });

  it('covers every advertised category with at least one entry', () => {
    for (const category of UI_CATEGORY_ORDER) {
      const matches = getUiComponentsByCategory(category);
      if (category !== 'misc') {
        expect(matches.length, `category ${category} has no entries`).toBeGreaterThan(0);
      }
    }
  });
});
