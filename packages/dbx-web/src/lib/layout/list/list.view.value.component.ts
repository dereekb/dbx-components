import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, type Signal, type TrackByFunction, computed, inject, input } from '@angular/core';
import { shareReplay, map, type Observable, switchMap, of } from 'rxjs';
import { type DbxValueListItem, type AbstractDbxValueListViewConfig, type DbxValueListItemConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { DbxInjectionComponent, anchorTypeForAnchor } from '@dereekb/dbx-core';
import { DbxListView } from './list.view';
import { type Maybe, ModelKeyRef, spaceSeparatedCssClasses, UniqueModel } from '@dereekb/util';
import { type DbxValueListItemGroup, DbxValueListViewGroupDelegate, defaultDbxValueListViewGroupDelegate } from './group/list.view.value.group';
import { asObservable } from '@dereekb/rxjs';
import { MatListModule, MatNavList } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { DbxAnchorComponent } from '../../router/layout/anchor/anchor.component';

/**
 * Configuration for a {@link DbxValueListViewComponent}. Extends the base config with an option to emit click events for all items, including those with anchors.
 */
export interface DbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends AbstractDbxValueListViewConfig<T, I, V> {
  /**
   * When true, emits click events for all items regardless of whether they have anchors.
   */
  readonly emitAllClicks?: boolean;
}

/**
 * Renders a single group of list items within a {@link DbxValueListViewContentComponent}. Displays an optional header,
 * a list of items using `mat-list-item`, and an optional footer.
 *
 * @example
 * ```html
 * <dbx-list-view-content-group [group]="group"></dbx-list-view-content-group>
 * ```
 */
@Component({
  selector: 'dbx-list-view-content-group',
  template: `
    <div class="dbx-list-view-group-content">
      @if (headerConfigSignal()) {
        <div class="dbx-list-view-group-header">
          <dbx-injection [config]="headerConfigSignal()"></dbx-injection>
        </div>
      }
      @for (item of itemsSignal(); track trackByFunctionSignal()($index, item)) {
        <dbx-anchor [anchor]="item.anchor" [disabled]="item.disabled">
          <a mat-list-item class="dbx-list-view-item" [disabled]="item.disabled" [disableRipple]="rippleDisabledOnItem(item)" (click)="onClickItem(item)">
            @if (item.icon) {
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            }
            <dbx-injection [config]="item.config"></dbx-injection>
            @if (item.metaConfig) {
              <span matListItemMeta>
                <dbx-injection [config]="item.metaConfig"></dbx-injection>
              </span>
            }
          </a>
        </dbx-anchor>
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
  imports: [DbxInjectionComponent, DbxAnchorComponent, MatListModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxValueListViewContentGroupComponent<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxValueListViewContentComponent = inject(DbxValueListViewContentComponent<T>);
  readonly group = input<Maybe<DbxValueListItemGroup<G, T, I>>>();

  readonly trackByFunctionSignal = toSignal(this.dbxValueListViewContentComponent.trackBy$, { initialValue: DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION });

  readonly itemsSignal = computed(() => this.group()?.items ?? []);
  readonly headerConfigSignal = computed(() => this.group()?.headerConfig);
  readonly footerConfigSignal = computed(() => this.group()?.footerConfig);
  readonly cssClassSignal = computed(() => spaceSeparatedCssClasses(this.group()?.cssClasses));

  onClickItem(item: I) {
    this.dbxValueListViewContentComponent.onClickItem(item);
  }

  onClickValue(value: T) {
    this.dbxValueListViewContentComponent.onClickValue(value);
  }

  rippleDisabledOnItem(item: I): boolean {
    return this.dbxValueListViewContentComponent.rippleDisabledOnItem(item);
  }
}

// MARK: DbxValueListViewContentComponent
/**
 * Default track-by function for list view content components.
 *
 * Uses the item's {@link DbxValueListItem.key} when available for stable identity across
 * data updates, falling back to a prefixed index string to avoid collisions with key values.
 */
export const DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION: TrackByFunction<DbxValueListItem<unknown>> = (index: number, item: DbxValueListItem<unknown>) => item?.key ?? (item?.itemValue as Partial<ModelKeyRef>)?.key ?? (item?.itemValue as Partial<UniqueModel>)?.id ?? `__list__${index}__`;

/**
 * Renders a Material nav list of grouped value list items. Can be used directly when items are pre-configured,
 * or as part of the standard list rendering pipeline via {@link DbxValueListViewComponent}.
 *
 * @example
 * ```html
 * <dbx-list-view-content [items]="configuredItems" [emitAllClicks]="true"></dbx-list-view-content>
 * ```
 */
@Component({
  selector: 'dbx-list-view-content',
  template: `
    <mat-nav-list [disabled]="disabledSignal()">
      @for (group of groupsSignal(); track group.id) {
        <dbx-list-view-content-group [group]="group"></dbx-list-view-content-group>
      }
    </mat-nav-list>
  `,
  host: {
    class: 'dbx-list-view'
  },
  standalone: true,
  imports: [MatNavList, DbxValueListViewContentGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxListView = inject(DbxListView<T>);
  private readonly _dbxListGroupDelegate: DbxValueListViewGroupDelegate<any, T, I> = inject<Maybe<DbxValueListViewGroupDelegate<any, T, I>>>(DbxValueListViewGroupDelegate, { optional: true }) ?? defaultDbxValueListViewGroupDelegate();

  private readonly _trackBy$ = this.dbxListView.trackBy$ ?? of(undefined);
  readonly trackBy$ = this._trackBy$.pipe(map((trackBy) => (trackBy ? (index: number, item: DbxValueListItemConfig<T, I>) => trackBy(index, item.itemValue) : DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION)));

  readonly items = input<Maybe<DbxValueListItemConfig<T, I>[]>>();
  readonly emitAllClicks = input<Maybe<boolean>>();

  readonly groups$: Observable<DbxValueListItemGroup<any, T, I>[]> = toObservable(this.items).pipe(
    switchMap((items) => asObservable(this._dbxListGroupDelegate.groupValues(items ?? []))),
    shareReplay(1)
  );

  readonly groupsSignal = toSignal(this.groups$);
  readonly disabledSignal = toSignal(this.dbxListView.disabled$);

  onClickItem(item: I) {
    // do not emit clicks for disabled items.
    if (!item.disabled) {
      if (this.emitAllClicks() || !item.anchor || anchorTypeForAnchor(item.anchor) === 'plain') {
        // only emit clicks for items with no anchor, or plain anchors.
        this.onClickValue(item.itemValue);
      }
    }
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.emit(value);
  }

  rippleDisabledOnItem(item: I): boolean {
    return item.rippleDisabled || (!this.emitAllClicks() && !item.anchor);
  }
}

// MARK: DbxValueListViewComponent
/**
 * Renders a value-based list view using a configuration input. Must be used within a parent {@link DbxListView} context.
 *
 * @example
 * ```html
 * <dbx-list-view [config]="listViewConfig"></dbx-list-view>
 * ```
 */
@Component({
  selector: 'dbx-list-view',
  template: `
    <dbx-list-view-content [items]="itemsSignal()" [emitAllClicks]="emitAllClicksSignal()"></dbx-list-view-content>
  `,
  standalone: true,
  imports: [DbxValueListViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListViewConfig<T, I, V> = DbxValueListViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {
  readonly emitAllClicksSignal: Signal<Maybe<boolean>> = computed(() => this.config()?.emitAllClicks);
}
