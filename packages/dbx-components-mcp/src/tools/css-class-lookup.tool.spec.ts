import { describe, expect, it } from 'vitest';
import type { CssUtilityEntry } from '../manifest/css-utilities-schema.js';
import { createCssUtilityRegistryFromEntries } from '../registry/css-utilities-runtime.js';
import { createCssClassLookupTool } from './css-class-lookup.tool.js';

const ENTRIES: readonly CssUtilityEntry[] = [
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
  },
  {
    slug: 'flex-bar',
    selector: '.dbx-flex-bar',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/flex/_flex.scss',
    line: 9,
    declarations: [
      { property: 'display', value: 'flex' },
      { property: 'align-items', value: 'center' }
    ],
    role: 'flex',
    intent: 'horizontal action bar'
  }
];

function buildTool() {
  const registry = createCssUtilityRegistryFromEntries({ entries: ENTRIES, loadedSources: ['@dereekb/dbx-web'] });
  return createCssClassLookupTool({ registry });
}

describe('createCssClassLookupTool — parent + includeChildren', () => {
  it('parent="<slug>" alone lists the parent\'s children', () => {
    const tool = buildTool();
    const out = tool.run({ parent: 'list-two-line-item' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('Children of `list-two-line-item`');
    expect(text).toContain('.dbx-list-two-line-item-icon');
    expect(text).toContain('.dbx-list-two-line-item-title');
  });

  it('parent="<slug>" + declarations narrows the candidate pool to that parent', () => {
    const tool = buildTool();
    const out = tool.run({ declarations: 'padding: 0 16px;', parent: 'list-two-line-item' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('.dbx-list-two-line-item-icon');
    expect(text).not.toContain('.dbx-list-two-line-item-title');
  });

  it('browse hides children by default', () => {
    const tool = buildTool();
    const out = tool.run({ category: 'list' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('top-level');
    expect(text).toContain('.dbx-list-two-line-item');
    expect(text).toContain('.dbx-flex-bar');
    expect(text).not.toContain('.dbx-list-two-line-item-icon');
    expect(text).not.toContain('.dbx-list-two-line-item-title');
  });

  it('browse with includeChildren=true surfaces every entry and tags parents', () => {
    const tool = buildTool();
    const out = tool.run({ category: 'list', includeChildren: true }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('.dbx-list-two-line-item-icon');
    expect(text).toContain('parent: `list-two-line-item`');
  });

  it('name lookup resolves a child entry directly and shows its parent', () => {
    const tool = buildTool();
    const out = tool.run({ name: 'dbx-list-two-line-item-icon' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('# `.dbx-list-two-line-item-icon`');
    expect(text).toContain('**Parent:** `list-two-line-item`');
  });

  it('rendering a parent entry includes its children section', () => {
    const tool = buildTool();
    const out = tool.run({ name: 'list-two-line-item' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('## Children (2)');
    expect(text).toContain('.dbx-list-two-line-item-icon');
    expect(text).toContain('.dbx-list-two-line-item-title');
  });

  it('parent="<slug>" with no children explains that the parent has none', () => {
    const tool = buildTool();
    const out = tool.run({ parent: 'flex-bar' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('No children registered under `flex-bar`');
  });
});

describe('createCssClassLookupTool — component / scope / tokens', () => {
  const ICON_TILE_ENTRY: CssUtilityEntry = {
    slug: 'icon-tile',
    selector: '.dbx-icon-tile',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/text/_text.scss',
    line: 170,
    declarations: [
      { property: 'display', value: 'flex' },
      { property: 'padding', value: 'var(--dbx-icon-tile-padding, 8px)' }
    ],
    role: 'layout',
    intent: 'rounded padded icon container',
    component: 'DbxIconTileComponent',
    scope: 'component-class',
    tokensRead: ['--dbx-icon-tile-icon-size', '--dbx-icon-tile-padding'],
    tokensSet: []
  };

  const STEP_BLOCK_BADGE_ENTRY: CssUtilityEntry = {
    slug: 'step-block-badge',
    selector: '.dbx-step-block-badge',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/text/_text.scss',
    line: 199,
    declarations: [{ property: '--dbx-icon-tile-padding', value: '0' }],
    role: 'layout',
    intent: 'fixed-size badge inside <dbx-step-block>',
    component: 'DbxStepBlockComponent',
    scope: 'component-class',
    tokensRead: ['--dbx-step-block-badge-shape'],
    tokensSet: ['--dbx-icon-tile-padding']
  };

  function buildComponentClassTool() {
    const registry = createCssUtilityRegistryFromEntries({
      entries: [ICON_TILE_ENTRY, STEP_BLOCK_BADGE_ENTRY],
      loadedSources: ['@dereekb/dbx-web']
    });
    return createCssClassLookupTool({ registry });
  }

  it('renders the owning component when present', () => {
    const tool = buildComponentClassTool();
    const out = tool.run({ name: 'icon-tile' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('**Component:** `DbxIconTileComponent`');
  });

  it('renders the component-class scope warning', () => {
    const tool = buildComponentClassTool();
    const out = tool.run({ name: 'icon-tile' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('scope: component-class');
    expect(text).toContain('component-owned class');
    expect(text).toContain('apply it via the owning component');
  });

  it('renders tokens read with override hint', () => {
    const tool = buildComponentClassTool();
    const out = tool.run({ name: 'icon-tile' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('## Tokens read');
    expect(text).toContain('Override these CSS variables to customize the rule:');
    expect(text).toContain('`--dbx-icon-tile-padding`');
    expect(text).toContain('`--dbx-icon-tile-icon-size`');
  });

  it('renders tokens set with cascade hint', () => {
    const tool = buildComponentClassTool();
    const out = tool.run({ name: 'step-block-badge' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('## Tokens set');
    expect(text).toContain('cascade to descendants');
    expect(text).toContain('`--dbx-icon-tile-padding`');
  });

  it('omits Tokens read / set sections when the lists are empty', () => {
    const plainEntry: CssUtilityEntry = {
      slug: 'plain',
      selector: '.dbx-plain',
      source: '@dereekb/dbx-web',
      module: '@dereekb/dbx-web',
      file: 'x.scss',
      line: 1,
      declarations: [{ property: 'display', value: 'block' }]
    };
    const registry = createCssUtilityRegistryFromEntries({
      entries: [plainEntry],
      loadedSources: ['@dereekb/dbx-web']
    });
    const tool = createCssClassLookupTool({ registry });
    const out = tool.run({ name: 'plain' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).not.toContain('## Tokens read');
    expect(text).not.toContain('## Tokens set');
  });
});

describe('createCssClassLookupTool — compound selectorContext', () => {
  const COMPOUND_ENTRY: CssUtilityEntry = {
    slug: 'list-no-item-padding',
    selector: '.dbx-list-no-item-padding',
    source: '@dereekb/dbx-web',
    module: '@dereekb/dbx-web',
    file: 'src/lib/layout/list/_list.scss',
    line: 200,
    declarations: [{ property: 'padding', value: '0' }],
    role: 'spacing',
    intent: 'zero the inner padding on every nav-list row',
    selectorContext: '.dbx-list-no-item-padding .dbx-list > .dbx-list-content .mat-mdc-list-item-content'
  };

  function buildCompoundTool() {
    const registry = createCssUtilityRegistryFromEntries({
      entries: [COMPOUND_ENTRY],
      loadedSources: ['@dereekb/dbx-web']
    });
    return createCssClassLookupTool({ registry });
  }

  it('renders a "Use inside" line with the descendant chain', () => {
    const tool = buildCompoundTool();
    const out = tool.run({ name: 'list-no-item-padding' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('**Use inside:** `.dbx-list-no-item-padding .dbx-list > .dbx-list-content .mat-mdc-list-item-content`');
  });

  it('renders the full compound chain in the declarations block', () => {
    const tool = buildCompoundTool();
    const out = tool.run({ name: 'list-no-item-padding' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('.dbx-list-no-item-padding .dbx-list > .dbx-list-content .mat-mdc-list-item-content {');
  });

  it('still resolves the host class via name lookup', () => {
    const tool = buildCompoundTool();
    const out = tool.run({ name: '.dbx-list-no-item-padding' }) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('# `.dbx-list-no-item-padding`');
  });
});
