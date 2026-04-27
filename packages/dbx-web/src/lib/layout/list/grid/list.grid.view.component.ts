import { ChangeDetectionStrategy, Component, Directive, type Signal, computed, inject, input } from '@angular/core';
import { of } from 'rxjs';
import { type DbxValueListItem } from '../list.view.value';
import { AbstractDbxValueListViewDirective } from '../list.view.value.directive';
import { type Maybe, mergeObjects, spaceSeparatedCssClasses } from '@dereekb/util';
import { DbxValueListViewContentComponent, type DbxValueListViewConfig, DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from '../list.view.value.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatRipple } from '@angular/material/core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxAnchorComponent } from '../../../router/layout/anchor/anchor.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type DbxValueListItemGroup } from '../group/list.view.value.group';

/**
 * Configuration for a {@link DbxValueListGridViewComponent}. Extends the standard list view config with optional grid layout sizing.
 */
export interface DbxValueListGridViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxValueListViewConfig<T, I, V> {
  /**
   * Optional grid sizing configuration for column layout and gap spacing.
   */
  grid?: Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>;
}

/**
 * Defines the CSS grid layout dimensions for a grid-based list view.
 */
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

/**
 * Default grid size configuration with responsive auto-fill columns (minimum 320px) and 8px gap.
 */
export const DEFAULT_LIST_GRID_SIZE_CONFIG: DbxValueListGridItemViewGridSizeConfig = {
  columns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '8px'
};

/**
 * Structural directive that provides grid size configuration to descendant {@link DbxValueListGridViewContentComponent} instances.
 *
 * @example
 * ```html
 * <div [dbxListGridSize]="{ columns: 'repeat(3, 1fr)', gap: '16px' }">
 *   <dbx-list-grid-view-content [items]="items"></dbx-list-grid-view-content>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxListGridSize]',
  standalone: true
})
export class DbxValueListGridSizeDirective {
  readonly gridSize = input.required<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>({ alias: 'dbxListGridSize' });
  readonly gridSize$ = toObservable(this.gridSize);
}

// MARK: DbxValueListGridViewContentGroupComponent
/**
 * Renders a single group of items within a CSS grid layout, including optional header/footer and ripple effects on items.
 *
 * @example
 * ```html
 * <dbx-list-grid-view-content-group [group]="group"></dbx-list-grid-view-content-group>
 * ```
 */
@Component({
  selector: 'dbx-list-grid-view-content-group',
  template: `
    <div class="dbx-list-view-group-content">
      @if (headerConfigSignal()) {
        <div class="dbx-list-view-group-header">
          <dbx-injection [config]="headerConfigSignal()"></dbx-injection>
        </div>
      }
      <div [gdGap]="gridConfigSignal().gap" [gdColumns]="gridConfigSignal().columns">
        @for (item of itemsSignal(); track trackByFunctionSignal()($index, item)) {
          <dbx-anchor class="dbx-list-grid-view-item" matRipple [matRippleDisabled]="rippleDisabledOnItem(item)" [anchor]="item.anchor" [disabled]="item.disabled" (click)="onClickItem(item)">
            <div dbx-injection [config]="item.config"></div>
          </dbx-anchor>
        }
      </div>
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
  imports: [DbxInjectionComponent, DbxAnchorComponent, FlexLayoutModule, MatRipple],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxValueListGridViewContentGroupComponent<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxValueListGridViewContentComponent = inject(DbxValueListGridViewContentComponent<T>);
  readonly group = input<Maybe<DbxValueListItemGroup<G, T, I>>>();

  readonly trackByFunctionSignal = toSignal(this.dbxValueListGridViewContentComponent.trackBy$, { initialValue: DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION });
  readonly gridConfigSignal = this.dbxValueListGridViewContentComponent.gridConfigSignal;

  readonly itemsSignal = computed(() => this.group()?.items ?? []);
  readonly headerConfigSignal = computed(() => this.group()?.headerConfig);
  readonly footerConfigSignal = computed(() => this.group()?.footerConfig);
  readonly cssClassSignal = computed(() => spaceSeparatedCssClasses(this.group()?.cssClasses));

  onClickItem(item: I) {
    this.dbxValueListGridViewContentComponent.onClickItem(item);
  }

  rippleDisabledOnItem(item: I): boolean {
    return this.dbxValueListGridViewContentComponent.rippleDisabledOnItem(item);
  }
}

// MARK: DbxValueListGridViewContentComponent
/**
 * Renders grouped list items in a CSS grid layout. Supports configurable grid sizing via the `grid` input
 * or a parent {@link DbxValueListGridSizeDirective}.
 *
 * @example
 * ```html
 * <dbx-list-grid-view-content [items]="configuredItems" [grid]="{ columns: 'repeat(4, 1fr)', gap: '12px' }"></dbx-list-grid-view-content>
 * ```
 */
@Component({
  selector: 'dbx-list-grid-view-content',
  template: `
    @for (group of groupsSignal(); track group.id) {
      <dbx-list-grid-view-content-group [group]="group"></dbx-list-grid-view-content-group>
    }
  `,
  host: {
    class: 'dbx-list-grid-view'
  },
  standalone: true,
  imports: [DbxValueListGridViewContentGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListGridViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> extends DbxValueListViewContentComponent<T, I> {
  private readonly _gridSizeOverride = inject(DbxValueListGridSizeDirective, { optional: true });

  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly inputGridConfig = input<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>(undefined, { alias: 'grid' });
  readonly gridConfigFromGridSizeSignal = toSignal(this._gridSizeOverride?.gridSize$ ?? of(undefined));

  readonly gridConfigSignal: Signal<DbxValueListGridItemViewGridSizeConfig> = computed(() => {
    return mergeObjects<DbxValueListGridItemViewGridSizeConfig>([DEFAULT_LIST_GRID_SIZE_CONFIG, this.inputGridConfig(), this.gridConfigFromGridSizeSignal()]) as DbxValueListGridItemViewGridSizeConfig;
  });
}

// MARK: DbxValueListGridViewComponent
/**
 * Renders a value list as a CSS grid using a configuration input. Requires a parent {@link DbxListView} context.
 *
 * @dbxWebComponent
 * @dbxWebSlug list-grid-view
 * @dbxWebCategory list
 * @dbxWebRelated list, list-view
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <dbx-list-grid-view [config]="cellConfig"></dbx-list-grid-view>
 * ```
 *
 * @example
 * ```html
 * <dbx-list-grid-view [config]="cellConfig" dbxListGridSize="md"></dbx-list-grid-view>
 * ```
 */
@Component({
  selector: 'dbx-list-grid-view',
  template: `
    <dbx-list-grid-view-content [items]="itemsSignal()" [grid]="config().grid" [emitAllClicks]="config().emitAllClicks" [stickyHeaders]="config().stickyHeaders ?? true"></dbx-list-grid-view-content>
  `,
  standalone: true,
  imports: [DbxValueListGridViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListGridViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListGridViewConfig<T, I, V> = DbxValueListGridViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {}
