import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { type DbxValueListItem } from '../list.view.value';
import { AbstractDbxValueListViewDirective } from '../list.view.value.directive';
import { type Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import { DbxValueListViewContentComponent, type DbxValueListViewConfig, DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from '../list.view.value.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
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

// MARK: DbxValueListAccordionViewContentGroupComponent
/**
 * Renders a single group of items within an accordion view, including optional header and footer injection points.
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
 * Content view that renders grouped list items inside a `mat-accordion`. Each item component is responsible
 * for rendering its own `mat-expansion-panel` structure.
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
      @for (group of groupsSignal(); track group.id) {
        <dbx-list-accordion-view-content-group [group]="group"></dbx-list-accordion-view-content-group>
      }
    </mat-accordion>
  `,
  host: {
    class: 'dbx-list-accordion-view'
  },
  standalone: true,
  imports: [MatAccordion, DbxValueListAccordionViewContentGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListAccordionViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> extends DbxValueListViewContentComponent<T, I> {
  readonly multi = input<Maybe<boolean>>();
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
    <dbx-list-accordion-view-content [items]="itemsSignal()" [multi]="config().multi" [emitAllClicks]="config().emitAllClicks"></dbx-list-accordion-view-content>
  `,
  standalone: true,
  imports: [DbxValueListAccordionViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListAccordionViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListAccordionViewConfig<T, I, V> = DbxValueListAccordionViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {}
