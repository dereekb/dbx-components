import { skipFirstMaybe } from '@dereekb/rxjs';
import { map, shareReplay, distinctUntilChanged, BehaviorSubject, combineLatest, Observable, delay } from 'rxjs';
import { Directive, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AnchorType, ClickableAnchor, anchorTypeForAnchor, DbxAnchor } from './anchor';
import { SegueRefOrSegueRefRouterLink, asSegueRef } from '../segue';

/**
 * Abstract anchor directive.
 */
@Directive()
export class AbstractDbxAnchorDirective<T extends ClickableAnchor = ClickableAnchor> implements DbxAnchor, OnDestroy {
  private _selected = new BehaviorSubject<Maybe<boolean>>(false);
  private _disabled = new BehaviorSubject<Maybe<boolean>>(false);
  private _anchor = new BehaviorSubject<Maybe<T>>(undefined);

  readonly disabled$ = this._disabled.pipe(distinctUntilChanged());
  readonly anchor$ = this._anchor.pipe(skipFirstMaybe(), distinctUntilChanged(), shareReplay(1));
  readonly selected$ = combineLatest([this._selected, this.anchor$]).pipe(
    map(([selected, anchor]) => selected || anchor?.selected),
    distinctUntilChanged()
  );

  readonly type$: Observable<AnchorType> = combineLatest([this.disabled$, this.anchor$]).pipe(
    delay(0),
    map(([disabled, anchor]) => anchorTypeForAnchor(anchor, disabled)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this._selected.complete();
    this._disabled.complete();
    this._anchor.complete();
  }

  /**
   * Convenience input to create an Anchor from the input SegueRef.
   */
  @Input()
  public set ref(ref: Maybe<SegueRefOrSegueRefRouterLink>) {
    this.anchor = asSegueRef(ref) as T;
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

  @Input()
  public get selected(): Maybe<boolean> {
    return this._selected.value;
  }

  public set selected(selected: Maybe<boolean>) {
    this._selected.next(selected);
  }
}
