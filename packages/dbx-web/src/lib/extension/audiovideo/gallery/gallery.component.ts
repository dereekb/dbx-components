import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, type Signal } from '@angular/core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { of } from 'rxjs';
import { AbstractDbxListGridViewDirective } from '../../../layout/list/grid/list.grid.view.directive';
import { type DbxValueListGridItemViewGridSizeConfig, DbxValueListGridSizeDirective, DbxValueListGridViewComponent, type DbxValueListGridViewConfig } from '../../../layout/list/grid/list.grid.view.component';
import { AbstractDbxListWrapperDirective, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE } from '../../../layout/list/list.directive';
import { provideDbxListView } from '../../../layout/list/list.view';
import { type DbxValueAsListItem } from '../../../layout/list/list.view.value';
import { AbstractDbxValueListViewItemComponent } from '../../../layout/list/list.view.value.item.directive';
import { provideDbxListViewWrapper } from '../../../layout/list/list.wrapper';
import {
  DEFAULT_DBX_GALLERY_ASPECT_RATIO,
  DEFAULT_DBX_GALLERY_GRID_GAP,
  DEFAULT_DBX_GALLERY_SLOT_MODE,
  DbxGalleryContext,
  DbxGalleryItem,
  type DbxGalleryConfig,
  type DbxGallerySlotConfig,
  type DbxGallerySlotMode,
  dbxGalleryGridColumns,
  dbxGallerySlotInjectionConfig,
  isSameDbxGallerySlotInjectionConfig
} from './gallery';
import { DbxGalleryImagePresentationComponent } from './gallery.image.presentation.component';

// MARK: Gallery
/**
 * Image / media gallery. Renders values as tiles in a responsive grid, where each tile has three injected slots: a
 * presentation (an image, a solid color, an avatar, a clip, …) and top/bottom bars (labels, copy/delete/load buttons, …).
 *
 * Built on dbx-list, so it accepts `[state]`, emits `clickItem` and `loadMore`, and supports the `empty`/`emptyLoading` content
 * slots. Add `dbxListItemModifier dbxListItemSingleSelectionModifier` to let the user select one tile.
 *
 * @dbxWebComponent
 * @dbxWebSlug gallery
 * @dbxWebCategory list
 * @dbxWebRelated gallery-image-presentation, list-item-single-selection-modifier, image-hover-preview, list-grid-view
 * @dbxWebMinimalExample ```html
 * <dbx-gallery [state]="imagesState$"></dbx-gallery>
 * ```
 *
 * @example
 * ```html
 * <dbx-gallery [state]="state$" [galleryConfig]="galleryConfig" topSlotMode="overlay" dbxListItemModifier dbxListItemSingleSelectionModifier (selectionChange)="onSelect($event)"></dbx-gallery>
 * ```
 *
 * ```ts
 * galleryConfig: DbxGalleryConfig<MyItem> = {
 *   presentation: (x) => (x.kind === 'image' ? { componentClass: DbxGalleryImagePresentationComponent, data: { hoverPreview: true } } : { componentClass: MyColorPresentationComponent }),
 *   bottom: { componentClass: MyActionsComponent, data: { onDelete: (x: MyItem) => this.delete(x) } },
 *   keyForValue: (x) => x.id
 * };
 * ```
 */
