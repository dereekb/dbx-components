import { type Observable } from 'rxjs';
import { computed, Directive, model } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type ClickableAnchorType, type ClickableAnchor, anchorTypeForAnchor, type DbxAnchor } from './anchor';
import { type SegueRefOrSegueRefRouterLink, asSegueRef } from '../segue';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract base directive for managing anchor state using Angular signals and model inputs.
 *
 * Provides reactive computed properties for the resolved anchor, its disabled/selected state, and its type.
 * Subclasses can extend this to implement framework-specific anchor rendering (e.g., UIRouter or Angular Router).
 *
 * @typeParam T - The specific anchor type, defaulting to {@link ClickableAnchor}.
 *
 * @example
 * ```html
 * <!-- Usage in a template via a concrete subclass -->
 * <my-anchor [ref]="'/app/dashboard'" [disabled]="isDisabled">
 *   Dashboard
 * </my-anchor>
 * ```
 *
 * @example
 * ```ts
 * // Programmatic usage
 * directive.setRef('app.dashboard');
 * directive.setDisabled(true);
 * ```
 *
 * @see {@link DbxAnchor} for the abstract base class this implements
 * @see {@link anchorTypeForAnchor} for anchor type resolution logic
 */
@Directive()
export class AbstractDbxAnchorDirective<T extends ClickableAnchor = ClickableAnchor> implements DbxAnchor {
  /** Model input for the segue ref or router link to navigate to. */
  readonly ref = model<Maybe<SegueRefOrSegueRefRouterLink>>();

  /** Model input for the full anchor configuration object. */
  readonly anchor = model<Maybe<T>>();
  /** Model input for externally controlling the disabled state. */
  readonly disabled = model<Maybe<boolean>>();
  /** Model input for externally controlling the selected state. */
  readonly selected = model<Maybe<boolean>>();

  /** Computed anchor that merges the `ref` input with the `anchor` input, preferring `ref` when set. */
  readonly anchorSignal = computed(() => {
    const ref = this.ref();
    const anchor = this.anchor();

    let result: Maybe<T> = anchor;

    if (ref != null) {
      result = asSegueRef(ref) as T;
    }

    return result;
  });

  /** Computed selected state that combines the `selected` input with the anchor's own `selected` property. */
  readonly selectedSignal = computed(() => {
    const selected = this.selected();
    const anchor = this.anchorSignal();

    return selected || anchor?.selected;
  });

  /** Computed {@link ClickableAnchorType} derived from the current anchor and disabled state. */
  readonly typeSignal = computed(() => {
    const anchor = this.anchorSignal();
    const disabled = this.disabled();
    return anchorTypeForAnchor(anchor, disabled);
  });

  /** Computed disabled state that combines the `disabled` input with the anchor's own `disabled` property. */
  readonly disabledSignal = computed(() => {
    const disabled = this.disabled();
    const anchor = this.anchorSignal();

    return disabled || anchor?.disabled;
  });

  /** Computed URL extracted from the current anchor's `url` property. */
  readonly urlSignal = computed(() => this.anchorSignal()?.url);
  /** Computed target (e.g., `_blank`) extracted from the current anchor's `target` property. */
  readonly targetSignal = computed(() => this.anchorSignal()?.target);

  readonly anchor$: Observable<Maybe<T>> = toObservable(this.anchorSignal);
  readonly disabled$: Observable<Maybe<boolean>> = toObservable(this.disabledSignal);
  readonly selected$: Observable<Maybe<boolean>> = toObservable(this.selectedSignal);
  readonly type$: Observable<ClickableAnchorType> = toObservable(this.typeSignal);

  // MARK: Accessors
  /** Sets the segue ref or router link for this anchor. */
  setRef(ref: Maybe<SegueRefOrSegueRefRouterLink>) {
    this.ref.set(ref);
  }

  /** Sets the full anchor configuration object. */
  setAnchor(anchor: Maybe<T>) {
    this.anchor.set(anchor);
  }

  /** Sets the external disabled state override. */
  setDisabled(disabled: Maybe<boolean>) {
    this.disabled.set(disabled);
  }

  /** Sets the external selected state override. */
  setSelected(selected: Maybe<boolean>) {
    this.selected.set(selected);
  }
}
