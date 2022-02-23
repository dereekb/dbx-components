import { AfterViewInit, OnDestroy, Component, Inject, Input } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { Maybe } from '@dereekb/util';

/**
 * Optional responsive component that wraps content on the right side and shows a navigation bar.
 */
@Component({
  selector: 'dbx-two-columns-right',
  templateUrl: './two.column.right.component.html'
})
export class DbxTwoColumnsRightComponent implements AfterViewInit, OnDestroy {

  private _showBack = new BehaviorSubject<boolean>(true);

  @Input()
  header?: string;

  readonly ref$: Observable<Maybe<ClickableAnchor>> = this.twoColumnsContextStore.backRef$;

  readonly showBack$: Observable<boolean> = combineLatest([
    this._showBack, this.ref$.pipe(map((x) => !Boolean(x))) // TODO: Is this correct? Show back if ref is not defined?
  ]).pipe(
    map(([a, b]: [boolean, boolean]) => a && b)
  );

  constructor(
    @Inject(TwoColumnsContextStore) private readonly twoColumnsContextStore: TwoColumnsContextStore
  ) { }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.twoColumnsContextStore.setShowRight(true);
    });
  }

  ngOnDestroy(): void {
    this.twoColumnsContextStore.setShowRight(false);
  }

  @Input()
  get showBack(): boolean {
    return this._showBack.value;
  }

  set showBack(showBack: boolean) {
    this._showBack.next(showBack);
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }

}
