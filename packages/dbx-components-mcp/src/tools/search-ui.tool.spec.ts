import { describe, expect, it } from 'vitest';
import { type UiComponentEntry } from '../manifest/ui-components-schema.js';
import { createUiComponentRegistryFromEntries } from '../registry/ui-components-runtime.js';
import { createSearchUiTool } from './search-ui.tool.js';

const FIXTURE_ENTRIES: readonly UiComponentEntry[] = [
  {
    slug: 'section',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-section',
    className: 'DbxSectionComponent',
    module: '@dereekb/dbx-web',
    description: 'Content section with a header and body area.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['subsection'],
    skillRefs: []
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
    skillRefs: []
  },
  {
    slug: 'two-column',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-two-column',
    className: 'DbxTwoColumnComponent',
    module: '@dereekb/dbx-web',
    description: 'Responsive split layout with two columns.',
    inputs: [],
    outputs: [],
    relatedSlugs: [],
    skillRefs: []
  },
  {
    slug: 'button',
    category: 'button',
    kind: 'component',
    selector: 'dbx-button',
    className: 'DbxButtonComponent',
    module: '@dereekb/dbx-web',
    description: 'Canonical action button.',
    inputs: [],
    outputs: [],
    relatedSlugs: [],
    skillRefs: []
  },
  {
    slug: 'list',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list',
    className: 'DbxListComponent',
    module: '@dereekb/dbx-web',
    description: 'Reactive list container.',
    inputs: [],
    outputs: [],
    relatedSlugs: [],
    skillRefs: []
  },
  {
    slug: 'list-view',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-view',
    className: 'DbxValueListViewComponent',
    module: '@dereekb/dbx-web',
    description: 'Default value list view.',
    inputs: [],
    outputs: [],
    relatedSlugs: [],
    skillRefs: []
  },
  {
    slug: 'list-empty-content',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-empty-content',
    className: 'DbxListEmptyContentComponent',
    module: '@dereekb/dbx-web',
    description: 'Empty-state slot for dbx-list.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['list'],
    skillRefs: []
  },
  {
    slug: 'loading',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-loading',
    className: 'DbxLoadingComponent',
    module: '@dereekb/dbx-web',
    description: 'Reactive loading wrapper.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['basic-loading', 'loading-progress'],
    skillRefs: []
  },
  {
    slug: 'basic-loading',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-basic-loading',
    className: 'DbxBasicLoadingComponent',
    module: '@dereekb/dbx-web',
    description: 'Lower-level loading view.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['loading'],
    skillRefs: []
  },
  {
    slug: 'loading-progress',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-loading-progress',
    className: 'DbxLoadingProgressComponent',
    module: '@dereekb/dbx-web',
    description: 'Progress indicator without content projection.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['loading'],
    skillRefs: []
  }
];

const tool = createSearchUiTool({
  registry: createUiComponentRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/dbx-web'] })
});

function runSearchUi(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

function firstText(result: ReturnType<typeof runSearchUi>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_ui_search', () => {
  it('rejects missing query via arktype', () => {
    const result = runSearchUi({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('ranks exact slug matches highest', () => {
    const text = firstText(runSearchUi({ query: 'section' }));
    expect(text).toMatch(/# Search: `section`/);
    const firstResult = /## `([^`]+)`/.exec(text);
    expect(firstResult?.[1]).toBe('section');
  });

  it('matches "loading" against multiple loading-prefixed entries', () => {
    const text = firstText(runSearchUi({ query: 'loading' }));
    expect(text).toMatch(/loading/);
    expect(text).toMatch(/loading-progress|basic-loading/);
  });

  it('AND-combines multi-word queries', () => {
    const text = firstText(runSearchUi({ query: 'two column' }));
    expect(text).toMatch(/two-column/);
  });

  it('respects category filter', () => {
    const text = firstText(runSearchUi({ query: 'list', category: 'list' }));
    expect(text).toMatch(/category=`list`/);
    expect(text).toMatch(/## `list`/);
  });

  it('respects the limit cap', () => {
    const text = firstText(runSearchUi({ query: 'list', limit: 2 }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(2);
  });

  it('matches by selector substring', () => {
    const text = firstText(runSearchUi({ query: 'dbx-button' }));
    expect(text).toMatch(/## `button`/);
  });

  it('returns a friendly message when nothing matches', () => {
    const text = firstText(runSearchUi({ query: 'zzzz-nothing-here' }));
    expect(text).toMatch(/No UI components matched/);
  });
});
