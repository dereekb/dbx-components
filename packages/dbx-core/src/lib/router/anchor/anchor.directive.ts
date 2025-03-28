import { skipFirstMaybe } from '@dereekb/rxjs';
import { map, shareReplay, distinctUntilChanged, BehaviorSubject, combineLatest, Observable, delay } from 'rxjs';
import { computed, Directive, Input, OnDestroy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AnchorType, ClickableAnchor, anchorTypeForAnchor, DbxAnchor } from './anchor';
import { SegueRefOrSegueRefRouterLink, asSegueRef } from '../segue';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Abstract anchor directive.
 */
@Directive()
export class AbstractDbxAnchorDirective<T extends ClickableAnchor = ClickableAnchor> implements DbxAnchor, OnDestroy {
  private readonly _selected = new BehaviorSubject<Maybe<boolean>>(false);
  private readonly _disabled = new BehaviorSubject<Maybe<boolean>>(false);
  private readonly _anchor = new BehaviorSubject<Maybe<T>>(undefined);

  readonly disabled$: Observable<Maybe<boolean>> = this._disabled.pipe(distinctUntilChanged());
  readonly anchor$: Observable<Maybe<T>> = this._anchor.pipe(skipFirstMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly selected$: Observable<Maybe<boolean>> = combineLatest([this._selected, this.anchor$]).pipe(
    map(([selected, anchor]) => selected || anchor?.selected),
    distinctUntilChanged()
  );

  readonly type$: Observable<AnchorType> = combineLatest([this.disabled$, this.anchor$]).pipe(
    delay(0),
    map(([disabled, anchor]) => anchorTypeForAnchor(anchor, disabled)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  private readonly _anchorSignal = toSignal(this.anchor$, { initialValue: this._anchor.value });
  private readonly _disabledSignal = toSignal(this.disabled$, { initialValue: this._disabled.value });
  private readonly _selectedSignal = toSignal(this.selected$, { initialValue: this._selected.value });
  private readonly _typeSignal = toSignal(this.type$, { initialValue: anchorTypeForAnchor(this._anchor.value, this._disabled.value) });

  readonly disabledSignal = computed(() => this._disabledSignal());
  readonly selectedSignal = computed(() => this._selectedSignal());
  readonly urlSignal = computed(() => this._anchorSignal()?.url);
  readonly targetSignal = computed(() => this._anchorSignal()?.target);
  readonly typeSignal = computed(() => this._typeSignal());

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
