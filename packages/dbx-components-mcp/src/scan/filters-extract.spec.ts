import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { extractFilterEntries, type ExtractedFilterDirective, type ExtractedFilterEntry, type ExtractedFilterPattern } from './filters-extract.js';

function projectWith(files: Record<string, string>): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

function findEntry(entries: readonly ExtractedFilterEntry[], slug: string): ExtractedFilterEntry {
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`expected entry slug=${slug}, got: ${entries.map((e) => e.slug).join(', ')}`);
  }
  return entry;
}

describe('extractFilterEntries — opt-in marker', () => {
  it('skips classes without @dbxFilter', () => {
    const project = projectWith({
      '/proj/src/foo.directive.ts': `
        import { Directive } from '@angular/core';
        /** Untagged directive. */
        @Directive({ selector: '[dbxFoo]' })
        export class DbxFooDirective {}
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('skips interfaces without @dbxFilter', () => {
    const project = projectWith({
      '/proj/src/preset.ts': `
        /** Untagged interface. */
        export interface SomePreset {
          readonly slug: string;
        }
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('extractFilterEntries — directives', () => {
  it('extracts a tagged directive with selector and signal input', () => {
    const project = projectWith({
      '/proj/src/map.source.directive.ts': `
        import { Directive, input } from '@angular/core';
        /**
         * Provides a FilterSource for a keyed entry in an ancestor FilterMap.
         * @dbxFilter
         * @dbxFilterSlug map-source
         * @dbxFilterRelated map, map-source-connector
         * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
         * @example
         * \`\`\`html
         * <div [dbxFilterMapSource]="'k'"></div>
         * \`\`\`
         */
        @Directive({ selector: '[dbxFilterMapSource]', standalone: true })
        export class DbxFilterMapSourceDirective<F> {
          /** The map key this source binds to. */
          readonly dbxFilterMapSource = input<Maybe<FilterMapKey>>();
        }
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = findEntry(result.entries, 'map-source') as ExtractedFilterDirective;
    expect(entry.kind).toBe('directive');
    expect(entry.selector).toBe('[dbxFilterMapSource]');
    expect(entry.className).toBe('DbxFilterMapSourceDirective');
    expect(entry.description).toContain('Provides a FilterSource');
    expect(entry.relatedSlugs).toEqual(['map', 'map-source-connector']);
    expect(entry.skillRefs).toEqual(['dbx__ref__dbx-component-patterns']);
    expect(entry.inputs.length).toBe(1);
    expect(entry.inputs[0]).toEqual({
      name: 'dbxFilterMapSource',
      type: 'Maybe<FilterMapKey>',
      description: 'The map key this source binds to.'
    });
    expect(entry.example).toContain('<div [dbxFilterMapSource]');
  });

  it('warns when @dbxFilterSlug is missing', () => {
    const project = projectWith({
      '/proj/src/no-slug.directive.ts': `
        import { Directive } from '@angular/core';
        /**
         * Tagged but missing slug.
         * @dbxFilter
         */
        @Directive({ selector: '[dbxNoSlug]' })
        export class DbxNoSlugDirective {}
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'missing-required-tag', tag: 'dbxFilterSlug' });
  });

  it('warns when @Directive decorator is absent on a class entry', () => {
    const project = projectWith({
      '/proj/src/no-decorator.ts': `
        /**
         * Tagged class but no decorator.
         * @dbxFilter
         * @dbxFilterSlug bare
         */
        export class BareClass {}
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'directive-missing-decorator', className: 'BareClass' });
  });
});

describe('extractFilterEntries — patterns', () => {
  it('extracts a tagged interface as a pattern entry', () => {
    const project = projectWith({
      '/proj/src/preset.ts': `
        /**
         * Pattern for declaring a preset filter chip.
         * @dbxFilter
         * @dbxFilterSlug clickable-preset
         * @dbxFilterRelated source
         * @example
         * \`\`\`typescript
         * const p: ClickableFilterPreset<F> = { preset: 'a', title: 'A', presetValue: { preset: 'a' } };
         * \`\`\`
         */
        export interface ClickableFilterPreset<F> {
          readonly presetValue: F | null;
        }
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = findEntry(result.entries, 'clickable-preset') as ExtractedFilterPattern;
    expect(entry.kind).toBe('pattern');
    expect(entry.className).toBe('ClickableFilterPreset');
    expect(entry.description).toContain('Pattern for declaring');
    expect(entry.relatedSlugs).toEqual(['source']);
    expect(entry.example).toContain('ClickableFilterPreset<F>');
  });

  it('warns when a tagged interface is missing slug', () => {
    const project = projectWith({
      '/proj/src/missing.ts': `
        /**
         * @dbxFilter
         */
        export interface MissingSlug {}
      `
    });
    const result = extractFilterEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'missing-required-tag', tag: 'dbxFilterSlug' });
  });
});
