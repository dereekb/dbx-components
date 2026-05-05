import { describe, expect, it } from 'vitest';
import { type UiComponentEntry } from '../manifest/ui-components-schema.js';
import { createUiComponentRegistryFromEntries } from '../registry/ui-components-runtime.js';
import { createLookupUiTool } from './lookup-ui.tool.js';

const FIXTURE_ENTRIES: readonly UiComponentEntry[] = [
  {
    slug: 'section',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-section',
    className: 'DbxSectionComponent',
    module: '@dereekb/dbx-web',
    description: 'Content section with a header and body area.',
    inputs: [
      { name: 'header', type: 'string', description: 'Section header text.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon name.', required: false }
    ],
    outputs: [],
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['subsection'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    example: '<dbx-section header="Account"><p>Body</p></dbx-section>',
    minimalExample: '<dbx-section header="Title"></dbx-section>'
  },
  {
    slug: 'subsection',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-subsection',
    className: 'DbxSubSectionComponent',
    module: '@dereekb/dbx-web',
    description: 'Subsection variant of dbx-section.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['section'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    example: '<dbx-subsection header="Detail"></dbx-subsection>',
    minimalExample: '<dbx-subsection></dbx-subsection>'
  },
  {
    slug: 'content',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content,[dbxContent]',
    className: 'DbxContentDirective',
    module: '@dereekb/dbx-web',
    description: 'Marker directive that applies the canonical content class.',
    inputs: [],
    outputs: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<div dbxContent>Body</div>',
    minimalExample: '<dbx-content>Body</dbx-content>'
  },
  {
    slug: 'button',
    category: 'button',
    kind: 'component',
    selector: 'dbx-button',
    className: 'DbxButtonComponent',
    module: '@dereekb/dbx-web',
    description: 'Canonical action button.',
    inputs: [{ name: 'text', type: 'string', description: 'Button text.', required: false }],
    outputs: [{ name: 'btnClick', emits: 'MouseEvent', description: 'Click event.' }],
    relatedSlugs: [],
    skillRefs: [],
    example: '<dbx-button text="Save"></dbx-button>',
    minimalExample: '<dbx-button></dbx-button>'
  }
];

const tool = createLookupUiTool({
  registry: createUiComponentRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/dbx-web'] })
});

function runLookupUi(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

function firstText(result: ReturnType<typeof runLookupUi>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_ui_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookupUi({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a slug to a single full entry with sections', () => {
    const text = firstText(runLookupUi({ topic: 'section' }));
    expect(text).toMatch(/# DbxSectionComponent/);
    expect(text).toMatch(/\*\*slug:\*\* `section`/);
    expect(text).toMatch(/## Inputs/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits inputs/outputs/example sections', () => {
    const text = firstText(runLookupUi({ topic: 'section', depth: 'brief' }));
    expect(text).toMatch(/## DbxSectionComponent/);
    expect(text).not.toMatch(/## Inputs/);
    expect(text).not.toMatch(/## Example/);
  });

  it('resolves a class name (case-insensitive)', () => {
    const text = firstText(runLookupUi({ topic: 'DBXSECTIONCOMPONENT' }));
    expect(text).toMatch(/# DbxSectionComponent/);
  });

  it('resolves an Angular selector (element form)', () => {
    const text = firstText(runLookupUi({ topic: 'dbx-section' }));
    expect(text).toMatch(/# DbxSectionComponent/);
  });

  it('resolves an Angular selector (attribute form)', () => {
    const text = firstText(runLookupUi({ topic: '[dbxContent]' }));
    expect(text).toMatch(/# DbxContentDirective/);
  });

  it('resolves a category name to a group', () => {
    const text = firstText(runLookupUi({ topic: 'layout' }));
    expect(text).toMatch(/# UI components: category = layout/);
    expect(text).toMatch(/## component/);
  });

  it('resolves the "list" alias to the full catalog', () => {
    const text = firstText(runLookupUi({ topic: 'list' }));
    expect(text).toMatch(/# UI catalog/);
    expect(text).toMatch(/## layout/);
    expect(text).toMatch(/## button/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(runLookupUi({ topic: 'sect' }));
    expect(text).toMatch(/No UI component matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/section/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(runLookupUi({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No UI component matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
