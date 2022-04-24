import { ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Component, Inject, Input } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';


export interface DbxTwoColumnsViewState {
  showRight: boolean;
  showFullLeft: boolean;
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
  selector: 'dbx-two-columns',
  templateUrl: './two.column.component.html',
  exportAs: 'columns',
  host: {
    "class": "dbx-two-columns",
    "[class]": "{ 'right-shown': v.showRight, 'full-left': v.fullLeft, 'two-column-reverse-sizing': v.reverseSizing, 'dbx-section-page-two': v.inSectionPage }"
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTwoColumnsComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _view: DbxTwoColumnsViewState = { showRight: false, showFullLeft: true, reverseSizing: false, inSectionPage: false };

  private _reverseSizing = new BehaviorSubject<boolean>(false);
  private _inSectionPage = new BehaviorSubject<boolean>(false);

  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  readonly hideRight$: Observable<boolean> = this.twoColumnsContextStore.hideRight$;

  constructor(@Inject(TwoColumnsContextStore) public readonly twoColumnsContextStore: TwoColumnsContextStore, readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.showRight$, this.showFullLeft$, this._reverseSizing, this._inSectionPage])
      .subscribe(([showRight, showFullLeft, reverseSizing, inSectionPage]: [boolean, boolean, boolean, boolean]) => {
        this._view = {
          showRight,
          showFullLeft,
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

  get v(): DbxTwoColumnsViewState {
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

}
