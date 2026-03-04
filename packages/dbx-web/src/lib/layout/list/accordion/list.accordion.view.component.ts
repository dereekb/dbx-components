import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { of } from 'rxjs';
import { DbxValueListItem, DbxValueListItemConfig } from '../list.view.value';
import { AbstractDbxValueListViewDirective } from '../list.view.value.directive';
import { Maybe } from '@dereekb/util';
import { DbxValueListViewContentComponent, DbxValueListViewConfig, DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from '../list.view.value.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { MatAccordion } from '@angular/material/expansion';
import { DbxListView } from '../list.view';

// MARK: Config
export interface DbxValueListAccordionViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxValueListViewConfig<T, I, V> {
  /**
   * Whether the accordion allows multiple expanded panels simultaneously.
   */
  readonly multi?: boolean;
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
      @for (item of items(); track trackByFunctionSignal()($index, item)) {
        <div dbx-injection [config]="item.config"></div>
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
