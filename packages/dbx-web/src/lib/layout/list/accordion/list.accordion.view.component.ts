import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DbxValueListItem } from '../list.view.value';
import { AbstractDbxValueListViewDirective } from '../list.view.value.directive';
import { Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import { DbxValueListViewContentComponent, DbxValueListViewConfig, DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from '../list.view.value.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { MatAccordion } from '@angular/material/expansion';
import { DbxValueListItemGroup } from '../group/list.view.value.group';

// MARK: Config
export interface DbxValueListAccordionViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxValueListViewConfig<T, I, V> {
  /**
   * Whether the accordion allows multiple expanded panels simultaneously.
   */
  readonly multi?: boolean;
}

// MARK: DbxValueListAccordionViewContentGroupComponent
/**
 * Renders a single group of items within the accordion view.
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
 * Content view for a DbxValueListAccordionView. Renders items inside a mat-accordion.
 *
 * Each item component is responsible for rendering its own mat-expansion-panel structure.
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
 * Renders an accordion view using input configuration. Requires a parent DbxListView.
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
