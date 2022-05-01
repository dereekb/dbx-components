import { Component, Input } from '@angular/core';
import { shareReplay, map } from 'rxjs';
import { DbxValueListItem, AbstractDbxValueListViewConfig, DbxValueListItemConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { AnchorType, anchorTypeForAnchor } from '@dereekb/dbx-core';
import { DbxListView } from './list.view';
import { Maybe } from '@dereekb/util';

export interface DbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewConfig<T, I, V> {
  emitAllClicks?: boolean;
}

/**
 * Renders a list view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-list-view',
  template: `
    <dbx-list-view-content [items]="items$ | async" [emitAllClicks]="emitAllClicks$ | async"></dbx-list-view-content>
  `
})
export class DbxValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any, C extends DbxValueListViewConfig<T, I, V> = DbxValueListViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {

  readonly emitAllClicks$ = this.config$.pipe(map(x => x.emitAllClicks), shareReplay(1));

}

/**
 * Content view for a DbxValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-view-content',
  template: `
    <mat-nav-list [disabled]="disabled$ | async">
      <dbx-anchor *ngFor="let item of items" [anchor]="item.anchor" [disabled]="item.disabled">
        <a mat-list-item class="dbx-list-view-item" [disabled]="item.disabled" (click)="onClickItem(item)">
          <mat-icon matListIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
          <div dbx-injection [config]="item.config"></div>
        </a>
      </dbx-anchor>
    </mat-nav-list>
  `,
  host: {
    'class': 'dbx-list-view'
  }
})
export class DbxValueListItemViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {

  @Input()
  emitAllClicks?: Maybe<boolean>;

  @Input()
  items?: Maybe<DbxValueListItemConfig<T, I>[]>;

  readonly disabled$ = this.dbxListView.disabled$;

  constructor(readonly dbxListView: DbxListView<T>) { }

  onClickItem(item: I) {

    // do not emit clicks for disabled items.
    if (!item.disabled) {

      if (this.emitAllClicks || !item.anchor || anchorTypeForAnchor(item.anchor) === AnchorType.PLAIN) {
        // only emit clicks for items with no anchor, or plain anchors.
        this.onClickValue(item.itemValue);
      }
    }
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.next(value);
  }

}
