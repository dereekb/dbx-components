import { map, shareReplay, distinctUntilChanged } from 'rxjs';
import { Component, Input } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { DbxListView, ListSelectionStateItem } from './list.view';
import { DbxValueListItem, AbstractDbxValueListViewConfig, DbxValueListItemConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { Maybe } from '@dereekb/util';

export interface DbxSelectionValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewConfig<T, I, V> {
  multiple?: boolean;
}

/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Component({
  selector: 'dbx-selection-list-view',
  template: `
    <dbx-selection-list-view-content [multiple]="multiple$ | async" [items]="items$ | async"></dbx-selection-list-view-content>
  `
})
export class DbxSelectionValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewDirective<T, I, V, DbxSelectionValueListViewConfig<T, I, V>> {

  readonly multiple$ = this.config$.pipe(map(x => x.multiple ?? true), distinctUntilChanged(), shareReplay(1));

  constructor(dbxListView: DbxListView<T>) {
    super(dbxListView);
  }

}

/**
 * Content view for a DbxSelectionValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-selection-list-view-content',
  template: `
    <mat-selection-list [disabled]="disabled$ | async" [multiple]="multiple" (selectionChange)="matSelectionChanged($event)">
      <mat-list-option class="dbx-list-view-item" *ngFor="let item of items" [selected]="item.selected" [disabled]="item.disabled" [value]="item.value" (click)="onClickValue(item.value)">
        <mat-icon matListIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
        <div dbx-injected-content [config]="item.config"></div>
      </mat-list-option>
    </mat-selection-list>
  `,
  host: {
    'class': 'dbx-list-view dbx-selection-list-view'
  }
})
export class DbxSelectionValueListItemViewComponent<T> {

  @Input()
  multiple?: Maybe<boolean>;

  @Input()
  items?: Maybe<DbxValueListItemConfig<T>[]>;

  readonly disabled$ = this.dbxListView.disabled$;

  constructor(readonly dbxListView: DbxListView<T>) {
    if (!dbxListView.selectionChange) {
      throw new Error('Parent dbxListView to DbxSelectionValueListViewComponent has no selectionChange emitter.');
    }
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.next(value);
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
