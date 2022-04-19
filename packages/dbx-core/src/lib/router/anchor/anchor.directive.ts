import { skipFirstMaybe } from '@dereekb/rxjs';
import { map, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Observable, delay } from 'rxjs';
import { Directive, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AnchorType, ClickableAnchor, anchorTypeForAnchor, DbxAnchor } from './anchor';

/**
 * Abstract anchor directive.
 */
@Directive()
export class AbstractDbxAnchorDirective<T extends ClickableAnchor = ClickableAnchor> implements DbxAnchor, OnDestroy {

  private _disabled = new BehaviorSubject<Maybe<boolean>>(false);
  private _anchor = new BehaviorSubject<Maybe<T>>(undefined);

  readonly disabled$ = this._disabled.asObservable();
  readonly anchor$ = this._anchor.pipe(skipFirstMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly type$: Observable<AnchorType> = combineLatest([this.disabled$, this.anchor$]).pipe(
    delay(0),
    map(([disabled, anchor]) => anchorTypeForAnchor(anchor, disabled)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor() { }

  ngOnDestroy(): void {
    this._disabled.complete();
    this._anchor.complete();
  }

  @Input()
  public get anchor(): Maybe<T> {
    return this._anchor.value;
  }

  public set anchor(anchor: Maybe<T>) {
    this._anchor.next(anchor);
  }

  @Input()
  public get disabled(): Maybe<boolean> {
    return this._disabled.value;
  }

  public set disabled(disabled: Maybe<boolean>) {
    this._disabled.next(disabled);
  }

}
