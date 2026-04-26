/**
 * Filter cluster reference data for `dbx_filter_lookup`.
 *
 * Curated entries describing the @dereekb/dbx-core filter directive surface
 * (`DbxFilterSourceDirective`, source/connector pairings, the `FilterMap`
 * variants) plus the `ClickableFilterPreset` shape used for preset chips.
 *
 * Entries are pure data — no classes, no async init. Slugs are kebab-case and
 * unique. Selectors match the live source verbatim (no fabricated entries).
 */

export type FilterEntryKind = 'directive' | 'pattern';

export interface FilterEntryInputInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

export interface FilterEntryInfo {
  readonly slug: string;
  readonly kind: FilterEntryKind;
  readonly className: string;
  readonly selector: string | undefined;
  readonly module: string;
  readonly description: string;
  readonly inputs: readonly FilterEntryInputInfo[];
  readonly outputs: readonly FilterEntryInputInfo[];
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly sourcePath: string;
  readonly example: string;
}

export const FILTER_ENTRIES: readonly FilterEntryInfo[] = [
  {
    slug: 'source',
    kind: 'directive',
    className: 'DbxFilterSourceDirective',
    selector: '[dbxFilterSource]',
    module: '@dereekb/dbx-core',
    description: 'Provides a `FilterSource` in DI so child components can inject and consume the current filter value. Use this on a wrapper element when the child is the canonical owner of the filter (a filter form, a chip group).',
    inputs: [],
    outputs: [],
    relatedSlugs: ['connect-source', 'source-connector', 'map-source'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.source.directive.ts',
    example: `<div dbxFilterSource>
  <my-filter-form></my-filter-form>
</div>`
  },
  {
    slug: 'source-connector',
    kind: 'directive',
    className: 'DbxFilterSourceConnectorDirective',
    selector: '[dbxFilterSourceConnector]',
    module: '@dereekb/dbx-core',
    description: 'Acts as both `FilterSource` and `FilterSourceConnector` — bridges a filter from one part of the template to another. Pair with `[dbxFilterConnectSource]` on the inner element that owns the source.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['source', 'connect-source'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.connector.directive.ts',
    example: `<div dbxFilterSourceConnector>
  <my-filter-form dbxFilterSource dbxFilterConnectSource></my-filter-form>
  <my-list></my-list>
</div>`
  },
  {
    slug: 'connect-source',
    kind: 'directive',
    className: 'DbxFilterConnectSourceDirective',
    selector: '[dbxFilterConnectSource]',
    module: '@dereekb/dbx-core',
    description: "Connects the host element's `FilterSource` to an ancestor `FilterSourceConnector` on init. Place on an element whose own directive contributes a `FilterSource` (via `host: true`) so it auto-wires to the parent connector.",
    inputs: [],
    outputs: [],
    relatedSlugs: ['source', 'source-connector'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.connect.source.directive.ts',
    example: `<div dbxFilterSourceConnector>
  <my-filter-form dbxFilterSource dbxFilterConnectSource></my-filter-form>
</div>`
  },
  {
    slug: 'map',
    kind: 'directive',
    className: 'DbxFilterMapDirective',
    selector: '[dbxFilterMap]',
    module: '@dereekb/dbx-core',
    description: 'Provides a `FilterMap` instance in DI so multiple child sources can register / look up filters by string key. Use when one screen needs several independent filter contexts.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['map-source', 'map-source-connector'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.map.directive.ts',
    example: `<div dbxFilterMap>
  <div [dbxFilterMapSource]="'listA'">...</div>
  <div [dbxFilterMapSource]="'listB'">...</div>
</div>`
  },
  {
    slug: 'map-source',
    kind: 'directive',
    className: 'DbxFilterMapSourceDirective',
    selector: '[dbxFilterMapSource]',
    module: '@dereekb/dbx-core',
    description: 'Provides a `FilterSource` for a keyed entry in an ancestor `FilterMap`. Children can inject the source as if it were the only filter on the page; the map dispatches by key.',
    inputs: [{ name: 'dbxFilterMapSource', type: 'Maybe<FilterMapKey>', description: 'The map key this source binds to.' }],
    outputs: [],
    relatedSlugs: ['map', 'map-source-connector'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.map.source.directive.ts',
    example: `<div dbxFilterMap>
  <div [dbxFilterMapSource]="'profileList'">
    <my-filtered-list></my-filtered-list>
  </div>
</div>`
  },
  {
    slug: 'map-source-connector',
    kind: 'directive',
    className: 'DbxFilterMapSourceConnectorDirective',
    selector: '[dbxFilterMapSourceConnector]',
    module: '@dereekb/dbx-core',
    description: "Both `FilterSource` and `FilterSourceConnector` for a keyed entry in an ancestor `FilterMap`. Connects an external filter source to one map slot and re-emits that slot's filter.",
    inputs: [{ name: 'dbxFilterMapSourceConnector', type: 'Maybe<FilterMapKey>', description: 'The map key this connector binds to.' }],
    outputs: [],
    relatedSlugs: ['map', 'map-source'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.map.connector.directive.ts',
    example: `<div dbxFilterMap>
  <div [dbxFilterMapSourceConnector]="'profileList'">
    <my-list></my-list>
  </div>
</div>`
  },
  {
    slug: 'clickable-preset',
    kind: 'pattern',
    className: 'ClickableFilterPreset',
    selector: undefined,
    module: '@dereekb/dbx-core',
    description: 'Pattern for declaring a preset filter chip — combines an anchor display (title, icon, disabled) with a preset string identifier and a `presetValue` getter. A `null` or empty preset value resets the filter.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['source'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/filter/filter.preset.ts',
    example: `const activePreset: ClickableFilterPreset<ProfileFilter> = {
  preset: 'active',
  title: 'Active',
  icon: 'check',
  presetValue: { status: 'active', preset: 'active' }
};`
  }
];

export function getFilterEntries(): readonly FilterEntryInfo[] {
  return FILTER_ENTRIES;
}

export function getFilterEntry(slug: string): FilterEntryInfo | undefined {
  const trimmed = slug.trim();
  return FILTER_ENTRIES.find((e) => e.slug === trimmed);
}

export function getFilterEntryByClassName(className: string): FilterEntryInfo | undefined {
  const trimmed = className.trim();
  return FILTER_ENTRIES.find((e) => e.className === trimmed);
}

export function getFilterEntryBySelector(selector: string): FilterEntryInfo | undefined {
  const trimmed = selector.trim();
  // Accept both `[dbxFoo]` and `dbxFoo` forms.
  const stripped = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  return FILTER_ENTRIES.find((e) => {
    if (!e.selector) {
      return false;
    }
    const eStripped = e.selector.startsWith('[') && e.selector.endsWith(']') ? e.selector.slice(1, -1) : e.selector;
    return eStripped === stripped;
  });
}

export const FILTER_KIND_ORDER: readonly FilterEntryKind[] = ['directive', 'pattern'];

export function getFilterEntriesByKind(kind: FilterEntryKind): readonly FilterEntryInfo[] {
  return FILTER_ENTRIES.filter((e) => e.kind === kind);
}
