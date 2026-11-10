import { ChangeDetectionStrategy, Component, computed, input, model, type Signal, untracked } from '@angular/core';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxChipDirective, type DbxColorInput, DbxTextColorDirective } from '@dereekb/dbx-web';
import { type Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import {
  type DbxLayoutBoxesAddOption,
  type DbxLayoutBoxesCanvasSize,
  type DbxLayoutBoxesCapConfig,
  type DbxLayoutBoxesItemConfig,
  type DbxLayoutBoxesItemStyleFunction,
  type DbxLayoutBoxesListPosition,
  type DbxLayoutBoxesValue,
  type DbxLayoutBoxItem,
  DEFAULT_DBX_LAYOUT_BOX_NEW_BOX,
  defaultDbxLayoutBoxesCapWarning
} from './layoutboxes';
import { addDbxLayoutBoxItem, countDbxLayoutBoxItems, removeDbxLayoutBoxItem, updateDbxLayoutBoxItemBox, updateDbxLayoutBoxItemData } from './layoutboxes.geometry';
import { type DbxLayoutBoxesBoxChange, type DbxLayoutBoxesCanvasComponentConfig, DbxLayoutBoxesCanvasComponent } from './layoutboxes.canvas.component';
import { DbxLayoutBoxesItemRef } from './layoutboxes.item';

/**
 * Configuration for {@link DbxLayoutBoxesComponent}.
 */
export interface DbxLayoutBoxesComponentConfig<T = unknown> extends DbxLayoutBoxesCanvasComponentConfig<T> {
  /**
   * The component that shows or edits one box's payload in the box list. It should extend
   * {@link AbstractDbxLayoutBoxesItemDirective}, which provides the row's {@link DbxLayoutBoxesItemRef}.
   *
   * Pass one config for every row, or a {@link DbxLayoutBoxesItemConfigFunction} that picks a config per box, so
   * different boxes can show different components. A row keeps its component while its config reference stays the
   * same, and is rebuilt when the function returns a different one, such as after the box's payload changes kind.
   *
   * Keep the references stable (a class field or module constant, not a new literal on each call or change detection).
   * The `data` and `injector` pass through to the row, so `DBX_INJECTION_COMPONENT_DATA` can carry context such as a
   * lookup list.
   *
   * Rows show `Box N` when omitted, or when the function returns nothing for a box.
   */
  readonly item?: Maybe<DbxLayoutBoxesItemConfig<T>>;
  /**
   * One "add" button per option. No add buttons are shown when omitted.
   */
  readonly addOptions?: Maybe<DbxLayoutBoxesAddOption<T>[]>;
  /**
   * A soft limit on the number of boxes. Passing it shows a warning, but never blocks adding.
   */
  readonly cap?: Maybe<DbxLayoutBoxesCapConfig<T>>;
  /**
   * Where the box list is drawn. Defaults to `'side'`.
   */
  readonly listPosition?: Maybe<DbxLayoutBoxesListPosition>;
}

/**
 * One row of the box list.
 */
interface DbxLayoutBoxesRow<T> {
  readonly ref: DbxLayoutBoxesItemRef<T>;
  /**
   * The consumer's config the row was made from.
   */
  readonly itemConfig: Maybe<DbxInjectionComponentConfig>;
  /**
   * The config injected for the row: the consumer's config, plus the row's {@link DbxLayoutBoxesItemRef}.
   */
  readonly injectionConfig: Maybe<DbxInjectionComponentConfig>;
}

/**
 * A box's resolved style.
 */
interface DbxLayoutBoxesResolvedItemStyle {
  readonly cssClasses: string;
  readonly color: Maybe<DbxColorInput>;
}

/**
 * An editor for a list of layout boxes: the boxes drawn over a canvas (see {@link DbxLayoutBoxesCanvasComponent}),
 * a list with one row per box, add buttons and an optional cap warning.
 *
 * Each row renders the consumer's `item` component for that box's payload: one component for every row, or one picked
 * per box. Selecting a row selects its box, and the reverse. Rows are positional, and keep their component while the
 * box's payload changes and its picked config stays the same.
 *
 * The component holds no layout of its own: every edit computes the next value with the layout boxes geometry and
 * writes it whole to `value`.
 *
 * @example
 * ```html
 * <dbx-layout-boxes [config]="layoutConfig" [(value)]="boxes"></dbx-layout-boxes>
 * ```
 */
@Component({
  selector: 'dbx-layout-boxes',
  templateUrl: './layoutboxes.component.html',
  imports: [DbxLayoutBoxesCanvasComponent, DbxInjectionComponent, DbxButtonComponent, DbxChipDirective, DbxTextColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dbx-layout-boxes',
    '[class.dbx-layout-boxes-list-below]': 'listPositionSignal() === "below"',
    '[class.dbx-layout-boxes-readonly]': 'readonlySignal()'
  }
})
export class DbxLayoutBoxesComponent<T = unknown> {
  readonly config = input<Maybe<DbxLayoutBoxesComponentConfig<T>>>();

  /**
   * Overrides the config's canvas.
   */
  readonly canvas = input<Maybe<DbxLayoutBoxesCanvasSize>>();
  /**
   * Overrides the config's image url.
   */
  readonly imageUrl = input<Maybe<string>>();
  /**
   * Overrides the config's item style function.
   */
  readonly itemStyle = input<Maybe<DbxLayoutBoxesItemStyleFunction<T>>>();
  /**
   * Overrides the config's readonly flag.
   */
  readonly readonly = input<Maybe<boolean>>();
  /**
   * Overrides the config's row component.
   */
  readonly item = input<Maybe<DbxLayoutBoxesItemConfig<T>>>();
  /**
   * Overrides the config's add options.
   */
  readonly addOptions = input<Maybe<DbxLayoutBoxesAddOption<T>[]>>();
  /**
   * Overrides the config's cap.
   */
  readonly cap = input<Maybe<DbxLayoutBoxesCapConfig<T>>>();
  /**
   * Overrides the config's list position.
   */
  readonly listPosition = input<Maybe<DbxLayoutBoxesListPosition>>();

  /**
   * The boxes. Any value that is not an array is read as no boxes.
   */
  readonly value = model<Maybe<DbxLayoutBoxesValue<T>>>();

  /**
   * The selected box index.
   */
  readonly selectedIndex = model<Maybe<number>>();

  readonly canvasSignal = computed<Maybe<DbxLayoutBoxesCanvasSize>>(() => {
    const config = this.config();
    return this.canvas() ?? config?.canvas;
  });
  readonly imageUrlSignal = computed<Maybe<string>>(() => {
    const config = this.config();
    return this.imageUrl() ?? config?.imageUrl;
  });
  readonly itemStyleSignal = computed<Maybe<DbxLayoutBoxesItemStyleFunction<T>>>(() => {
    const config = this.config();
    return this.itemStyle() ?? config?.itemStyle;
  });
  readonly readonlySignal = computed<boolean>(() => {
    const config = this.config();
    return this.readonly() ?? config?.readonly ?? false;
  });
  readonly itemSignal = computed<Maybe<DbxLayoutBoxesItemConfig<T>>>(() => {
    const config = this.config();
    return this.item() ?? config?.item;
  });
  readonly addOptionsSignal = computed<DbxLayoutBoxesAddOption<T>[]>(() => {
    const config = this.config();
    return this.addOptions() ?? config?.addOptions ?? [];
  });
  readonly capSignal = computed<Maybe<DbxLayoutBoxesCapConfig<T>>>(() => {
    const config = this.config();
    return this.cap() ?? config?.cap;
  });
  readonly listPositionSignal = computed<DbxLayoutBoxesListPosition>(() => {
    const config = this.config();
    return this.listPosition() ?? config?.listPosition ?? 'side';
  });

  readonly valueSignal = computed<DbxLayoutBoxesValue<T>>(() => {
    const value = this.value();
    return Array.isArray(value) ? value : [];
  });

  readonly lengthSignal = computed(() => this.valueSignal().length);

  /**
   * The selected index, or `undefined` when it is out of range.
   */
  readonly selectedIndexSignal = computed<Maybe<number>>(() => {
    const length = this.lengthSignal();
    const index = this.selectedIndex();
    return index != null && index >= 0 && index < length ? index : undefined;
  });

  readonly itemStylesSignal = computed<DbxLayoutBoxesResolvedItemStyle[]>(() => {
    const itemStyle = this.itemStyleSignal();

    return this.valueSignal().map((item, index) => {
      const style = itemStyle?.(item, index);
      return { cssClasses: spaceSeparatedCssClasses(style?.cssClasses), color: style?.color };
    });
  });

  readonly capCountSignal = computed<number>(() => {
    const value = this.valueSignal();
    const cap = this.capSignal();
    return cap == null ? 0 : countDbxLayoutBoxItems(value, cap.countFilter);
  });

  readonly capWarningSignal = computed<Maybe<string>>(() => {
    const cap = this.capSignal();
    const count = this.capCountSignal();
    let warning: Maybe<string>;

    if (cap != null && count > cap.max) {
      const capWarning = cap.warning;
      warning = typeof capWarning === 'function' ? capWarning(count, cap.max) : (capWarning ?? defaultDbxLayoutBoxesCapWarning(count, cap.max));
    }

    return warning;
  });

  /**
   * The consumer's row config for each box.
   *
   * A single config only reads the length. A config function reads the value, but the array only changes when a box's
   * returned reference changes, so a payload edit that keeps each box's config does not reach the rows.
   */
  readonly rowItemConfigsSignal = computed<Maybe<DbxInjectionComponentConfig>[]>(
    () => {
      const item = this.itemSignal();
      let configs: Maybe<DbxInjectionComponentConfig>[];

      if (typeof item === 'function') {
        configs = this.valueSignal().map((x, index) => item(x, index));
      } else {
        configs = Array.from({ length: this.lengthSignal() }, () => item);
      }

      return configs;
    },
    { equal: (a, b) => a.length === b.length && a.every((x, i) => x === b[i]) }
  );

  private readonly _rowCache = new Map<number, DbxLayoutBoxesRow<T>>();

  /**
   * One row per box, cached by position so a row keeps its component while its box's payload changes.
   *
   * A row is rebuilt only when its box's config reference changes.
   */
  readonly rowsSignal = computed<DbxLayoutBoxesRow<T>[]>(() => {
    const itemConfigs = this.rowItemConfigsSignal();

    return untracked(() => {
      const length = itemConfigs.length;

      for (const index of this._rowCache.keys()) {
        if (index >= length) {
          this._rowCache.delete(index);
        }
      }

      return itemConfigs.map((itemConfig, index) => {
        let row = this._rowCache.get(index);

        if (row == null || row.itemConfig !== itemConfig) {
          row = this._makeRow(index, itemConfig);
          this._rowCache.set(index, row);
        }

        return row;
      });
    });
  });

  selectIndex(index: Maybe<number>): void {
    this.selectedIndex.set(index);
  }

  onBoxChange(change: DbxLayoutBoxesBoxChange): void {
    this._setValue(updateDbxLayoutBoxItemBox(this.valueSignal(), change));
  }

  setItemData(index: number, data: T): void {
    this._setValue(updateDbxLayoutBoxItemData(this.valueSignal(), { index, data }));
  }

  add(option: DbxLayoutBoxesAddOption<T>): void {
    const next = addDbxLayoutBoxItem(this.valueSignal(), { box: option.box ?? DEFAULT_DBX_LAYOUT_BOX_NEW_BOX, data: option.data() });
    this._setValue(next);
    this.selectedIndex.set(next.length - 1);
  }

  remove(index: number): void {
    const value = this.valueSignal();
    const next = removeDbxLayoutBoxItem(value, index);

    if (next !== value) {
      const selectedIndex = this.selectedIndexSignal();
      this._setValue(next);

      if (selectedIndex === index) {
        this.selectedIndex.set(undefined);
      } else if (selectedIndex != null && selectedIndex > index) {
        this.selectedIndex.set(selectedIndex - 1);
      }
    }
  }

  private _setValue(next: DbxLayoutBoxesValue<T>): void {
    if (next !== this.valueSignal()) {
      this.value.set(next);
    }
  }

  private _makeRow(index: number, itemConfig: Maybe<DbxInjectionComponentConfig>): DbxLayoutBoxesRow<T> {
    let lastItem: Maybe<DbxLayoutBoxItem<T>>;

    // falls back to the last item seen, so a row being torn down by a removal never reads undefined
    const itemSignal: Signal<DbxLayoutBoxItem<T>> = computed(() => {
      const current = this.valueSignal()[index] ?? lastItem;
      lastItem = current;
      return current as DbxLayoutBoxItem<T>;
    });

    const ref: DbxLayoutBoxesItemRef<T> = {
      index,
      itemSignal,
      dataSignal: computed(() => itemSignal()?.data as T),
      selectedSignal: computed(() => this.selectedIndexSignal() === index),
      readonlySignal: this.readonlySignal,
      setData: (data: T) => this.setItemData(index, data),
      select: () => this.selectIndex(index),
      remove: () => this.remove(index)
    };

    const injectionConfig: Maybe<DbxInjectionComponentConfig> = itemConfig
      ? {
          ...itemConfig,
          providers: [{ provide: DbxLayoutBoxesItemRef, useValue: ref }, ...(itemConfig.providers ?? [])],
          // a row-specific init keeps each row's config unique and stable, so a rebuilt row always gets a new component
          init: (instance: unknown) => itemConfig.init?.(instance)
        }
      : undefined;

    return { ref, itemConfig, injectionConfig };
  }
}
