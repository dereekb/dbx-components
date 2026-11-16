import { Directive, inject, type Signal } from '@angular/core';
import { type DbxLayoutBoxItem } from './layoutboxes';

/**
 * The live context of one box row, provided to the component injected for that row.
 *
 * Rows are positional: the row at index N always edits box N + 1, and keeps its component while the box's payload changes.
 */
export abstract class DbxLayoutBoxesItemRef<T = unknown> {
  /**
   * The row's index. Fixed per row; the number shown is index + 1.
   */
  abstract readonly index: number;
  /**
   * The box and payload at this row's index.
   */
  abstract readonly itemSignal: Signal<DbxLayoutBoxItem<T>>;
  /**
   * The payload at this row's index.
   */
  abstract readonly dataSignal: Signal<T>;
  /**
   * Whether this row's box is selected.
   */
  abstract readonly selectedSignal: Signal<boolean>;
  /**
   * Whether the layout is readonly. Row components should show text instead of inputs while true.
   */
  abstract readonly readonlySignal: Signal<boolean>;
  /**
   * Replaces this box's payload. The whole value is written, with only this box's payload changed.
   */
  abstract setData(data: T): void;
  /**
   * Selects this row's box.
   */
  abstract select(): void;
  /**
   * Removes this row's box.
   */
  abstract remove(): void;
}

/**
 * Base class for a component that shows or edits one box's payload in the layout boxes list.
 *
 * Injects the row's {@link DbxLayoutBoxesItemRef} and re-exposes it to templates.
 *
 * @example
 * ```ts
 * @Component({
 *   template: `<input [value]="dataSignal().label ?? ''" [readonly]="readonlySignal()" (input)="setData({ ...dataSignal(), label: $any($event.target).value })" />`
 * })
 * export class MyBoxRowComponent extends AbstractDbxLayoutBoxesItemDirective<MyBoxData> {}
 * ```
 */
@Directive()
export abstract class AbstractDbxLayoutBoxesItemDirective<T = unknown> {
  readonly layoutBoxesItemRef = inject<DbxLayoutBoxesItemRef<T>>(DbxLayoutBoxesItemRef);
  readonly index = this.layoutBoxesItemRef.index;
  readonly number = this.index + 1;
  readonly itemSignal = this.layoutBoxesItemRef.itemSignal;
  readonly dataSignal = this.layoutBoxesItemRef.dataSignal;
  readonly selectedSignal = this.layoutBoxesItemRef.selectedSignal;
  readonly readonlySignal = this.layoutBoxesItemRef.readonlySignal;

  setData(data: T): void {
    this.layoutBoxesItemRef.setData(data);
  }
}
