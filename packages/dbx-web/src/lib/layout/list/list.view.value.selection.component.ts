import { map, shareReplay, distinctUntilChanged } from 'rxjs';
import { Component } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { DbxListView, ListSelectionStateItem } from './list.view';
import { DbxValueListItem, AbstractDbxValueListViewConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';

export interface DbxSelectionValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewConfig<T, I, V> {
  multiple?: boolean;
}

/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Component({
  selector: 'dbx-selection-list-view',
  template: `
    <mat-selection-list [multiple]="true" (selectionChange)="matSelectionChanged($event)">
      <mat-list-option class="dbx-list-view-item" *ngFor="let item of (items$ | async)" [selected]="item.selected" [disabled]="item.disabled" [value]="item.value" (click)="onClickValue(item.value)">
        <mat-icon matListIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
        <div dbx-injected-content [config]="item.config"></div>
      </mat-list-option>
    </mat-selection-list>
  `,
  host: {
    'class': 'dbx-list-view dbx-selection-list-view'
  }
})
export class DbxSelectionValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewDirective<T, I, V, DbxSelectionValueListViewConfig<T, I, V>> {

  readonly multiple$ = this.config$.pipe(map(x => x.multiple ?? true), distinctUntilChanged(), shareReplay(1));

  constructor(dbxListView: DbxListView<T>) {
    super(dbxListView);
    if (!dbxListView.selectionChange) {
      throw new Error('Parent dbxListView to DbxSelectionValueListViewComponent has no selectionChange emitter.');
    }
  }

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: ListSelectionStateItem<T>[] = options.map(x => {
      const { value, selected, disabled } = x;
      return ({ value, selected, disabled });
    });

    this.dbxListView.selectionChange!.next({
      items
    });
  }

}
