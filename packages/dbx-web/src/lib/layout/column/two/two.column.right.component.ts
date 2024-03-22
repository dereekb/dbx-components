import { AfterViewInit, OnDestroy, Component, Inject, Input } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { Maybe } from '@dereekb/util';

/**
 * Optional responsive component that wraps content on the right side and shows a navigation bar.
 *
 * When rendered it will trigger the context to show left.
 */
@Component({
  selector: 'dbx-two-column-right',
  templateUrl: './two.column.right.component.html',
  host: {
    class: 'dbx-two-column-right d-block'
  }
})
export class DbxTwoColumnRightComponent implements AfterViewInit, OnDestroy {
  @Input()
  full: boolean = false;

  @Input()
  header?: Maybe<string>;

  @Input()
  block?: boolean;

  private _showBack = new BehaviorSubject<boolean>(true);

  readonly ref$: Observable<Maybe<ClickableAnchor>> = this.twoColumnsContextStore.backRef$;

  readonly showBack$: Observable<boolean> = combineLatest([
    this._showBack,
    this.ref$.pipe(map((x) => !x)) // TODO: Is this correct? Show back if ref is not defined?
  ]).pipe(map(([a, b]: [boolean, boolean]) => a && b));

  constructor(@Inject(TwoColumnsContextStore) private readonly twoColumnsContextStore: TwoColumnsContextStore) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.twoColumnsContextStore.setHasRight(true);
    });
  }

  ngOnDestroy(): void {
    this._showBack.complete();
    this.twoColumnsContextStore.setHasRight(false);
  }

  @Input()
  get showBack(): boolean {
    return this._showBack.value;
  }

  set showBack(showBack: boolean) {
    this._showBack.next(showBack);
  }

  /**
   * Minimum right-side width allowed in pixels.
   */
  @Input()
  set minRightWidth(minRightWidth: Maybe<number | ''>) {
    this.twoColumnsContextStore.setMinRightWidth(typeof minRightWidth === 'number' ? minRightWidth : undefined);
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}
