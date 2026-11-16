import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { DbxColorDirective, type DbxColorInput } from '@dereekb/dbx-web';
import { type Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import { type DbxLayoutBox, type DbxLayoutBoxCorner, type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesItemStyleFunction, type DbxLayoutBoxesValue, DBX_LAYOUT_BOX_CORNERS, DEFAULT_DBX_LAYOUT_BOXES_CANVAS_SIZE } from './layoutboxes';
import { dbxLayoutBoxesCanvasAspectRatio, isSameDbxLayoutBox, moveDbxLayoutBox, nudgeDbxLayoutBox, resizeDbxLayoutBox } from './layoutboxes.geometry';

/**
 * Configuration for {@link DbxLayoutBoxesCanvasComponent}.
 */
export interface DbxLayoutBoxesCanvasComponentConfig<T = unknown> {
  /**
   * The canvas the boxes are drawn on. Only its aspect ratio is used. Defaults to a square.
   */
  readonly canvas?: Maybe<DbxLayoutBoxesCanvasSize>;
  /**
   * A picture drawn under the boxes, stretched to the canvas.
   */
  readonly imageUrl?: Maybe<string>;
  /**
   * Returns the CSS classes and color for each box.
   */
  readonly itemStyle?: Maybe<DbxLayoutBoxesItemStyleFunction<T>>;
  /**
   * Draws the boxes with no handles, no dragging and no keyboard editing.
   */
  readonly readonly?: Maybe<boolean>;
}

/**
 * A box change emitted by {@link DbxLayoutBoxesCanvasComponent} when a box is dropped after a move or resize, or nudged
 * with the keyboard.
 */
export interface DbxLayoutBoxesBoxChange {
  /**
   * The index of the box that changed.
   */
  readonly index: number;
  /**
   * The box's new rectangle.
   */
  readonly box: DbxLayoutBox;
}

/**
 * The drag in flight: the box's start, the pointer's start, the canvas rect, and the box as it moves.
 */
interface DbxLayoutBoxesCanvasDrag {
  readonly index: number;
  readonly corner?: Maybe<DbxLayoutBoxCorner>;
  readonly rect: DOMRect;
  readonly startX: number;
  readonly startY: number;
  readonly origin: DbxLayoutBox;
  readonly box: DbxLayoutBox;
}

/**
 * One box as drawn.
 */
interface DbxLayoutBoxesCanvasBox {
  readonly box: DbxLayoutBox;
  readonly cssClasses: string;
  readonly color: Maybe<DbxColorInput>;
}

/**
 * Draws a list of layout boxes over a canvas of a given aspect, optionally over a picture.
 *
 * When editable, a box is moved by dragging it, resized by dragging a corner handle of the selected box, and nudged with
 * the arrow keys (Shift steps 5 times as far, Alt resizes from the bottom-right corner). Each finished change is
 * emitted as a {@link DbxLayoutBoxesBoxChange}; the component holds no layout of its own beyond the drag in flight.
 *
 * With `readonly` it works on its own as an overlay viewer.
 *
 * @example
 * ```html
 * <dbx-layout-boxes-canvas [items]="boxes()" [canvas]="{ width: 16, height: 9 }" [imageUrl]="pictureUrl" [readonly]="true"></dbx-layout-boxes-canvas>
 * ```
 */
@Component({
  selector: 'dbx-layout-boxes-canvas',
  templateUrl: './layoutboxes.canvas.component.html',
  imports: [DbxColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dbx-layout-boxes-canvas',
    role: 'group',
    'aria-label': 'Layout boxes',
    '[class.dbx-layout-boxes-canvas-readonly]': 'readonlySignal()',
    '[style.--dbx-layout-boxes-canvas-ratio-current]': 'aspectRatioSignal()',
    '(pointerdown)': 'onCanvasPointerDown()'
  }
})
export class DbxLayoutBoxesCanvasComponent<T = unknown> {
  readonly corners = DBX_LAYOUT_BOX_CORNERS;

  /**
   * The boxes to draw.
   */
  readonly items = input<Maybe<DbxLayoutBoxesValue<T>>>();
  readonly config = input<Maybe<DbxLayoutBoxesCanvasComponentConfig<T>>>();

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
   * The selected box index.
   */
  readonly selectedIndex = model<Maybe<number>>();

  /**
   * Emitted when a box is dropped after it changed, and on each keyboard nudge.
   */
  readonly boxChange = output<DbxLayoutBoxesBoxChange>();

  private readonly _drag = signal<Maybe<DbxLayoutBoxesCanvasDrag>>(undefined);

  readonly canvasSignal = computed<DbxLayoutBoxesCanvasSize>(() => {
    const config = this.config();
    return this.canvas() ?? config?.canvas ?? DEFAULT_DBX_LAYOUT_BOXES_CANVAS_SIZE;
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
  readonly aspectRatioSignal = computed<number>(() => dbxLayoutBoxesCanvasAspectRatio(this.canvasSignal()));

  readonly itemsSignal = computed<DbxLayoutBoxesValue<T>>(() => {
    const items = this.items();
    return Array.isArray(items) ? items : [];
  });

  /**
   * The boxes as drawn. The box being dragged shows its live position.
   */
  readonly boxesSignal = computed<DbxLayoutBoxesCanvasBox[]>(() => {
    const drag = this._drag();
    const itemStyle = this.itemStyleSignal();

    return this.itemsSignal().map((item, index) => {
      const style = itemStyle?.(item, index);

      return {
        box: drag?.index === index ? drag.box : item.box,
        cssClasses: spaceSeparatedCssClasses(style?.cssClasses),
        color: style?.color
      };
    });
  });

  onCanvasPointerDown(): void {
    if (!this.readonlySignal()) {
      this.selectedIndex.set(undefined);
    }
  }

  onBoxFocus(index: number): void {
    if (!this.readonlySignal()) {
      this.selectedIndex.set(index);
    }
  }

  dragStart(event: PointerEvent, index: number, corner?: Maybe<DbxLayoutBoxCorner>): void {
    const item = this.itemsSignal()[index];

    if (!this.readonlySignal() && item != null) {
      const target = event.currentTarget as HTMLElement;
      const canvasElement = target.closest('.dbx-layout-boxes-canvas');
      const boxElement = target.closest<HTMLElement>('.dbx-layout-boxes-box');
      const rect = canvasElement?.getBoundingClientRect();

      // stop here so a handle does not start a move and the canvas does not clear the selection
      event.stopPropagation();
      event.preventDefault();
      boxElement?.focus?.({ preventScroll: true });
      this.selectedIndex.set(index);

      if (rect != null && rect.width > 0 && rect.height > 0) {
        target.setPointerCapture?.(event.pointerId);
        this._drag.set({ index, corner, rect, startX: event.clientX, startY: event.clientY, origin: item.box, box: item.box });
      }
    }
  }

  dragMove(event: PointerEvent): void {
    const drag = this._drag();

    if (drag != null) {
      const delta = { x: (event.clientX - drag.startX) / drag.rect.width, y: (event.clientY - drag.startY) / drag.rect.height };
      const box = drag.corner == null ? moveDbxLayoutBox(drag.origin, delta) : resizeDbxLayoutBox(drag.origin, { corner: drag.corner, delta });
      this._drag.set({ ...drag, box });
    }
  }

  dragEnd(): void {
    const drag = this._drag();

    if (drag != null) {
      this._drag.set(undefined);

      if (!isSameDbxLayoutBox(drag.box, drag.origin)) {
        this.boxChange.emit({ index: drag.index, box: drag.box });
      }
    }
  }

  onBoxKeydown(event: KeyboardEvent, index: number): void {
    const item = this.itemsSignal()[index];
    const box = item == null || this.readonlySignal() ? undefined : nudgeDbxLayoutBox(item.box, event);

    if (box != null) {
      event.preventDefault();
      this.selectedIndex.set(index);
      this.boxChange.emit({ index, box });
    }
  }
}
