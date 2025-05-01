import { Observable } from 'rxjs';
import { computed, Directive, model } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { ClickableAnchorType, ClickableAnchor, anchorTypeForAnchor, DbxAnchor } from './anchor';
import { SegueRefOrSegueRefRouterLink, asSegueRef } from '../segue';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract anchor directive.
 */
@Directive()
export class AbstractDbxAnchorDirective<T extends ClickableAnchor = ClickableAnchor> implements DbxAnchor {
  readonly ref = model<Maybe<SegueRefOrSegueRefRouterLink>>();
  readonly anchor = model<Maybe<T>>();
  readonly disabled = model<Maybe<boolean>>();
  readonly selected = model<Maybe<boolean>>();

  readonly anchorSignal = computed(() => {
    const ref = this.ref();
    const anchor = this.anchor();

    let result: Maybe<T> = anchor;

    if (ref) {
      result = asSegueRef(ref) as T;
    }

    return result;
  });

  readonly selectedSignal = computed(() => {
    const selected = this.selected();
    const anchor = this.anchorSignal();

    return selected || anchor?.selected;
  });

  readonly typeSignal = computed(() => anchorTypeForAnchor(this.anchorSignal(), this.disabled()));

  readonly urlSignal = computed(() => this.anchorSignal()?.url);
  readonly targetSignal = computed(() => this.anchorSignal()?.target);

  readonly anchor$: Observable<Maybe<T>> = toObservable(this.anchorSignal);
  readonly disabled$: Observable<Maybe<boolean>> = toObservable(this.disabled);
  readonly selected$: Observable<Maybe<boolean>> = toObservable(this.selectedSignal);
  readonly type$: Observable<ClickableAnchorType> = toObservable(this.typeSignal);

  // MARK: Accessors
  setRef(ref: Maybe<SegueRefOrSegueRefRouterLink>) {
    this.ref.set(ref);
  }

  setAnchor(anchor: Maybe<T>) {
    this.anchor.set(anchor);
  }

  setDisabled(disabled: Maybe<boolean>) {
    this.disabled.set(disabled);
  }

  setSelected(selected: Maybe<boolean>) {
    this.selected.set(selected);
  }
}
