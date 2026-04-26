/**
 * UI Components Registry.
 *
 * Canonical metadata for @dereekb/dbx-web UI building blocks — section, list,
 * button, card, layout, loading, error, navigation, and overlay components.
 * Mirrors `form-fields.ts` shape: typed `readonly` constants + a discriminated
 * union over `kind`.
 *
 * The PRIMARY index is `category` (e.g. `'layout'`, `'list'`, `'button'`).
 * "What dbx-web component do I use to render a settings section?" is the most
 * common AI query shape, and category-keyed grouping answers it directly.
 *
 * Entries are slug-keyed (`'section'`, `'two-column'`, `'list'`). Slugs are
 * kebab-case and unique. Selectors are stored verbatim from each component
 * source, including comma-separated multi-selector forms when applicable.
 */
// MARK: Categories and kinds
/**
 * High-level grouping for UI components — the primary search index.
 *
 *   - `layout`     section, two-column, content, page-content, page-padding
 *   - `list`       dbx-list, dbx-list-view, value-list-view-item
 *   - `button`     dbx-button, dbx-icon-button, button spacers, progress buttons
 *   - `card`       dbx-card-box, dbx-card-box-container
 *   - `feedback`   loading, progress, error, empty, intro
 *   - `overlay`    dialog, popover, popup, prompt, snackbar
 *   - `navigation` anchor, navbar, anchor-list, sidenav, two-column nav
 *   - `text`       text helpers, chips, labels, click-to-copy
 *   - `screen`     full-page screen helpers (resize directive lives here too)
 *   - `action`     action-snackbar, prompt-confirm directives, transition safety
 *   - `router`     ui-router-aware components in dbx-web (anchor wrappers etc.)
 *   - `misc`       anything not in the above buckets
 */
export type UiComponentCategory = 'layout' | 'list' | 'button' | 'card' | 'feedback' | 'overlay' | 'navigation' | 'text' | 'screen' | 'action' | 'router' | 'misc';

/**
 * Angular construct kind. Drives output formatting (components have content
 * projection slots, directives advertise their host attribute / class binding,
 * pipes have a transform signature, services have an injection token).
 */
export type UiComponentKind = 'component' | 'directive' | 'pipe' | 'service';

/**
 * Presentation order for categories in listings.
 */
export const UI_CATEGORY_ORDER: readonly UiComponentCategory[] = ['layout', 'list', 'button', 'card', 'feedback', 'overlay', 'navigation', 'text', 'screen', 'action', 'router', 'misc'];

/**
 * Presentation order for kinds in listings within a category.
 */
export const UI_KIND_ORDER: readonly UiComponentKind[] = ['component', 'directive', 'pipe', 'service'];

// MARK: Entry shapes
/**
 * Documentation of a single input on a UI component.
 */
export interface UiComponentInputInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: string;
}

/**
 * Documentation of a single output (Angular `output()` / `EventEmitter`) on a UI component.
 */
export interface UiComponentOutputInfo {
  readonly name: string;
  readonly emits: string;
  readonly description: string;
}

/**
 * Canonical metadata for a single UI component, directive, pipe, or service.
 */
export interface UiComponentInfo {
  /**
   * Unique registry slug (kebab-case). Used for lookup.
   */
  readonly slug: string;
  /**
   * PRIMARY INDEX. UI category bucket.
   */
  readonly category: UiComponentCategory;
  /**
   * Angular construct kind.
   */
  readonly kind: UiComponentKind;
  /**
   * Verbatim selector string from the source (`'dbx-section'`, `'[dbxAction]'`, may be comma-separated).
   */
  readonly selector: string;
  /**
   * Exported class name (`'DbxSectionComponent'`).
   */
  readonly className: string;
  /**
   * NPM package the export ships in (`'@dereekb/dbx-web'`).
   */
  readonly module: string;
  /**
   * Prose description of what the component does and when to reach for it.
   */
  readonly description: string;
  /**
   * Documented inputs (signal inputs or `@Input()` decorators).
   */
  readonly inputs: readonly UiComponentInputInfo[];
  /**
   * Documented outputs / event emitters.
   */
  readonly outputs: readonly UiComponentOutputInfo[];
  /**
   * Optional content projection summary (e.g. `'<ng-content select="[sectionHeader]">'`).
   */
  readonly contentProjection?: string;
  /**
   * Slugs of related entries — used to surface "see also" hints.
   */
  readonly relatedSlugs: readonly string[];
  /**
   * Skill names a caller can load for deeper patterns.
   */
  readonly skillRefs: readonly string[];
  /**
   * Path within `packages/dbx-web/src/` where the export is defined.
   */
  readonly sourcePath: string;
  /**
   * Full copy-paste-ready usage example.
   */
  readonly example: string;
  /**
   * Smallest valid usage.
   */
  readonly minimalExample: string;
}

// MARK: Helpers
const NO_INPUTS: readonly UiComponentInputInfo[] = [];
const NO_OUTPUTS: readonly UiComponentOutputInfo[] = [];

