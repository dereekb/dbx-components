import { computed, Directive, ElementRef, inject, input, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { resizeSignal } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';

export type DbxColumnSizeColumnValue = 'head' | 'tail' | number;

@Directive({
  exportAs: 'dbxColumnSize',
  selector: '[dbx-column-size]',
  standalone: true
})
export class DbxColumnSizeDirective implements OnDestroy {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly resized = resizeSignal(this.elementRef);

  private readonly _columnsMap = new BehaviorSubject(new Map<DbxColumnSizeColumnValue, DbxColumnSizeColumnDirective>());
  readonly columns$ = this._columnsMap.asObservable();

  readonly columnsSignal = toSignal(this.columns$);
  readonly visibleColumnsSignal = computed(() => {
    const resized = this.resized();
    const columnsMap = this.columnsSignal() as Map<DbxColumnSizeColumnValue, DbxColumnSizeColumnDirective>;

    const { width } = resized.newRect;

    let headerColumn: Maybe<DbxColumnSizeColumnDirective>;
    let tailColumn: Maybe<DbxColumnSizeColumnDirective>;
    const itemColumns: DbxColumnSizeColumnDirective[] = [];

    columnsMap.forEach((column) => {
      const index = column.index();

      switch (index) {
        case 'head':
          headerColumn = column;
          break;
        case 'tail':
          tailColumn = column;
          break;
        default:
          itemColumns[index] = column;
          break;
      }
    });

    const headerColumnWidth = headerColumn?.width || 0;
    const tailColumnWidth = tailColumn?.width || 0;

    let remainingWidth = width - headerColumnWidth;
    let visibleColumns = 1;
    let i = 0;

    while (remainingWidth > 0 && i < itemColumns.length) {
      const nextColumn = itemColumns[i];
      i += 1;

      const columnWidth = nextColumn.width;

      remainingWidth -= columnWidth;

      if (remainingWidth >= 0) {
        visibleColumns += 1;
      }
    }

    // show the tail column
    if (tailColumn != null && visibleColumns === itemColumns.length + 1 && remainingWidth - tailColumnWidth > 0) {
      visibleColumns += 1;
    }

    return visibleColumns;
  });

  addColumn(column: DbxColumnSizeColumnDirective) {
    this._columnsMap.value.set(column.index(), column);
    this._columnsMap.next(this._columnsMap.value);
  }

  removeColumn(column: DbxColumnSizeColumnDirective) {
    if (this._columnsMap.value.delete(column.index())) {
      this._columnsMap.next(this._columnsMap.value);
    }
  }

  ngOnDestroy(): void {
    this._columnsMap.complete();
  }
}

/**
 * References a specific element and the index of the column.
 */
@Directive({
  selector: '[dbx-column-size-column]',
  standalone: true
})
export class DbxColumnSizeColumnDirective implements OnInit, OnDestroy {
  readonly dbxColumnSizeDirective = inject(DbxColumnSizeDirective);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly index = input.required<DbxColumnSizeColumnValue>({ alias: 'dbx-column-size-column' });

  ngOnInit(): void {
    this.dbxColumnSizeDirective.addColumn(this);
  }

  ngOnDestroy(): void {
    this.dbxColumnSizeDirective.removeColumn(this);
  }

  get width(): number {
    return this.elementRef.nativeElement.clientWidth;
  }
}
