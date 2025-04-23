import { ChangeDetectionStrategy, Component, Directive, NgModule, output } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { ListSelectionState, ListSelectionStateItem } from './list.view';
import { AbstractDbxListViewDirective } from './list.view.directive';
import { DbxSelectionValueListViewComponent } from './list.view.value.selection.component';

export const DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-selection-list-view [config]="config"></dbx-selection-list-view>';

@NgModule({
  exports: [DbxSelectionValueListViewComponent],
  imports: [DbxSelectionValueListViewComponent]
})
export class DbxSelectionValueListViewComponentImportsModule {}

// MARK: Selection List View
/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Directive()
export abstract class AbstractDbxSelectionListViewDirective<T> extends AbstractDbxListViewDirective<T> {
  readonly selectionChange = output<ListSelectionState<T>>();

  selectionChanged(selection: ListSelectionState<T>): void {
    this.selectionChange.emit(selection);
  }

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: ListSelectionStateItem<T>[] = options.map((x) => {
      const { value: itemValue, selected, disabled } = x;
      return { itemValue, selected, disabled };
    });

    this.selectionChanged({ items });
  }
}

// MARK: Compat
/**
 * @deprecated use DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE instead and import DbxSelectionValueListViewComponentImportsModule
 */
export const DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE = DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE;
