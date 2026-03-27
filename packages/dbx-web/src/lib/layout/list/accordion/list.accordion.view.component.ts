import { ChangeDetectionStrategy, Component, computed, inject, input, type TrackByFunction } from '@angular/core';
import { type DbxValueListItem, type DbxValueListItemConfig } from '../list.view.value';
import { AbstractDbxValueListViewDirective } from '../list.view.value.directive';
import { type Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import { DbxValueListViewContentComponent, type DbxValueListViewConfig, DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from '../list.view.value.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MatAccordion } from '@angular/material/expansion';
import { type DbxValueListItemGroup } from '../group/list.view.value.group';

// MARK: Config
/**
 * Configuration for a {@link DbxValueListAccordionViewComponent}. Extends the standard list view config with accordion-specific options.
 */
export interface DbxValueListAccordionViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxValueListViewConfig<T, I, V> {
  /**
   * Whether the accordion allows multiple expanded panels simultaneously.
   */
  readonly multi?: boolean;
}

// MARK: Render Entries
/**
 * Render entry for an item within the flat accordion list.
 */
export interface DbxAccordionRenderItemEntry<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly type: 'item';
  readonly trackId: string;
  readonly item: DbxValueListItemConfig<T, I>;
}

/**
 * Render entry for a group header within the flat accordion list.
 */
export interface DbxAccordionRenderGroupHeaderEntry {
  readonly type: 'group-header';
  readonly trackId: string;
  readonly headerConfig: DbxInjectionComponentConfig;
  readonly cssClasses?: string;
}

/**
 * Render entry for a group footer within the flat accordion list.
 */
export interface DbxAccordionRenderGroupFooterEntry {
  readonly type: 'group-footer';
  readonly trackId: string;
  readonly footerConfig: DbxInjectionComponentConfig;
}

/**
 * Discriminated union of all render entry types used by the flat accordion list.
 */
export type DbxAccordionRenderEntry<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> = DbxAccordionRenderItemEntry<T, I> | DbxAccordionRenderGroupHeaderEntry | DbxAccordionRenderGroupFooterEntry;

/**
 * Flattens grouped accordion items into a single array of render entries with stable track IDs.
 *
 * @example
 * ```ts
 * const entries = flattenAccordionGroups(groups, trackByFn);
 * ```
 *
 * @param groups - the grouped items to flatten
 * @param trackByFn - the track-by function used to derive stable item identity
 * @returns a flat array of render entries for use in a single `@for` loop
 */
export function flattenAccordionGroups<T, I extends DbxValueListItem<T> = DbxValueListItem<T>>(groups: DbxValueListItemGroup<unknown, T, I>[], trackByFn: TrackByFunction<DbxValueListItemConfig<T, I>>): DbxAccordionRenderEntry<T, I>[] {
  const entries: DbxAccordionRenderEntry<T, I>[] = [];

  for (const group of groups) {
    if (group.headerConfig) {
      entries.push({
        type: 'group-header',
        trackId: `__gh__${group.id}`,
        headerConfig: group.headerConfig,
        cssClasses: spaceSeparatedCssClasses(group.cssClasses)
      });
    }

    if (group.showGroupItems !== false) {
      for (let i = 0; i < group.items.length; i++) {
        const item = group.items[i];
        entries.push({
          type: 'item',
          trackId: `__i__${group.id}__${trackByFn(i, item)}`,
          item
        });
      }
    }

    if (group.footerConfig) {
      entries.push({
        type: 'group-footer',
        trackId: `__gf__${group.id}`,
        footerConfig: group.footerConfig
      });
    }
  }

  return entries;
}

// MARK: DbxValueListAccordionViewContentGroupComponent
/**
 * Renders a single group of items within an accordion view, including optional header and footer injection points.
 *
 * @deprecated No longer used by {@link DbxValueListAccordionViewContentComponent}. The content component now renders
 * a flat list of entries directly. This component is kept exported for backward compatibility.
 *
 * @example
 * ```html
 * <dbx-list-accordion-view-content-group [group]="group"></dbx-list-accordion-view-content-group>
 * ```
 */
@Component({
  selector: 'dbx-list-accordion-view-content-group',
  template: `
    <div class="dbx-list-view-group-content">
      @if (headerConfigSignal()) {
        <div class="dbx-list-view-group-header">
          <dbx-injection [config]="headerConfigSignal()"></dbx-injection>
        </div>
      }
      @for (item of itemsSignal(); track trackByFunctionSignal()($index, item)) {
        <div dbx-injection [config]="item.config"></div>
      }
      @if (footerConfigSignal()) {
        <div class="dbx-list-view-group-footer">
          <dbx-injection [config]="footerConfigSignal()"></dbx-injection>
        </div>
      }
    </div>
  `,
  host: {
    class: 'dbx-list-view-group',
    '[class]': 'cssClassSignal()'
  },
  imports: [DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxValueListAccordionViewContentGroupComponent<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxValueListAccordionViewContentComponent = inject(DbxValueListAccordionViewContentComponent<T>);
  readonly group = input<Maybe<DbxValueListItemGroup<G, T, I>>>();

  readonly trackByFunctionSignal = toSignal(this.dbxValueListAccordionViewContentComponent.trackBy$, { initialValue: DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION });

  readonly itemsSignal = computed(() => this.group()?.items ?? []);
  readonly headerConfigSignal = computed(() => this.group()?.headerConfig);
  readonly footerConfigSignal = computed(() => this.group()?.footerConfig);
  readonly cssClassSignal = computed(() => spaceSeparatedCssClasses(this.group()?.cssClasses));
}

// MARK: DbxValueListAccordionViewContentComponent
/**
 * Content view that renders grouped list items inside a `mat-accordion`. Uses a single flat `@for` loop
 * with stable item identity tracking so that items moving between groups trigger DOM moves instead of
 * destroy+create cycles.
 *
 * @example
 * ```html
 * <dbx-list-accordion-view-content [items]="configuredItems" [multi]="true"></dbx-list-accordion-view-content>
 * ```
 */
@Component({
  selector: 'dbx-list-accordion-view-content',
  template: `
    <mat-accordion [multi]="multi() ?? false">
      @for (entry of flatEntriesSignal(); track entry.trackId) {
        @switch (entry.type) {
          @case ('group-header') {
            <div class="dbx-list-view-group dbx-list-view-group-header" [class]="entry.cssClasses">
              <dbx-injection [config]="entry.headerConfig"></dbx-injection>
            </div>
          }
          @case ('item') {
            <div dbx-injection [config]="entry.item.config"></div>
          }
          @case ('group-footer') {
            <div class="dbx-list-view-group dbx-list-view-group-footer">
              <dbx-injection [config]="entry.footerConfig"></dbx-injection>
            </div>
          }
        }
      }
    </mat-accordion>
  `,
  host: {
    class: 'dbx-list-accordion-view'
  },
  standalone: true,
  imports: [MatAccordion, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListAccordionViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> extends DbxValueListViewContentComponent<T, I> {
  readonly multi = input<Maybe<boolean>>();

  readonly trackByFunctionSignal = toSignal(this.trackBy$, { initialValue: DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION });

  readonly flatEntriesSignal = computed(() => {
    const groups = this.groupsSignal() ?? [];
    const trackByFn = this.trackByFunctionSignal();

    return flattenAccordionGroups<T, I>(groups as DbxValueListItemGroup<unknown, T, I>[], trackByFn);
  });
}

// MARK: DbxValueListAccordionViewComponent
/**
 * Renders a value list as an accordion using a configuration input. Each item renders its own expansion panel.
 * Requires a parent {@link DbxListView} context.
 *
 * @example
 * ```html
 * <dbx-list-accordion-view [config]="accordionConfig"></dbx-list-accordion-view>
 * ```
 */
@Component({
  selector: 'dbx-list-accordion-view',
  template: `
    <dbx-list-accordion-view-content [items]="itemsSignal()" [multi]="config().multi" [emitAllClicks]="config().emitAllClicks" [stickyHeaders]="config().stickyHeaders ?? false"></dbx-list-accordion-view-content>
  `,
  standalone: true,
  imports: [DbxValueListAccordionViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListAccordionViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListAccordionViewConfig<T, I, V> = DbxValueListAccordionViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {}
