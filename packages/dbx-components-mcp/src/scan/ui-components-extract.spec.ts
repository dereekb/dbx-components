import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { extractUiEntries, type ExtractedUiEntry } from './ui-components-extract.js';

function projectWith(files: Record<string, string>): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

function findEntry(entries: readonly ExtractedUiEntry[], slug: string): ExtractedUiEntry {
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`expected entry slug=${slug}, got: ${entries.map((e) => e.slug).join(', ')}`);
  }
  return entry;
}

describe('extractUiEntries — opt-in marker', () => {
  it('skips classes without @dbxWebComponent', () => {
    const project = projectWith({
      '/proj/src/foo.ts': `
        import { Component } from '@angular/core';
        /** Untagged component. */
        @Component({ selector: 'dbx-foo', template: '' })
        export class DbxFooComponent {}
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('extracts a tagged component with auto-detected kind and selector', () => {
    const project = projectWith({
      '/proj/src/section.ts': `
        import { Component, input } from '@angular/core';
        /**
         * Content section with a header and body area.
         * @dbxWebComponent
         * @dbxWebSlug section
         * @dbxWebCategory layout
         */
        @Component({ selector: 'dbx-section', template: '<ng-content select="[sectionHeader]"></ng-content><ng-content></ng-content>' })
        export class DbxSectionComponent {
          /** Section header text. */
          readonly header = input<string>('');
          /** Heading level. */
          readonly h = input<1 | 2 | 3 | 4 | 5>(3);
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const section = findEntry(result.entries, 'section');
    expect(section.category).toBe('layout');
    expect(section.kind).toBe('component');
    expect(section.selector).toBe('dbx-section');
    expect(section.className).toBe('DbxSectionComponent');
    expect(section.description).toContain('Content section');
    expect(section.contentProjection).toBe('<ng-content select="[sectionHeader]"></ng-content>; <ng-content></ng-content>');
    expect(section.inputs.length).toBe(2);
    expect(section.inputs[0]).toEqual({
      name: 'header',
      type: 'string',
      description: 'Section header text.',
      required: false,
      default: "''"
    });
    expect(section.inputs[1].type).toBe('1 | 2 | 3 | 4 | 5');
    expect(section.inputs[1].default).toBe('3');
  });
});

describe('extractUiEntries — directives, pipes, services', () => {
  it('detects @Directive kind and selector', () => {
    const project = projectWith({
      '/proj/src/action.directive.ts': `
        import { Directive, Input } from '@angular/core';
        /**
         * Wraps an action.
         * @dbxWebComponent
         * @dbxWebSlug action-confirm
         * @dbxWebCategory action
         */
        @Directive({ selector: '[dbxActionConfirm]' })
        export class DbxActionConfirmDirective {
          /** Confirm dialog config. */
          @Input({ required: true }) dbxActionConfirm!: string;
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0];
    expect(entry.kind).toBe('directive');
    expect(entry.selector).toBe('[dbxActionConfirm]');
    expect(entry.inputs[0].required).toBe(true);
    expect(entry.inputs[0].name).toBe('dbxActionConfirm');
  });

  it('detects @Pipe and Pipe name', () => {
    const project = projectWith({
      '/proj/src/safe-html.pipe.ts': `
        import { Pipe, PipeTransform } from '@angular/core';
        /**
         * Bypasses Angular's HTML sanitizer.
         * @dbxWebComponent
         * @dbxWebSlug safe-html
         * @dbxWebCategory text
         */
        @Pipe({ name: 'safeHtml' })
        export class SafeHtmlPipe implements PipeTransform {
          transform(value: string): string { return value; }
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].kind).toBe('pipe');
    expect(result.entries[0].selector).toBe('safeHtml');
  });

  it('detects @Injectable services', () => {
    const project = projectWith({
      '/proj/src/dialog.service.ts': `
        import { Injectable } from '@angular/core';
        /**
         * Dialog launcher.
         * @dbxWebComponent
         * @dbxWebSlug dialog
         * @dbxWebCategory overlay
         */
        @Injectable()
        export class DbxDialogService {}
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].kind).toBe('service');
    expect(result.entries[0].selector).toBe('');
  });
});

describe('extractUiEntries — outputs', () => {
  it('extracts signal output() with type argument', () => {
    const project = projectWith({
      '/proj/src/list.ts': `
        import { Component, output } from '@angular/core';
        /**
         * List component.
         * @dbxWebComponent
         * @dbxWebSlug list
         * @dbxWebCategory list
         */
        @Component({ selector: 'dbx-list', template: '' })
        export class DbxListComponent {
          /** Fires when an item is clicked. */
          readonly itemClick = output<string>();
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].outputs).toEqual([{ name: 'itemClick', emits: 'string', description: 'Fires when an item is clicked.' }]);
  });

  it('extracts @Output() EventEmitter outputs', () => {
    const project = projectWith({
      '/proj/src/list.ts': `
        import { Component, EventEmitter, Output } from '@angular/core';
        /**
         * List component.
         * @dbxWebComponent
         * @dbxWebSlug list
         * @dbxWebCategory list
         */
        @Component({ selector: 'dbx-list', template: '' })
        export class DbxListComponent {
          /** Fires when an item is clicked. */
          @Output() readonly itemClick = new EventEmitter<string>();
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].outputs).toEqual([{ name: 'itemClick', emits: 'string', description: 'Fires when an item is clicked.' }]);
  });
});

describe('extractUiEntries — required inputs', () => {
  it('flags input.required<T>() as required', () => {
    const project = projectWith({
      '/proj/src/x.ts': `
        import { Component, input } from '@angular/core';
        /**
         * X.
         * @dbxWebComponent
         * @dbxWebSlug x
         * @dbxWebCategory misc
         */
        @Component({ selector: 'x', template: '' })
        export class X {
          /** A required value. */
          readonly value = input.required<string>();
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries[0].inputs[0]).toEqual({
      name: 'value',
      type: 'string',
      description: 'A required value.',
      required: true
    });
  });

  it('respects alias from input() options', () => {
    const project = projectWith({
      '/proj/src/x.ts': `
        import { Component, input } from '@angular/core';
        /**
         * X.
         * @dbxWebComponent
         * @dbxWebSlug x
         * @dbxWebCategory misc
         */
        @Component({ selector: 'x', template: '' })
        export class X {
          /** Aliased input. */
          readonly value = input<string>('', { alias: 'aliasedValue' });
        }
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries[0].inputs[0].name).toBe('aliasedValue');
  });
});

describe('extractUiEntries — warnings', () => {
  it('warns when slug or category is missing', () => {
    const project = projectWith({
      '/proj/src/missing.ts': `
        import { Component } from '@angular/core';
        /**
         * Missing tags.
         * @dbxWebComponent
         */
        @Component({ selector: 'x', template: '' })
        export class X {}
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings.map((w) => w.kind)).toEqual(['missing-required-tag', 'missing-required-tag']);
  });

  it('warns on unknown category and skips entry', () => {
    const project = projectWith({
      '/proj/src/bad.ts': `
        import { Component } from '@angular/core';
        /**
         * Bad category.
         * @dbxWebComponent
         * @dbxWebSlug bad
         * @dbxWebCategory not-a-category
         */
        @Component({ selector: 'x', template: '' })
        export class X {}
      `
    });
    const result = extractUiEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings[0].kind).toBe('unknown-category');
  });
});

describe('extractUiEntries — JSDoc tags', () => {
  it('parses related slugs, skill refs, and minimal example fences', () => {
    const project = projectWith({
      '/proj/src/x.ts': `
        import { Component } from '@angular/core';
        /**
         * X component.
         * @dbxWebComponent
         * @dbxWebSlug x
         * @dbxWebCategory layout
         * @dbxWebRelated foo, bar baz
         * @dbxWebSkillRefs dbx__ref__a dbx__ref__b
         * @dbxWebMinimalExample \`\`\`html
         * <x></x>
         * \`\`\`
         */
        @Component({ selector: 'x', template: '' })
        export class X {}
      `
    });
    const result = extractUiEntries({ project });
    const entry = result.entries[0];
    expect(entry.relatedSlugs).toEqual(['foo', 'bar', 'baz']);
    expect(entry.skillRefs).toEqual(['dbx__ref__a', 'dbx__ref__b']);
    expect(entry.minimalExample).toBe('<x></x>');
  });
});