@Component({
  selector: 'dbx-gallery',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-gallery'
  },
  providers: [...provideDbxListViewWrapper(DbxGalleryComponent), { provide: DbxGalleryContext, useExisting: forwardRef(() => DbxGalleryComponent) }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxGalleryComponent<T> extends AbstractDbxListWrapperDirective<T> implements DbxGalleryContext<T> {
  readonly galleryConfig = input<Maybe<DbxGalleryConfig<T>>>();

  readonly presentation = input<Maybe<DbxGallerySlotConfig<T>>>();
  readonly top = input<Maybe<DbxGallerySlotConfig<T>>>();
  readonly bottom = input<Maybe<DbxGallerySlotConfig<T>>>();
  readonly keyForValue = input<Maybe<(value: T) => Maybe<string>>>();
  readonly grid = input<Maybe<Partial<DbxValueListGridItemViewGridSizeConfig>>>();
  readonly itemMinWidth = input<Maybe<string>>();
  readonly columns = input<Maybe<number>>();
  readonly slotMode = input<Maybe<DbxGallerySlotMode>>();
  readonly topSlotMode = input<Maybe<DbxGallerySlotMode>>();
  readonly bottomSlotMode = input<Maybe<DbxGallerySlotMode>>();
  readonly aspectRatio = input<Maybe<string>>();

  readonly galleryConfigSignal: Signal<DbxGalleryConfig<T>> = computed(() => {
    const config = this.galleryConfig();

    return {
      presentation: this.presentation() ?? config?.presentation,
      top: this.top() ?? config?.top,
      bottom: this.bottom() ?? config?.bottom,
      keyForValue: this.keyForValue() ?? config?.keyForValue,
      grid: this.grid() ?? config?.grid,
      itemMinWidth: this.itemMinWidth() ?? config?.itemMinWidth,
      columns: this.columns() ?? config?.columns,
      slotMode: this.slotMode() ?? config?.slotMode,
      topSlotMode: this.topSlotMode() ?? config?.topSlotMode,
      bottomSlotMode: this.bottomSlotMode() ?? config?.bottomSlotMode,
      aspectRatio: this.aspectRatio() ?? config?.aspectRatio
    };
  });

  constructor() {
    super({
      componentClass: DbxGalleryViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

// MARK: View
/**
 * Grid view used by {@link DbxGalleryComponent}.
 */
@Component({
  selector: 'dbx-gallery-view',
  template: `
    <dbx-list-grid-view [config]="config" [dbxListGridSize]="gridSignal()"></dbx-list-grid-view>
  `,
  imports: [DbxValueListGridViewComponent, DbxValueListGridSizeDirective],
  providers: provideDbxListView(DbxGalleryViewComponent),
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxGalleryViewComponent<T> extends AbstractDbxListGridViewDirective<T> {
  readonly galleryContext = inject(DbxGalleryContext<T>);

  readonly gridSignal = computed<Partial<DbxValueListGridItemViewGridSizeConfig>>(() => {
    const { grid, itemMinWidth, columns } = this.galleryContext.galleryConfigSignal();
    const gap = grid?.gap ?? DEFAULT_DBX_GALLERY_GRID_GAP;
    return { columns: grid?.columns ?? dbxGalleryGridColumns({ itemMinWidth, columns, gap }), gap };
  });

  readonly config: DbxValueListGridViewConfig<DbxValueAsListItem<T>> = {
    componentClass: DbxGalleryItemComponent,
    mapValuesToItemValues: (values) => {
      const keyForValue = this.galleryContext.galleryConfigSignal().keyForValue;
      return of(values.map((value) => ({ key: keyForValue?.(value) as string, itemValue: value as DbxValueAsListItem<T> })));
    }
  };
}

// MARK: Item
/**
 * A single gallery tile. Renders the top slot, the presentation slot inside an aspect-ratio box, and the bottom slot.
 *
 * Clicks inside the top and bottom slots do not reach the tile, so action buttons there do not select the item. The slots carry
 * the `dbx-override-click-ignore` class (`DBX_OVERRIDE_CLICK_IGNORE_CLASS`) so the list item's clickable anchor does not redirect their clicks to itself, and
 * the host then stops them from bubbling to the anchor.
 */
@Component({
  selector: 'dbx-gallery-item',
  template: `
    @if (topConfigSignal()) {
      <div class="dbx-gallery-item-slot dbx-gallery-item-top dbx-override-click-ignore" [class.dbx-gallery-item-slot-overlay]="topSlotModeSignal() === 'overlay'">
        <dbx-injection [config]="topConfigSignal()"></dbx-injection>
      </div>
    }
    <div class="dbx-gallery-item-presentation" [style.aspect-ratio]="aspectRatioSignal()">
      <dbx-injection [config]="presentationConfigSignal()"></dbx-injection>
    </div>
    @if (bottomConfigSignal()) {
      <div class="dbx-gallery-item-slot dbx-gallery-item-bottom dbx-override-click-ignore" [class.dbx-gallery-item-slot-overlay]="bottomSlotModeSignal() === 'overlay'">
        <dbx-injection [config]="bottomConfigSignal()"></dbx-injection>
      </div>
    }
  `,
  host: {
    class: 'dbx-gallery-item',
    '[class.dbx-gallery-item-selected]': 'selectedSignal()',
    '(click)': 'stopSlotEventPropagation($event)',
    '(mousedown)': 'stopSlotEventPropagation($event)',
    '(keydown.enter)': 'stopSlotEventPropagation($event)'
  },
  imports: [DbxInjectionComponent],
  providers: [{ provide: DbxGalleryItem, useExisting: forwardRef(() => DbxGalleryItemComponent) }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxGalleryItemComponent<T> extends AbstractDbxValueListViewItemComponent<T> implements DbxGalleryItem<T> {
  readonly galleryContext = inject(DbxGalleryContext<T>);

  readonly valueSignal: Signal<T> = this.itemValueSignal;
  readonly selectedSignal: Signal<boolean> = computed(() => Boolean(this.itemSignal().selected));

  readonly topSlotModeSignal = computed(() => {
    const { topSlotMode, slotMode } = this.galleryContext.galleryConfigSignal();
    return topSlotMode ?? slotMode ?? DEFAULT_DBX_GALLERY_SLOT_MODE;
  });

  readonly bottomSlotModeSignal = computed(() => {
    const { bottomSlotMode, slotMode } = this.galleryContext.galleryConfigSignal();
    return bottomSlotMode ?? slotMode ?? DEFAULT_DBX_GALLERY_SLOT_MODE;
  });
  readonly aspectRatioSignal = computed(() => this.galleryContext.galleryConfigSignal().aspectRatio ?? DEFAULT_DBX_GALLERY_ASPECT_RATIO);

  readonly presentationConfigSignal = computed(() => dbxGallerySlotInjectionConfig(this.galleryContext.galleryConfigSignal().presentation ?? { componentClass: DbxGalleryImagePresentationComponent }, this.valueSignal()), { equal: isSameDbxGallerySlotInjectionConfig });
  readonly topConfigSignal = computed(() => dbxGallerySlotInjectionConfig(this.galleryContext.galleryConfigSignal().top, this.valueSignal()), { equal: isSameDbxGallerySlotInjectionConfig });
  readonly bottomConfigSignal = computed(() => dbxGallerySlotInjectionConfig(this.galleryContext.galleryConfigSignal().bottom, this.valueSignal()), { equal: isSameDbxGallerySlotInjectionConfig });

  /**
   * Stops events from the top and bottom slots from reaching the tile, so action buttons there do not select the item or start its ripple.
   *
   * @param event - The DOM event.
   */
  stopSlotEventPropagation(event: Event): void {
    if ((event.target as Maybe<Element>)?.closest?.('.dbx-gallery-item-slot')) {
      event.stopPropagation();
    }
  }
}
