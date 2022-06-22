import { Component, Input } from '@angular/core';
import { shareReplay, map } from 'rxjs';
import { DbxValueListItem, AbstractDbxValueListViewConfig, DbxValueListItemConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { AnchorType, anchorTypeForAnchor } from '@dereekb/dbx-core';
import { DbxListView } from './list.view';
import { Maybe, mergeObjects } from '@dereekb/util';
import { DbxValueListViewConfig } from './list.view.value.component';

export interface DbxValueListGridViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxValueListViewConfig<T, I, V> {
  grid?: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>;
}

/**
 * Renders a grid view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-list-grid-view',
  template: `
    <dbx-list-grid-view-content [grid]="grid$ | async" [items]="items$ | async" [emitAllClicks]="emitAllClicks$ | async"></dbx-list-grid-view-content>
  `
})
export class DbxValueListGridViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListGridViewConfig<T, I, V> = DbxValueListGridViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {
  readonly grid$ = this.config$.pipe(map((x) => x.grid));
  readonly emitAllClicks$ = this.config$.pipe(
    map((x) => x.emitAllClicks),
    shareReplay(1)
  );
}

export interface DbxValueListGridItemViewGridSizeConfig {
  /**
   * Gap size in %, px, vw, vh
   */
  gap: string;
  /**
   * Columns configuration.
   *
   * Example: repeat(auto-fill, minmax(200px, 1fr))
   */
  columns: string;
}

export const DEFAULT_LIST_GRID_SIZE_CONFIG: DbxValueListGridItemViewGridSizeConfig = {
  columns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '8px'
};

/**
 * Content view for a DbxValueListGridView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-grid-view-content',
  template: `
    <div [gdGap]="gap" [gdColumns]="columns">
      <div *ngFor="let item of items" dbx-injection [config]="item.config"></div>
    </div>
  `,
  host: {
    class: 'dbx-list-grid-view'
  }
})
export class DbxValueListGridItemViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  private _grid: DbxValueListGridItemViewGridSizeConfig = DEFAULT_LIST_GRID_SIZE_CONFIG;

  @Input()
  get grid() {
    return this._grid;
  }

  set grid(grid: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>) {
    this._grid = mergeObjects<DbxValueListGridItemViewGridSizeConfig>([DEFAULT_LIST_GRID_SIZE_CONFIG, grid]) as DbxValueListGridItemViewGridSizeConfig;
  }

  get gap() {
    return this._grid.gap;
  }

  get columns() {
    return this._grid.columns;
  }

  @Input()
  emitAllClicks?: Maybe<boolean>;

  @Input()
  items?: Maybe<DbxValueListItemConfig<T, I>[]>;

  readonly disabled$ = this.dbxListView.disabled$;

  constructor(readonly dbxListView: DbxListView<T>) {}

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