// MARK: Registry
export const UI_COMPONENTS: readonly UiComponentInfo[] = [
  // =====================================================================
  // LAYOUT
  // =====================================================================
  {
    slug: 'section',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-section',
    className: 'DbxSectionComponent',
    module: '@dereekb/dbx-web',
    description: 'Content section with a header and body area. Header defaults to an h3. Supports an `[elevate]` flag to pick up the elevated card styling. Use as the first wrapper inside any settings/detail page.',
    inputs: [
      { name: 'header', type: 'string', description: 'Section header text.', required: false },
      { name: 'h', type: '1 | 2 | 3 | 4 | 5', description: 'Heading level for the header. Defaults to 3.', required: false, default: '3' },
      { name: 'icon', type: 'string', description: 'Material icon name to render before the header text.', required: false },
      { name: 'hint', type: 'string', description: 'Subtle hint shown below the header.', required: false },
      { name: 'hintInline', type: 'boolean', description: 'When true, hint renders inline beside the header instead of below.', required: false },
      { name: 'elevate', type: 'boolean', description: 'Apply elevated card styling.', required: false, default: 'false' }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content select="[sectionHeader]"></ng-content>; <ng-content></ng-content>',
    relatedSlugs: ['subsection', 'section-page', 'section-header', 'intro-action-section'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks', 'dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/section/section.component.ts',
    example: `<dbx-section header="Account" icon="person" hint="Profile and security">
  <button sectionHeader mat-icon-button><mat-icon>edit</mat-icon></button>
  <p>Section body content here.</p>
</dbx-section>`,
    minimalExample: `<dbx-section header="My Section"><p>Body</p></dbx-section>`
  },
  {
    slug: 'subsection',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-subsection',
    className: 'DbxSubSectionComponent',
    module: '@dereekb/dbx-web',
    description: 'Subsection variant of `dbx-section`. Defaults heading level to 4. Nest inside a `dbx-section` to group related fields under a smaller heading.',
    inputs: [
      { name: 'header', type: 'string', description: 'Subsection header text.', required: false },
      { name: 'h', type: '1 | 2 | 3 | 4 | 5', description: 'Heading level. Defaults to 4.', required: false, default: '4' },
      { name: 'icon', type: 'string', description: 'Material icon name shown before the header text.', required: false },
      { name: 'hint', type: 'string', description: 'Subtle hint shown below the header.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content select="[sectionHeader]"></ng-content>; <ng-content></ng-content>',
    relatedSlugs: ['section', 'section-header'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/section/subsection.component.ts',
    example: `<dbx-section header="Settings">
  <dbx-subsection header="Notifications" icon="notifications">
    <p>Subsection body.</p>
  </dbx-subsection>
</dbx-section>`,
    minimalExample: `<dbx-subsection header="Details"><p>Body</p></dbx-subsection>`
  },
  {
    slug: 'section-page',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-section-page',
    className: 'DbxSectionPageComponent',
    module: '@dereekb/dbx-web',
    description: 'Full-page section with a top-level header (defaulting to h2) and a scrollable body. Use as the outermost wrapper of a top-level UIRouter state. `scroll` controls whether the whole page, only the body, or neither scrolls.',
    inputs: [
      { name: 'header', type: 'string', description: 'Page header text.', required: false },
      { name: 'h', type: '1 | 2 | 3 | 4 | 5', description: 'Heading level. Defaults to 2.', required: false, default: '2' },
      { name: 'icon', type: 'string', description: 'Material icon name to render before the header.', required: false },
      { name: 'hint', type: 'string', description: 'Subtle hint shown beside or below the header.', required: false },
      { name: 'scroll', type: "'all' | 'body' | 'locked'", description: 'Scroll lock mode: `all` scrolls together, `body` keeps header fixed, `locked` disables scrolling.', required: false, default: 'all' }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content select="[sectionHeader]"></ng-content>; <ng-content></ng-content>',
    relatedSlugs: ['section', 'content-page'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks', 'dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/layout/section/section.page.component.ts',
    example: `<dbx-section-page header="Dashboard" icon="dashboard" scroll="body">
  <p>Top-level page content.</p>
</dbx-section-page>`,
    minimalExample: `<dbx-section-page header="Page"><p>Body</p></dbx-section-page>`
  },
  {
    slug: 'section-header',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-section-header,.dbx-section-header',
    className: 'DbxSectionHeaderComponent',
    module: '@dereekb/dbx-web',
    description: 'Standalone section header — usable as an element or attribute. Powers `dbx-section`, `dbx-section-page`, and bespoke layouts that need the same heading look without a wrapping section.',
    inputs: [
      { name: 'headerConfig', type: 'DbxSectionHeaderConfig', description: 'Composite config object with all header fields.', required: false },
      { name: 'header', type: 'string', description: 'Header text.', required: false },
      { name: 'h', type: '1 | 2 | 3 | 4 | 5', description: 'Heading level.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon name.', required: false },
      { name: 'hint', type: 'string', description: 'Subtle hint.', required: false },
      { name: 'hintInline', type: 'boolean', description: 'Render hint inline instead of below.', required: false },
      { name: 'onlyHeader', type: 'boolean', description: 'Hide non-header content.', required: false }
    ],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['section', 'subsection'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/section/section.header.component.ts',
    example: `<div class="dbx-section-header" header="Custom Layout" [h]="2" icon="info"></div>`,
    minimalExample: `<dbx-section-header header="My Header"></dbx-section-header>`
  },
  {
    slug: 'two-column',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-two-column',
    className: 'DbxTwoColumnComponent',
    module: '@dereekb/dbx-web',
    description: 'Responsive split layout — narrow left column + wider right column. Hides the left column at narrow viewports based on `minRightWidth`. Requires a parent `TwoColumnsContextStore` (provided automatically by `dbx-two-column-right`).',
    inputs: [
      { name: 'reverseSizing', type: 'boolean', description: 'Make the left column larger than the right.', required: false, default: 'false' },
      { name: 'inSectionPage', type: 'boolean', description: 'Hint that the layout is rendered inside a `dbx-section-page` for proper height behavior.', required: false, default: 'false' },
      { name: 'hasRightContent', type: 'boolean', description: 'Force the right column to render even without a `dbx-two-column-right` child.', required: false, default: 'false' }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content select="[left]"></ng-content>; <ng-content select="[right]"></ng-content>',
    relatedSlugs: ['two-column-right'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks', 'dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/layout/column/two/two.column.component.ts',
    example: `<dbx-two-column [inSectionPage]="true">
  <dbx-list left [state$]="state$" [config]="listConfig" />
  <dbx-two-column-right right header="Detail">
    <p>Selected item detail.</p>
  </dbx-two-column-right>
</dbx-two-column>`,
    minimalExample: `<dbx-two-column>
  <div left>Sidebar</div>
  <div right>Main</div>
</dbx-two-column>`
  },
  {
    slug: 'two-column-right',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-two-column-right',
    className: 'DbxTwoColumnRightComponent',
    module: '@dereekb/dbx-web',
    description: 'Wraps the right column of a `dbx-two-column` with a navigation bar — back button, optional title, and projected `[nav]` slot. Auto-registers with the `TwoColumnsContextStore` so the parent shows the right column.',
    inputs: [
      { name: 'header', type: 'string', description: 'Title text rendered in the nav bar.', required: false },
      { name: 'full', type: 'boolean', description: 'Expand the header bar to full width.', required: false, default: 'false' },
      { name: 'block', type: 'boolean', description: 'Use block-level display for the header bar.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content select="[nav]"></ng-content>; <ng-content></ng-content>',
    relatedSlugs: ['two-column'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks', 'dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/layout/column/two/two.column.right.component.ts',
    example: `<dbx-two-column-right header="Item Detail">
  <button nav mat-icon-button><mat-icon>delete</mat-icon></button>
  <p>Body content</p>
</dbx-two-column-right>`,
    minimalExample: `<dbx-two-column-right>Body</dbx-two-column-right>`
  },
  {
    slug: 'content-container',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content-container,[dbxContentContainer],.dbx-content-container',
    className: 'DbxContentContainerDirective',
    module: '@dereekb/dbx-web',
    description: 'Sets up a content container with consistent grow / padding / max-width behavior. Use as the first wrapper inside top-level page content to inherit the standard content layout.',
    inputs: [
      { name: 'grow', type: "'full' | 'auto' | 'none'", description: 'Vertical growth behavior.', required: false },
      { name: 'padding', type: "'none' | 'small' | 'normal' | 'large'", description: 'Inner padding preset.', required: false },
      { name: 'max', type: 'string | number', description: 'Maximum content width.', required: false }
    ],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['content', 'content-page', 'content-box'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/content/content.container.directive.ts',
    example: `<dbx-content-container grow="full" padding="normal">
  <p>Page body</p>
</dbx-content-container>`,
    minimalExample: `<div dbxContentContainer>Body</div>`
  },
  {
    slug: 'content',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content,[dbxContent]',
    className: 'DbxContentDirective',
    module: '@dereekb/dbx-web',
    description: 'Marker directive that applies the canonical content class. Pair with `dbx-content-container` for the standard page-content layout.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['content-container', 'content-page', 'content-box'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/content/content.directive.ts',
    example: `<div dbxContent>
  <p>Standard content body</p>
</div>`,
    minimalExample: `<dbx-content>Body</dbx-content>`
  },
  {
    slug: 'content-page',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content-page,[dbxContentPage]',
    className: 'DbxContentPageDirective',
    module: '@dereekb/dbx-web',
    description: 'Applies the full-height content-page class. Use as the root wrapper for top-level routes that should fill the viewport.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['content-container', 'section-page'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/content/content.page.directive.ts',
    example: `<div dbxContentPage>
  <dbx-section-page header="Dashboard"><p>...</p></dbx-section-page>
</div>`,
    minimalExample: `<dbx-content-page>Page</dbx-content-page>`
  },
  {
    slug: 'content-box',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content-box, [dbxContentBox]',
    className: 'DbxContentBoxDirective',
    module: '@dereekb/dbx-web',
    description: 'Outlined content box with consistent padding. Use for grouping form fields or summary blocks that need a subtle outline without elevation.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['content', 'content-elevate', 'content-pit'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/content/content.box.directive.ts',
    example: `<dbx-content-box>
  <p>Summary content</p>
</dbx-content-box>`,
    minimalExample: `<div dbxContentBox>Body</div>`
  },
  {
    slug: 'content-elevate',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content-elevate,[dbxContentElevate]',
    className: 'DbxContentElevateDirective',
    module: '@dereekb/dbx-web',
    description: 'Card-like elevated content surface. Apply to highlight a content block above its surroundings.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['content-box', 'content-pit'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/content/content.elevate.directive.ts',
    example: `<div dbxContentElevate>Highlighted block</div>`,
    minimalExample: `<dbx-content-elevate>Body</dbx-content-elevate>`
  },
  {
    slug: 'content-pit',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-content-pit, [dbxContentPit]',
    className: 'DbxContentPitDirective',
    module: '@dereekb/dbx-web',
    description: 'Inset (pit) content surface — visually recessed compared to the page background.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['content-box', 'content-elevate'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/content/content.pit.directive.ts',
    example: `<div dbxContentPit>Inset block</div>`,
    minimalExample: `<dbx-content-pit>Body</dbx-content-pit>`
  },
  {
    slug: 'flex-group',
    category: 'layout',
    kind: 'directive',
    selector: '[dbxFlexGroup]',
    className: 'DbxFlexGroupDirective',
    module: '@dereekb/dbx-web',
    description: 'Flex container that lays children out as a horizontal group with optional breakpoint stacking. Pair with `[dbxFlexSize]` on each child to size columns.',
    inputs: [{ name: 'breakpoint', type: 'ScreenMediaWidthType', description: 'Breakpoint at or below which children stack vertically.', required: false }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['flex-size', 'bar'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/flex/flex.group.directive.ts',
    example: `<div dbxFlexGroup breakpoint="sm">
  <div dbxFlexSize="2">Wide</div>
  <div dbxFlexSize="1">Narrow</div>
</div>`,
    minimalExample: `<div dbxFlexGroup><div dbxFlexSize="1">A</div></div>`
  },
  {
    slug: 'flex-size',
    category: 'layout',
    kind: 'directive',
    selector: '[dbxFlexSize]',
    className: 'DbxFlexSizeDirective',
    module: '@dereekb/dbx-web',
    description: "Sets a child's flex size within a `[dbxFlexGroup]` container. Sizes are unit-less weights — `1`, `2`, `3` distribute available space proportionally.",
    inputs: [{ name: 'dbxFlexSize', type: 'DbxFlexSize', description: 'Flex weight (number) for this child.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['flex-group'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/flex/flex.size.directive.ts',
    example: `<div dbxFlexGroup>
  <div dbxFlexSize="2">Twice as wide</div>
  <div dbxFlexSize="1">Narrow</div>
</div>`,
    minimalExample: `<div dbxFlexSize="1"></div>`
  },
  {
    slug: 'bar',
    category: 'layout',
    kind: 'directive',
    selector: 'dbx-bar,[dbxBar]',
    className: 'DbxBarDirective',
    module: '@dereekb/dbx-web',
    description: 'Horizontal bar layout. Use for toolbars, action rows, and inline button strips. Composes with `dbx-button-spacer` for consistent spacing.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['bar-header', 'pagebar', 'button-spacer'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/bar/bar.directive.ts',
    example: `<dbx-bar>
  <dbx-button text="Save" raised color="primary"></dbx-button>
  <dbx-button-spacer></dbx-button-spacer>
  <dbx-button text="Cancel" stroked></dbx-button>
</dbx-bar>`,
    minimalExample: `<dbx-bar><button>A</button><button>B</button></dbx-bar>`
  },
  {
    slug: 'bar-header',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-bar-header',
    className: 'DbxBarHeaderComponent',
    module: '@dereekb/dbx-web',
    description: 'Bar with a heading on the left and projected actions on the right. Use as a section banner with inline controls.',
    inputs: [
      { name: 'header', type: 'string', description: 'Header text.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon name shown before the header.', required: false }
    ],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['bar', 'pagebar'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/bar/bar.header.component.ts',
    example: `<dbx-bar-header header="Members" icon="group">
  <button mat-icon-button><mat-icon>add</mat-icon></button>
</dbx-bar-header>`,
    minimalExample: `<dbx-bar-header header="Title"></dbx-bar-header>`
  },
  {
    slug: 'pagebar',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-pagebar',
    className: 'DbxPagebarComponent',
    module: '@dereekb/dbx-web',
    description: 'Page-level toolbar. Pin to the top of a `dbx-content-page` for breadcrumbs, page title, and persistent actions.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['bar', 'navbar'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks', 'dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/layout/bar/pagebar.component.ts',
    example: `<dbx-pagebar>
  <h2>Settings</h2>
  <span class="spacer"></span>
  <button mat-stroked-button>Save</button>
</dbx-pagebar>`,
    minimalExample: `<dbx-pagebar>Title</dbx-pagebar>`
  },
  {
    slug: 'spacer',
    category: 'layout',
    kind: 'component',
    selector: 'dbx-spacer, [dbxSpacer]',
    className: 'DbxSpacerComponent',
    module: '@dereekb/dbx-web',
    description: 'Visual spacer used inside bars and rows to push siblings apart.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['bar', 'button-spacer'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/compact/compact.directive.ts',
    example: `<dbx-bar>
  <span>Title</span>
  <dbx-spacer></dbx-spacer>
  <button mat-button>Action</button>
</dbx-bar>`,
    minimalExample: `<dbx-spacer></dbx-spacer>`
  },

  // =====================================================================
  // LIST
  // =====================================================================
  {
    slug: 'list',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list',
    className: 'DbxListComponent',
    module: '@dereekb/dbx-web',
    description: 'Reactive list container — renders an injected `DbxListView` against a `ListLoadingState` observable, with infinite scroll, loading state, and empty content support. The primary list primitive.',
    inputs: [
      { name: 'state$', type: 'Observable<ListLoadingState<T>>', description: 'Source loading state observable feeding items into the list.', required: true },
      { name: 'config', type: 'DbxListConfig<T>', description: 'View component class + per-item config injected into the list.', required: true },
      { name: 'loadMore', type: 'DbxListLoadMoreHandler', description: 'Callback fired when the user scrolls past the threshold. Return an Observable to throttle.', required: false },
      { name: 'loadMoreOnBoot', type: 'boolean', description: 'Whether to call `loadMore` immediately on first render.', required: false }
    ],
    outputs: [{ name: 'contentScrolled', emits: 'number', description: 'Emits the scroll top position whenever the list scrolls.' }],
    relatedSlugs: ['list-view', 'list-empty-content', 'list-grid-view', 'list-accordion-view', 'selection-list-view'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/list.component.ts',
    example: `<dbx-list [state$]="items$" [config]="listConfig" (contentScrolled)="onScroll($event)"></dbx-list>`,
    minimalExample: `<dbx-list [state$]="items$" [config]="listConfig"></dbx-list>`
  },
  {
    slug: 'list-view',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-view',
    className: 'DbxValueListViewComponent',
    module: '@dereekb/dbx-web',
    description: 'Default value list view rendering each item as a clickable list row. Pair with `DbxValueListItem` configs for the row template.',
    inputs: [{ name: 'config', type: 'DbxValueListViewConfig<T, I>', description: 'Per-item template / icon / label provider.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['list', 'selection-list-view', 'list-grid-view', 'list-accordion-view'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/list.view.value.component.ts',
    example: `<dbx-list-view [config]="rowConfig"></dbx-list-view>`,
    minimalExample: `<dbx-list-view [config]="rowConfig"></dbx-list-view>`
  },
  {
    slug: 'selection-list-view',
    category: 'list',
    kind: 'component',
    selector: 'dbx-selection-list-view',
    className: 'DbxSelectionValueListViewComponent',
    module: '@dereekb/dbx-web',
    description: 'Selection variant of `dbx-list-view`. Renders a checkbox per row and exposes a selection state. Use for multi-select pickers.',
    inputs: [
      { name: 'config', type: 'DbxSelectionValueListViewConfig<T, I>', description: 'Selection-aware list config.', required: true },
      { name: 'selectionMode', type: 'DbxListSelectionMode', description: 'Selection behavior — `single`, `multi`, or `view`.', required: false }
    ],
    outputs: [{ name: 'selectionStateChange', emits: 'ListSelectionState<T>', description: 'Emits the current selection state when items are checked/unchecked.' }],
    relatedSlugs: ['list', 'list-view'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/list.view.value.selection.component.ts',
    example: `<dbx-selection-list-view [config]="rowConfig" selectionMode="multi"></dbx-selection-list-view>`,
    minimalExample: `<dbx-selection-list-view [config]="rowConfig"></dbx-selection-list-view>`
  },
  {
    slug: 'list-grid-view',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-grid-view',
    className: 'DbxValueListGridViewComponent',
    module: '@dereekb/dbx-web',
    description: 'Grid layout variant of `dbx-list-view`. Renders items as a responsive grid instead of a vertical list. Pair with `[dbxListGridSize]` for cell sizing.',
    inputs: [{ name: 'config', type: 'DbxValueListGridViewConfig<T, I>', description: 'Per-item config.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['list', 'list-view'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/grid/list.grid.view.component.ts',
    example: `<dbx-list-grid-view [config]="cellConfig" dbxListGridSize="md"></dbx-list-grid-view>`,
    minimalExample: `<dbx-list-grid-view [config]="cellConfig"></dbx-list-grid-view>`
  },
  {
    slug: 'list-accordion-view',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-accordion-view',
    className: 'DbxValueListAccordionViewComponent',
    module: '@dereekb/dbx-web',
    description: 'Accordion-styled list view — items expand inline to reveal projected detail content.',
    inputs: [{ name: 'config', type: 'DbxValueListAccordionViewConfig<T, I>', description: 'Per-item header + expanded body config.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['list', 'list-view'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/accordion/list.accordion.view.component.ts',
    example: `<dbx-list-accordion-view [config]="rowConfig"></dbx-list-accordion-view>`,
    minimalExample: `<dbx-list-accordion-view [config]="rowConfig"></dbx-list-accordion-view>`
  },
  {
    slug: 'list-empty-content',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-empty-content',
    className: 'DbxListEmptyContentComponent',
    module: '@dereekb/dbx-web',
    description: 'Empty-state slot for `dbx-list`. Project into a list to render custom empty content when the loading state has no items.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['list'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/list.content.empty.component.ts',
    example: `<dbx-list [state$]="items$" [config]="listConfig">
  <dbx-list-empty-content>
    <p>No items yet — add one to get started.</p>
  </dbx-list-empty-content>
</dbx-list>`,
    minimalExample: `<dbx-list-empty-content>Empty</dbx-list-empty-content>`
  },
  {
    slug: 'list-title-group-header',
    category: 'list',
    kind: 'component',
    selector: 'dbx-list-title-group-header',
    className: 'DbxValueListTitleGroupHeaderComponent',
    module: '@dereekb/dbx-web',
    description: 'Header row used by grouped list views. Pair with `[dbxListTitleGroup]` to group items by a derived title.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['list', 'list-view'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/layout/list/group/list.group.title.component.ts',
    example: `<dbx-list-view [config]="rowConfig" dbxListTitleGroup></dbx-list-view>`,
    minimalExample: `<dbx-list-title-group-header></dbx-list-title-group-header>`
  },

  // =====================================================================
  // BUTTON
  // =====================================================================
  {
    slug: 'button',
    category: 'button',
    kind: 'component',
    selector: 'dbx-button',
    className: 'DbxButtonComponent',
    module: '@dereekb/dbx-web',
    description: 'Canonical action button. Wraps Material button styles (basic / raised / stroked / flat / tonal / fab) with progress spinner / progress bar working states. Integrates with `[dbxAction]` to drive disabled/working state automatically.',
    inputs: [
      { name: 'text', type: 'string', description: 'Button text. Provide via input or as projected content.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon name. Renders before text, or alone for icon-only buttons.', required: false },
      { name: 'raised', type: 'boolean', description: 'Use Material raised button style.', required: false, default: 'false' },
      { name: 'stroked', type: 'boolean', description: 'Use Material stroked button style.', required: false, default: 'false' },
      { name: 'flat', type: 'boolean', description: 'Use Material flat button style.', required: false, default: 'false' },
      { name: 'tonal', type: 'boolean', description: 'Use Material tonal button style.', required: false, default: 'false' },
      { name: 'basic', type: 'boolean', description: 'Use Material basic button style (default).', required: false, default: 'false' },
      { name: 'iconOnly', type: 'boolean', description: 'Render as a Material icon button.', required: false, default: 'false' },
      { name: 'fab', type: 'boolean', description: 'Render as a Material floating action button.', required: false, default: 'false' },
      { name: 'bar', type: 'boolean', description: 'Use a progress bar instead of a spinner for working state.', required: false, default: 'false' },
      { name: 'color', type: 'ThemePalette | DbxThemeColor', description: 'Material color (`primary`, `accent`, `warn`) or dbx theme color.', required: false },
      { name: 'working', type: 'boolean', description: 'Forces the button into a working/loading state.', required: false }
    ],
    outputs: [{ name: 'btnClick', emits: 'MouseEvent', description: 'Emits when the button is clicked (suppressed while working/disabled).' }],
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['icon-button', 'button-spacer', 'progress-bar-button', 'progress-spinner-button'],
    skillRefs: ['dbx__ref__dbx-component-patterns', 'dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/button/button.component.ts',
    example: `<dbx-button text="Save changes" raised color="primary" [dbxAction]="saveAction"></dbx-button>`,
    minimalExample: `<dbx-button text="Click me"></dbx-button>`
  },
  {
    slug: 'icon-button',
    category: 'button',
    kind: 'component',
    selector: 'dbx-icon-button',
    className: 'DbxIconButtonComponent',
    module: '@dereekb/dbx-web',
    description: 'Deprecated icon button. Prefer `dbx-button` with `iconOnly` and `icon="..."` for new code. Kept for migration of existing call sites — see the `dbx__migration__migrate-dbx-icon-button` skill.',
    inputs: [
      { name: 'icon', type: 'string', description: 'Material icon name.', required: true },
      { name: 'color', type: 'ThemePalette | DbxThemeColor', description: 'Button color.', required: false }
    ],
    outputs: [{ name: 'btnClick', emits: 'MouseEvent', description: 'Click event.' }],
    relatedSlugs: ['button'],
    skillRefs: ['dbx__migration__migrate-dbx-icon-button'],
    sourcePath: 'lib/button/icon/icon.button.component.ts',
    example: `<dbx-icon-button icon="delete" color="warn" [dbxAction]="deleteAction"></dbx-icon-button>`,
    minimalExample: `<dbx-icon-button icon="add"></dbx-icon-button>`
  },
  {
    slug: 'button-spacer',
    category: 'button',
    kind: 'directive',
    selector: 'dbx-button-spacer,[dbxButtonSpacer]',
    className: 'DbxButtonSpacerDirective',
    module: '@dereekb/dbx-web',
    description: 'Inline spacer between buttons. Use to keep consistent gaps inside `dbx-bar` action rows without adding ad-hoc CSS.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['bar', 'spacer', 'button'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/button/button.spacer.directive.ts',
    example: `<dbx-bar>
  <dbx-button text="Save" raised></dbx-button>
  <dbx-button-spacer></dbx-button-spacer>
  <dbx-button text="Cancel"></dbx-button>
</dbx-bar>`,
    minimalExample: `<dbx-button-spacer></dbx-button-spacer>`
  },
  {
    slug: 'progress-bar-button',
    category: 'button',
    kind: 'component',
    selector: 'dbx-progress-bar-button,dbx-bar-button',
    className: 'DbxProgressBarButtonComponent',
    module: '@dereekb/dbx-web',
    description: 'Material button with a progress bar overlay during work. Powers `dbx-button` when the `bar` flag is set; rarely used directly.',
    inputs: [{ name: 'config', type: 'DbxProgressButtonConfig', description: 'Composite config controlling text, icon, color, and working state.', required: true }],
    outputs: [{ name: 'btnClick', emits: 'MouseEvent', description: 'Click event.' }],
    relatedSlugs: ['button', 'progress-spinner-button'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/button/progress/button.progress.bar.component.ts',
    example: `<dbx-progress-bar-button [config]="cfg" (btnClick)="onClick()"></dbx-progress-bar-button>`,
    minimalExample: `<dbx-progress-bar-button [config]="cfg"></dbx-progress-bar-button>`
  },
  {
    slug: 'progress-spinner-button',
    category: 'button',
    kind: 'component',
    selector: 'dbx-progress-spinner-button,dbx-spinner-button',
    className: 'DbxProgressSpinnerButtonComponent',
    module: '@dereekb/dbx-web',
    description: 'Material button with a progress spinner overlay during work. Powers `dbx-button` by default; rarely used directly.',
    inputs: [{ name: 'config', type: 'DbxProgressButtonConfig', description: 'Composite config controlling text, icon, color, and working state.', required: true }],
    outputs: [{ name: 'btnClick', emits: 'MouseEvent', description: 'Click event.' }],
    relatedSlugs: ['button', 'progress-bar-button'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/button/progress/button.progress.spinner.component.ts',
    example: `<dbx-progress-spinner-button [config]="cfg" (btnClick)="onClick()"></dbx-progress-spinner-button>`,
    minimalExample: `<dbx-progress-spinner-button [config]="cfg"></dbx-progress-spinner-button>`
  },

  // =====================================================================
  // CARD
  // =====================================================================
  {
    slug: 'card-box',
    category: 'card',
    kind: 'component',
    selector: 'dbx-card-box',
    className: 'DbxCardBoxComponent',
    module: '@dereekb/dbx-web',
    description: 'Card box with header, body, and optional anchor wrapping. Use for individual cards in a card grid or list. Pair with `dbx-card-box-container` for grid layout.',
    inputs: [
      { name: 'header', type: 'string', description: 'Card header text.', required: false },
      { name: 'subhead', type: 'string', description: 'Smaller text below the header.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon shown in the header.', required: false },
      { name: 'anchor', type: 'ClickableAnchor', description: 'Click target — wraps the whole card in a `dbx-anchor`.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['card-box-container'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/card/card.box.component.ts',
    example: `<dbx-card-box header="Profile" subhead="Update your details" icon="person" [anchor]="profileAnchor">
  <p>Profile body content.</p>
</dbx-card-box>`,
    minimalExample: `<dbx-card-box header="Card"><p>Body</p></dbx-card-box>`
  },
  {
    slug: 'card-box-container',
    category: 'card',
    kind: 'directive',
    selector: 'dbx-card-box-container, [dbxCardBoxContainer]',
    className: 'DbxCardBoxContainerDirective',
    module: '@dereekb/dbx-web',
    description: 'Responsive grid container for `dbx-card-box` elements. Wraps cards in a flow that stacks at narrow viewports.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['card-box'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/card/card.box.container.directive.ts',
    example: `<dbx-card-box-container>
  <dbx-card-box header="One"></dbx-card-box>
  <dbx-card-box header="Two"></dbx-card-box>
</dbx-card-box-container>`,
    minimalExample: `<div dbxCardBoxContainer><dbx-card-box></dbx-card-box></div>`
  },

  // =====================================================================
  // FEEDBACK
  // =====================================================================
  {
    slug: 'loading',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-loading',
    className: 'DbxLoadingComponent',
    module: '@dereekb/dbx-web',
    description: 'Reactive loading wrapper — renders a spinner / progress bar while a `LoadingState` is loading, surfaces errors via `dbx-error`, and projects the loaded content otherwise. The default choice for any `LoadingState`-driven view.',
    inputs: [
      { name: 'state', type: 'Maybe<LoadingState<unknown>>', description: 'Loading state to react to. When loading, show progress; on error, show the error widget; otherwise, show projected content.', required: false },
      { name: 'show', type: 'boolean', description: 'Force-show or hide the loading UI regardless of state.', required: false },
      { name: 'mode', type: "'spinner' | 'bar'", description: 'Progress indicator style.', required: false, default: 'spinner' },
      { name: 'text', type: 'string', description: 'Optional loading message to display alongside the indicator.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['basic-loading', 'loading-progress', 'error'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/loading/loading.component.ts',
    example: `<dbx-loading [state]="state$ | async" text="Loading items...">
  <dbx-list [state$]="state$" [config]="listConfig"></dbx-list>
</dbx-loading>`,
    minimalExample: `<dbx-loading [state]="state$ | async">Body</dbx-loading>`
  },
  {
    slug: 'basic-loading',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-basic-loading',
    className: 'DbxBasicLoadingComponent',
    module: '@dereekb/dbx-web',
    description: 'Lower-level loading view — renders a progress indicator and projected content without `LoadingState` wiring. Use when you only have a boolean `loading` flag.',
    inputs: [
      { name: 'show', type: 'boolean', description: 'Whether the loading UI is visible.', required: false, default: 'false' },
      { name: 'mode', type: "'spinner' | 'bar'", description: 'Indicator style.', required: false, default: 'spinner' },
      { name: 'text', type: 'string', description: 'Optional loading text.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['loading', 'loading-progress'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/loading/basic.loading.component.ts',
    example: `<dbx-basic-loading [show]="loading" mode="bar" text="Saving..."></dbx-basic-loading>`,
    minimalExample: `<dbx-basic-loading [show]="loading"></dbx-basic-loading>`
  },
  {
    slug: 'loading-progress',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-loading-progress',
    className: 'DbxLoadingProgressComponent',
    module: '@dereekb/dbx-web',
    description: 'Just the progress indicator — spinner or bar — without the `dbx-loading` content projection. Use inside custom layouts where you need fine-grained control.',
    inputs: [
      { name: 'mode', type: "'spinner' | 'bar'", description: 'Indicator style.', required: false, default: 'spinner' },
      { name: 'diameter', type: 'number', description: 'Spinner diameter in pixels.', required: false }
    ],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['loading', 'basic-loading'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/loading/loading.progress.component.ts',
    example: `<dbx-loading-progress mode="bar"></dbx-loading-progress>`,
    minimalExample: `<dbx-loading-progress></dbx-loading-progress>`
  },
  {
    slug: 'error',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-error',
    className: 'DbxErrorComponent',
    module: '@dereekb/dbx-web',
    description: 'Renders a `ReadableError` with an icon, message, and optional details popover. Used internally by `dbx-loading`; surface directly when handling errors outside a loading wrapper.',
    inputs: [{ name: 'error', type: 'Maybe<ReadableError>', description: 'Error to display. When undefined, the component renders nothing.', required: false }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['error-snackbar', 'error-view', 'loading'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/error/error.component.ts',
    example: `<dbx-error [error]="error$ | async"></dbx-error>`,
    minimalExample: `<dbx-error [error]="error"></dbx-error>`
  },
  {
    slug: 'error-snackbar',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-error-snackbar',
    className: 'DbxErrorSnackbarComponent',
    module: '@dereekb/dbx-web',
    description: 'Material snackbar variant of `dbx-error`. Used by `DbxErrorSnackbarService` to show transient error toasts; rarely instantiated directly.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['error'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/error/error.snackbar.component.ts',
    example: `// Triggered via DbxErrorSnackbarService.showError(error)`,
    minimalExample: `<dbx-error-snackbar></dbx-error-snackbar>`
  },
  {
    slug: 'error-view',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-error-view',
    className: 'DbxErrorViewComponent',
    module: '@dereekb/dbx-web',
    description: 'Inline error display with retry support. Project a retry button or use with `[dbxAction]` for action-driven retries.',
    inputs: [{ name: 'error', type: 'Maybe<ReadableError>', description: 'Error to display.', required: false }],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['error', 'error-snackbar'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/error/error.view.component.ts',
    example: `<dbx-error-view [error]="error">
  <dbx-button text="Retry" [dbxAction]="retryAction"></dbx-button>
</dbx-error-view>`,
    minimalExample: `<dbx-error-view [error]="error"></dbx-error-view>`
  },
  {
    slug: 'intro-action-section',
    category: 'feedback',
    kind: 'component',
    selector: 'dbx-intro-action-section',
    className: 'DbxIntroActionSectionComponent',
    module: '@dereekb/dbx-web',
    description: 'Onboarding/empty-state component — shows an intro message with a primary action button until the user clicks through, then projects the main content. Use for first-run flows or empty list states with a clear next step.',
    inputs: [
      { name: 'hint', type: 'string', description: 'Intro message text.', required: false },
      { name: 'action', type: 'string', description: 'Action button label.', required: false },
      { name: 'showIntro', type: 'boolean', description: 'Whether to render the intro state. Defaults to true.', required: false, default: 'true' }
    ],
    outputs: [{ name: 'showAction', emits: 'void', description: 'Emits when the action button is clicked.' }],
    contentProjection: '<ng-content select="[info]"></ng-content>; <ng-content></ng-content>',
    relatedSlugs: ['section', 'list-empty-content'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/section/section.intro.component.ts',
    example: `<dbx-intro-action-section
  hint="Welcome! Click below to get started."
  action="Get Started"
  [showIntro]="!hasOnboarded"
  (showAction)="markOnboarded()">
  <p>Main content shown after the action.</p>
</dbx-intro-action-section>`,
    minimalExample: `<dbx-intro-action-section hint="Welcome" action="Start"><p>Body</p></dbx-intro-action-section>`
  },

  // =====================================================================
  // OVERLAY
  // =====================================================================
  {
    slug: 'dialog-content',
    category: 'overlay',
    kind: 'directive',
    selector: 'dbx-dialog-content,[dbxDialogContent],.dbx-dialog-content',
    className: 'DbxDialogContentDirective',
    module: '@dereekb/dbx-web',
    description: 'Wraps the body of a Material dialog in dbx-styled chrome. Pair with `dbx-dialog-content-close` and `dbx-dialog-content-footer` for a complete dialog layout.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['popover', 'popup', 'prompt'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/interaction/dialog/dialog.content.directive.ts',
    example: `<dbx-dialog-content>
  <h2>Confirm</h2>
  <p>Are you sure?</p>
</dbx-dialog-content>`,
    minimalExample: `<div dbxDialogContent>Body</div>`
  },
  {
    slug: 'popover',
    category: 'overlay',
    kind: 'component',
    selector: 'dbx-popover',
    className: 'DbxPopoverComponent',
    module: '@dereekb/dbx-web',
    description: 'Anchored popover overlay. Hosts injected content via `DbxPopoverController`; opened through `DbxPopoverService.open(...)` rather than placed in a template directly.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['popup', 'prompt-confirm', 'dialog-content'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/interaction/popover/popover.component.ts',
    example: `// In a service: this.popoverService.open({ content: MyContentComponent, origin })`,
    minimalExample: `<dbx-popover></dbx-popover>`
  },
  {
    slug: 'popup',
    category: 'overlay',
    kind: 'component',
    selector: 'dbx-popup',
    className: 'DbxPopupComponent',
    module: '@dereekb/dbx-web',
    description: 'Floating popup overlay (movable / dockable). Like a popover but designed for longer-lived UI. Opened via `DbxPopupService.open(...)`.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['popover'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/interaction/popup/popup.component.ts',
    example: `// In a service: this.popupService.open({ content: MyContentComponent })`,
    minimalExample: `<dbx-popup></dbx-popup>`
  },
  {
    slug: 'prompt',
    category: 'overlay',
    kind: 'component',
    selector: 'dbx-prompt',
    className: 'DbxPromptComponent',
    module: '@dereekb/dbx-web',
    description: 'Inline prompt body — title, hint, and projected actions. Used inside dialogs/popovers for confirm-style prompts. Pair with `dbx-prompt-confirm` for a one-button confirm.',
    inputs: [
      { name: 'header', type: 'string', description: 'Prompt header text.', required: false },
      { name: 'prompt', type: 'string', description: 'Prompt body text.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['prompt-confirm', 'dialog-content'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/interaction/prompt/prompt.component.ts',
    example: `<dbx-prompt header="Delete account" prompt="This cannot be undone.">
  <button mat-button (click)="cancel()">Cancel</button>
  <button mat-flat-button color="warn" (click)="confirm()">Delete</button>
</dbx-prompt>`,
    minimalExample: `<dbx-prompt header="Confirm"></dbx-prompt>`
  },
  {
    slug: 'prompt-confirm',
    category: 'overlay',
    kind: 'component',
    selector: 'dbx-prompt-confirm',
    className: 'DbxPromptConfirmComponent',
    module: '@dereekb/dbx-web',
    description: 'Confirmation prompt with built-in confirm/cancel buttons. Used inside `DbxPromptConfirmDialogComponent`; rarely instantiated directly.',
    inputs: [{ name: 'config', type: 'DbxPromptConfirmConfig', description: 'Header, message, and button label config.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['prompt', 'action-confirm'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/interaction/prompt/prompt.confirm.component.ts',
    example: `<dbx-prompt-confirm [config]="{ header: 'Delete?', confirmText: 'Delete', cancelText: 'Cancel' }"></dbx-prompt-confirm>`,
    minimalExample: `<dbx-prompt-confirm [config]="cfg"></dbx-prompt-confirm>`
  },

  // =====================================================================
  // NAVIGATION / ROUTER
  // =====================================================================
  {
    slug: 'anchor',
    category: 'router',
    kind: 'component',
    selector: 'dbx-anchor, [dbx-anchor]',
    className: 'DbxAnchorComponent',
    module: '@dereekb/dbx-web',
    description: 'UIRouter-aware anchor wrapper. Renders an `<a>` for `ClickableAnchor` configs (sref / url / onClick / disabled) and forwards content through. The default way to wire navigation in dbx-web.',
    inputs: [
      { name: 'anchor', type: 'Maybe<ClickableAnchor>', description: 'Anchor config — sref, url, onClick handler, or disabled flag.', required: false },
      { name: 'block', type: 'boolean', description: 'Render as a block-level element.', required: false, default: 'false' }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['anchor-list', 'navbar', 'sidenav'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/router/layout/anchor/anchor.component.ts',
    example: `<dbx-anchor [anchor]="{ ref: 'app.home' }">
  <button mat-button>Home</button>
</dbx-anchor>`,
    minimalExample: `<dbx-anchor [anchor]="{ url: '/' }">Home</dbx-anchor>`
  },
  {
    slug: 'anchor-list',
    category: 'router',
    kind: 'component',
    selector: 'dbx-anchor-list',
    className: 'DbxAnchorListComponent',
    module: '@dereekb/dbx-web',
    description: 'Vertical list of `dbx-anchor` rows from a `ClickableAnchor[]` config. Use for sidenav menus, breadcrumb-like trails, and quick-link panels.',
    inputs: [{ name: 'anchors', type: 'Maybe<ClickableAnchor[]>', description: 'Anchor entries to render.', required: false }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['anchor', 'sidenav'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/router/layout/anchorlist/anchorlist.component.ts',
    example: `<dbx-anchor-list [anchors]="navAnchors"></dbx-anchor-list>`,
    minimalExample: `<dbx-anchor-list [anchors]="anchors"></dbx-anchor-list>`
  },
  {
    slug: 'navbar',
    category: 'navigation',
    kind: 'component',
    selector: 'dbx-navbar',
    className: 'DbxNavbarComponent',
    module: '@dereekb/dbx-web',
    description: 'Top-of-page navigation bar. Renders horizontal anchor tabs with active-state tracking via UIRouter transitions.',
    inputs: [{ name: 'anchors', type: 'Maybe<ClickableAnchor[]>', description: 'Top-level navigation anchors.', required: false }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['anchor', 'sidenav', 'pagebar'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/router/layout/navbar/navbar.component.ts',
    example: `<dbx-navbar [anchors]="topNav"></dbx-navbar>`,
    minimalExample: `<dbx-navbar [anchors]="anchors"></dbx-navbar>`
  },
  {
    slug: 'sidenav',
    category: 'navigation',
    kind: 'component',
    selector: 'dbx-sidenav',
    className: 'DbxSidenavComponent',
    module: '@dereekb/dbx-web',
    description: 'Left-side navigation drawer that toggles with a Material sidenav. Pair with `dbx-sidenav-page` to scaffold a full app layout.',
    inputs: [{ name: 'anchors', type: 'Maybe<ClickableAnchor[]>', description: 'Sidenav navigation anchors.', required: false }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['sidenav-page', 'anchor-list'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/router/layout/sidenav/sidenav.component.ts',
    example: `<dbx-sidenav [anchors]="sidenavAnchors"></dbx-sidenav>`,
    minimalExample: `<dbx-sidenav [anchors]="anchors"></dbx-sidenav>`
  },
  {
    slug: 'sidenav-page',
    category: 'navigation',
    kind: 'component',
    selector: 'dbx-sidenav-page',
    className: 'DbxSidenavPageComponent',
    module: '@dereekb/dbx-web',
    description: 'Full sidenav + content page layout. Combines `dbx-sidenav` with a content area; the canonical scaffold for app/admin shells.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['sidenav', 'navbar'],
    skillRefs: ['dbx__ref__dbx-app-structure'],
    sourcePath: 'lib/router/layout/sidenav/sidenav.page.component.ts',
    example: `<dbx-sidenav-page>
  <ui-view></ui-view>
</dbx-sidenav-page>`,
    minimalExample: `<dbx-sidenav-page>Content</dbx-sidenav-page>`
  },

  // =====================================================================
  // TEXT
  // =====================================================================
  {
    slug: 'click-to-copy-text',
    category: 'text',
    kind: 'component',
    selector: 'dbx-click-to-copy-text',
    className: 'DbxClickToCopyTextComponent',
    module: '@dereekb/dbx-web',
    description: 'Inline text with a click-to-copy affordance. Click anywhere on the text to copy; an icon/snackbar confirms the copy.',
    inputs: [
      { name: 'text', type: 'string', description: 'Text to render and copy.', required: false },
      { name: 'copyText', type: 'string', description: 'Override of the copied text (e.g. show a friendly label, copy a raw value).', required: false }
    ],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['chip'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/text/click.to.copy.text.component.ts',
    example: `<dbx-click-to-copy-text [text]="userId"></dbx-click-to-copy-text>`,
    minimalExample: `<dbx-click-to-copy-text [text]="value"></dbx-click-to-copy-text>`
  },
  {
    slug: 'chip',
    category: 'text',
    kind: 'component',
    selector: 'dbx-chip',
    className: 'DbxChipComponent',
    module: '@dereekb/dbx-web',
    description: 'Single chip for inline labels, status flags, and pickable tags. Pair with `dbx-chip-list` for grouping.',
    inputs: [
      { name: 'text', type: 'string', description: 'Chip text.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon name.', required: false },
      { name: 'color', type: 'ThemePalette | DbxThemeColor', description: 'Chip color.', required: false }
    ],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['chip-list'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/text/chip.component.ts',
    example: `<dbx-chip text="Active" icon="check" color="primary"></dbx-chip>`,
    minimalExample: `<dbx-chip text="Tag"></dbx-chip>`
  },
  {
    slug: 'chip-list',
    category: 'text',
    kind: 'component',
    selector: 'dbx-chip-list',
    className: 'DbxChipListComponent',
    module: '@dereekb/dbx-web',
    description: 'List of `dbx-chip` items. Renders projected chips with consistent spacing and wrap behavior.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['chip'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/text/chip.list.component.ts',
    example: `<dbx-chip-list>
  <dbx-chip text="Tag1"></dbx-chip>
  <dbx-chip text="Tag2"></dbx-chip>
</dbx-chip-list>`,
    minimalExample: `<dbx-chip-list></dbx-chip-list>`
  },
  {
    slug: 'detail-block',
    category: 'text',
    kind: 'component',
    selector: 'dbx-detail-block',
    className: 'DbxDetailBlockComponent',
    module: '@dereekb/dbx-web',
    description: 'Stacked label + value block for detail pages. Renders a small label above projected content. Use for read-only field displays in profile/detail views.',
    inputs: [
      { name: 'header', type: 'string', description: 'Block label/header.', required: false },
      { name: 'icon', type: 'string', description: 'Material icon shown beside the label.', required: false }
    ],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['label-block'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/block/detail.block.component.ts',
    example: `<dbx-detail-block header="Email" icon="mail">
  <p>{{ user.email }}</p>
</dbx-detail-block>`,
    minimalExample: `<dbx-detail-block header="Label">Body</dbx-detail-block>`
  },
  {
    slug: 'label-block',
    category: 'text',
    kind: 'component',
    selector: 'dbx-label-block',
    className: 'DbxLabelBlockComponent',
    module: '@dereekb/dbx-web',
    description: 'Compact inline label + value pair. Use for dense detail rows where a stacked detail-block would be too tall.',
    inputs: [{ name: 'header', type: 'string', description: 'Label text.', required: false }],
    outputs: NO_OUTPUTS,
    contentProjection: '<ng-content></ng-content>',
    relatedSlugs: ['detail-block'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/layout/block/label.block.component.ts',
    example: `<dbx-label-block header="Status"><span>Active</span></dbx-label-block>`,
    minimalExample: `<dbx-label-block header="Label">Body</dbx-label-block>`
  },

  // =====================================================================
  // SCREEN
  // =====================================================================
  {
    slug: 'resized',
    category: 'screen',
    kind: 'directive',
    selector: '[dbxResized]',
    className: 'DbxResizedDirective',
    module: '@dereekb/dbx-web',
    description: "Emits a `ResizedEvent` whenever the host element's dimensions change. Use for layouts that need to respond to container resize beyond viewport breakpoints (e.g. master/detail width gating).",
    inputs: NO_INPUTS,
    outputs: [{ name: 'dbxResized', emits: 'ResizedEvent', description: 'Fires with `{ newRect, oldRect }` whenever the host resizes.' }],
    relatedSlugs: ['flex-group'],
    skillRefs: ['dbx__ref__dbx-ui-building-blocks'],
    sourcePath: 'lib/screen/resize.directive.ts',
    example: `<div (dbxResized)="onResized($event)" class="resizable-panel"></div>`,
    minimalExample: `<div (dbxResized)="handle($event)"></div>`
  },

  // =====================================================================
  // ACTION
  // =====================================================================
  {
    slug: 'action-snackbar',
    category: 'action',
    kind: 'directive',
    selector: '[dbxActionSnackbar]',
    className: 'DbxActionSnackbarDirective',
    module: '@dereekb/dbx-web',
    description: "Shows a Material snackbar tied to an action's lifecycle — surfaces success/error toasts when a `[dbxAction]` resolves. Pair with `[dbxActionSnackbarError]` for error-only handling.",
    inputs: [{ name: 'dbxActionSnackbar', type: 'DbxActionSnackbarFunction<T, O>', description: 'Generator that produces a snackbar config from the action result.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['action-snackbar-error', 'action-confirm', 'error-snackbar'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/action/snackbar/action.snackbar.directive.ts',
    example: `<button [dbxAction]="saveAction" [dbxActionSnackbar]="snackbarFn">Save</button>`,
    minimalExample: `<div [dbxActionSnackbar]="fn"></div>`
  },
  {
    slug: 'action-snackbar-error',
    category: 'action',
    kind: 'directive',
    selector: '[dbxActionSnackbarError]',
    className: 'DbxActionSnackbarErrorDirective',
    module: '@dereekb/dbx-web',
    description: 'Error-only variant of `[dbxActionSnackbar]` — shows a snackbar when an action fails, ignored otherwise.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['action-snackbar'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/error/error.snackbar.directive.ts',
    example: `<button [dbxAction]="saveAction" dbxActionSnackbarError>Save</button>`,
    minimalExample: `<div [dbxActionSnackbarError]></div>`
  },
  {
    slug: 'action-confirm',
    category: 'action',
    kind: 'directive',
    selector: '[dbxActionConfirm]',
    className: 'DbxActionConfirmDirective',
    module: '@dereekb/dbx-web',
    description: 'Wraps an action with a confirmation dialog before triggering. Use for destructive operations like delete-account or cancel-subscription.',
    inputs: [{ name: 'dbxActionConfirm', type: 'DbxActionConfirmConfig', description: 'Confirm dialog config — header, message, button labels.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['action-snackbar', 'prompt-confirm'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/action/action.confirm.directive.ts',
    example: `<button [dbxAction]="deleteAction" [dbxActionConfirm]="{ header: 'Delete account?', confirmText: 'Delete' }">Delete</button>`,
    minimalExample: `<div [dbxActionConfirm]="cfg"></div>`
  },
  {
    slug: 'action-loading-context',
    category: 'action',
    kind: 'directive',
    selector: '[dbxActionLoadingContext]',
    className: 'DbxActionLoadingContextDirective',
    module: '@dereekb/dbx-web',
    description: "Bridges an action's working state into a `LoadingContext`. Use when you want a `dbx-loading` to react to an action's lifecycle.",
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['loading', 'action-snackbar'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/loading/loading.action.directive.ts',
    example: `<dbx-loading [state]="ctx.state$ | async">
  <button [dbxAction]="saveAction" dbxActionLoadingContext>Save</button>
</dbx-loading>`,
    minimalExample: `<button [dbxActionLoadingContext]></button>`
  },
  {
    slug: 'action-key-trigger',
    category: 'action',
    kind: 'directive',
    selector: '[dbxActionKeyTrigger]',
    className: 'DbxActionKeyTriggerDirective',
    module: '@dereekb/dbx-web',
    description: 'Triggers the host action when a configured keyboard shortcut fires. Use for keyboard-driven save / submit shortcuts on focused content.',
    inputs: [{ name: 'dbxActionKeyTrigger', type: 'string | DbxActionKeyTriggerConfig', description: 'Key combo (e.g. `cmd+s`) or full trigger config.', required: true }],
    outputs: NO_OUTPUTS,
    relatedSlugs: ['action-confirm', 'action-snackbar'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/action/key.trigger.directive.ts',
    example: `<form [dbxAction]="saveAction" [dbxActionKeyTrigger]="'cmd+s'">...</form>`,
    minimalExample: `<div [dbxActionKeyTrigger]="'enter'"></div>`
  },
  {
    slug: 'action-transition-safety',
    category: 'action',
    kind: 'directive',
    selector: '[dbxActionTransitionSafety]',
    className: 'DbxActionTransitionSafetyDirective',
    module: '@dereekb/dbx-web',
    description: 'Prompts before navigating away from an action with unsaved changes. Use on edit forms to guard against accidental navigation.',
    inputs: NO_INPUTS,
    outputs: NO_OUTPUTS,
    relatedSlugs: ['action-confirm'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'lib/action/transition/transition.safety.directive.ts',
    example: `<form [dbxAction]="formAction" dbxActionTransitionSafety>...</form>`,
    minimalExample: `<form [dbxActionTransitionSafety]></form>`
  }
];
