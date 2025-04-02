import { ChangeDetectionStrategy, Component, Directive, Input, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { shareReplay, map, BehaviorSubject, combineLatest, of, Observable, distinctUntilChanged } from 'rxjs';
import { DbxValueListItem } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { Maybe, mergeObjects } from '@dereekb/util';
import { DbxValueListViewContentComponent, DbxValueListViewConfig, DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from './list.view.value.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgFor } from '@angular/common';
import { MatRipple, MatRippleModule } from '@angular/material/core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxAnchorComponent } from '../../router/layout/anchor/anchor.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';

export interface DbxValueListGridViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxValueListViewConfig<T, I, V> {
  grid?: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>;
}

export interface DbxValueListGridItemViewGridSizeConfig {
  /**
   * Gap size in %, px, vw, vh
   */
  readonly gap: string;
  /**
   * Columns configuration.
   *
   * Example: repeat(auto-fill, minmax(200px, 1fr))
   */
  readonly columns: string;
}

export const DEFAULT_LIST_GRID_SIZE_CONFIG: DbxValueListGridItemViewGridSizeConfig = {
  columns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '8px'
};

/**
 * Optional parent directive used to control grid size.
 */
@Directive({
  selector: '[dbxListGridSize]',
  standalone: true
})
export class DbxValueListGridSizeDirective {
  readonly gridSize = input<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>(undefined, {
    alias: 'dbxListGridSize'
  });

  readonly gridSize$ = toObservable(this.gridSize);
}

/**
 * Content view for a DbxValueListGridView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-grid-view-content',
  template: `
    <div [gdGap]="gridConfigSignal()?.gap" [gdColumns]="gridConfigSignal()?.columns">
      @for (item of items(); track trackByFunctionSignal()($index, item)) {
        <dbx-anchor class="dbx-list-grid-view-item" matRipple [matRippleDisabled]="rippleDisabledOnItem(item)" [anchor]="item.anchor" [disabled]="item.disabled" (click)="onClickItem(item)">
          <div dbx-injection [config]="item.config"></div>
        </dbx-anchor>
      }
    </div>
  `,
  host: {
    class: 'dbx-list-grid-view'
  },
  standalone: true,
  imports: [FlexLayoutModule, MatRipple, DbxAnchorComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListGridViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> extends DbxValueListViewContentComponent<T, I> {
  private readonly _gridSizeOverride = inject(DbxValueListGridSizeDirective, { optional: true });

  readonly inputGridConfig = input<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>(undefined, { alias: 'grid' });
  readonly gridConfigFromGridSizeSignal = toSignal(this._gridSizeOverride?.gridSize$ ?? of(undefined));

  readonly gridConfigSignal = computed(() => {
    return mergeObjects<DbxValueListGridItemViewGridSizeConfig>([DEFAULT_LIST_GRID_SIZE_CONFIG, this.inputGridConfig(), this.gridConfigFromGridSizeSignal()]) as DbxValueListGridItemViewGridSizeConfig;
  });

  readonly trackByFunctionSignal = toSignal(this.trackBy$, { initialValue: DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION });
}

// MARK: DbxValueListGridViewComponent
/**
 * Renders a grid view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-list-grid-view',
  template: `
    <dbx-list-grid-view-content [items]="itemsSignal()" [grid]="config()?.grid" [emitAllClicks]="config()?.emitAllClicks"></dbx-list-grid-view-content>
  `,
  standalone: true,
  imports: [DbxValueListGridViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListGridViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListGridViewConfig<T, I, V> = DbxValueListGridViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {}
