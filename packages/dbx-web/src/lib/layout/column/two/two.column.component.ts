import { ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy, OnInit, Component, Inject, Input, ElementRef } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { ResizedEvent } from 'angular-resize-event';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';

export interface DbxTwoColumnViewState {
  showRight: boolean;
  showFullLeft: boolean;
  hideLeftColumn: boolean;
  reverseSizing: boolean;
  inSectionPage: boolean;
}

/**
 * Responsive component meant to split a left and right column.
 *
 * The left column is smaller than the right column, which contains the primary content.
 *
 * Requires a TwoColumnsContextStore to be provided.
 */
@Component({
  selector: 'dbx-two-column',
  templateUrl: './two.column.component.html',
  exportAs: 'columns',
  host: {
    class: 'dbx-two-column',
    '[class]': "{ 'right-shown': v.showRight, 'full-left': v.showFullLeft,'hide-left-column': v.hideLeftColumn, 'two-column-reverse-sizing': v.reverseSizing, 'dbx-section-page-two': v.inSectionPage }"
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTwoColumnComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _view: DbxTwoColumnViewState = { showRight: false, showFullLeft: true, hideLeftColumn: false, reverseSizing: false, inSectionPage: false };

  private _reverseSizing = new BehaviorSubject<boolean>(false);
  private _inSectionPage = new BehaviorSubject<boolean>(false);

  readonly hideLeftColumn$: Observable<boolean> = this.twoColumnsContextStore.hideLeft$;
  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  readonly hideRight$: Observable<boolean> = this.twoColumnsContextStore.hideRight$;

  constructor(@Inject(TwoColumnsContextStore) public readonly twoColumnsContextStore: TwoColumnsContextStore, private elementRef: ElementRef, readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.showRight$, this.showFullLeft$, this.hideLeftColumn$, this._reverseSizing, this._inSectionPage]).subscribe(([showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage]: [boolean, boolean, boolean, boolean, boolean]) => {
      this._view = {
        showRight,
        showFullLeft,
        hideLeftColumn,
        reverseSizing,
        inSectionPage
      };

      safeMarkForCheck(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._reverseSizing.complete();
    this._inSectionPage.complete();
  }

  get v(): DbxTwoColumnViewState {
    return this._view;
  }

  @Input()
  set reverseSizing(reverseSizing: boolean) {
    this._reverseSizing.next(reverseSizing);
  }

  @Input()
  set inSectionPage(inSectionPage: boolean) {
    this._inSectionPage.next(inSectionPage);
  }

  onResized(event: ResizedEvent): void {
    const totalWidth = (this.elementRef.nativeElement as HTMLElement).clientWidth;
    this.twoColumnsContextStore.setTotalWidth(totalWidth);
  }
}
