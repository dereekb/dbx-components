import { Observable, map, shareReplay, distinctUntilChanged, of } from 'rxjs';
import { Component, Input } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { DbxListSelectionMode, DbxListView, ListSelectionStateItem } from './list.view';
import { DbxValueListItem, AbstractDbxValueListViewConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { Maybe } from '@dereekb/util';
import { DbxValueListItemViewComponent } from './list.view.value.component';

export interface DbxSelectionValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewConfig<T, I, V> {
  multiple?: boolean;
}

/**
 * Renders a selection list view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-selection-list-view',
  template: `
    <dbx-selection-list-view-content [selectionMode]="selectionMode$ | async" [multiple]="multiple$ | async" [items]="items$ | async"></dbx-selection-list-view-content>
  `
})
export class DbxSelectionValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewDirective<T, I, V, DbxSelectionValueListViewConfig<T, I, V>> {

  readonly selectionMode$: Observable<DbxListSelectionMode> = (this.dbxListView.selectionMode$ ?? of('select' as DbxListSelectionMode))
    .pipe(map(x => x ?? 'select'), distinctUntilChanged());
  readonly multiple$ = this.config$.pipe(map(x => x.multiple ?? true), distinctUntilChanged(), shareReplay(1));

}

/**
 * Content view for a DbxSelectionValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-selection-list-view-content',
  template: `
    <ng-container [ngSwitch]="selectionMode">
      <ng-container *ngSwitchCase="'view'">
        <dbx-list-view-content [items]="items"></dbx-list-view-content>
      </ng-container>
      <ng-container *ngSwitchDefault>
        <mat-selection-list [disabled]="disabled$ | async" [multiple]="multiple" (selectionChange)="matSelectionChanged($event)">
          <mat-list-option class="dbx-list-view-item" *ngFor="let item of items" [selected]="item.selected" [disabled]="item.disabled" [value]="item.value" (click)="onClickValue(item.value)">
            <mat-icon matListIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
            <div dbx-injection [config]="item.config"></div>
          </mat-list-option>
        </mat-selection-list>
      </ng-container>
    </ng-container>
  `,
  host: {
    'class': 'dbx-list-view dbx-selection-list-view'
  }
})
export class DbxSelectionValueListItemViewComponent<T> extends DbxValueListItemViewComponent<T> {

  @Input()
  multiple?: Maybe<boolean>;

  @Input()
  selectionMode: Maybe<DbxListSelectionMode>;

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
