import { Component, Directive, Input, OnDestroy, Optional } from '@angular/core';
import { shareReplay, map, BehaviorSubject, combineLatest, of, Observable } from 'rxjs';
import { DbxValueListItem } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { Maybe, mergeObjects } from '@dereekb/util';
import { DbxValueListItemViewComponent, DbxValueListViewConfig } from './list.view.value.component';
import { DbxListView } from './list.view';

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
 * Optional parent directive used to control grid size.
 */
@Directive({
  selector: '[dbxListGridSize]'
})
export class DbxValueListGridSizeDirective implements OnDestroy {
  private _gridSize = new BehaviorSubject<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>(undefined);

  readonly gridSize$ = this._gridSize.asObservable();

  @Input('dbxListGridSize')
  get gridSize(): Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>> {
    return this._gridSize.value;
  }

  set gridSize(gridSize: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>) {
    if (gridSize) {
      this._gridSize.next(gridSize);
    }
  }

  ngOnDestroy(): void {
    this._gridSize.complete();
  }
}

/**
 * Content view for a DbxValueListGridView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-grid-view-content',
  template: `
    <div [gdGap]="gap$ | async" [gdColumns]="columns$ | async">
      <dbx-anchor *ngFor="let item of items; trackBy: trackByFunction" matRipple [matRippleDisabled]="rippleDisabledOnItem(item)" class="dbx-list-grid-view-item" [anchor]="item.anchor" [disabled]="item.disabled" (click)="onClickItem(item)">
        <div dbx-injection [config]="item.config"></div>
      </dbx-anchor>
    </div>
  `,
  host: {
    class: 'dbx-list-grid-view'
  }
})
export class DbxValueListGridItemViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> extends DbxValueListItemViewComponent<T, I> implements OnDestroy {
  private _defaultGrid = new BehaviorSubject<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>(undefined);

  readonly grid$: Observable<DbxValueListGridItemViewGridSizeConfig> = combineLatest([this._defaultGrid, this._gridSizeOverride?.gridSize$ ?? of(undefined)]).pipe(
    map(([defaultGrid, overrideGrid]) => {
      const grid = mergeObjects<DbxValueListGridItemViewGridSizeConfig>([DEFAULT_LIST_GRID_SIZE_CONFIG, defaultGrid, overrideGrid]);
      return grid as DbxValueListGridItemViewGridSizeConfig;
    }),
    shareReplay(1)
  );

  readonly gap$ = this.grid$.pipe(map((x) => x.gap));
  readonly columns$ = this.grid$.pipe(map((x) => x.columns));

  constructor(dbxListView: DbxListView<T>, @Optional() private _gridSizeOverride?: DbxValueListGridSizeDirective) {
    super(dbxListView);
  }

  @Input()
  set grid(grid: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>) {
    this._defaultGrid.next(grid);
  }

  ngOnDestroy(): void {
    this._defaultGrid.complete();
  }
}
