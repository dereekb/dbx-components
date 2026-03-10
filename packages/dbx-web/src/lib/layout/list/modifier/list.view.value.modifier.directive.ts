import { BehaviorSubject, map, type Observable, shareReplay, combineLatest, distinctUntilChanged } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { type DbxValueListItem } from '../list.view.value';
import { addModifiers, type ArrayOrValue, combineMaps, type Maybe, type Modifier, type ModifierMap, removeModifiers } from '@dereekb/util';
import { type MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { DbxValueListItemModifier, provideDbxValueListViewModifier } from '../list.view.value.modifier';
import { toObservable } from '@angular/core/rxjs-interop';
import { clean, cleanSubscription, completeOnDestroy, transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';

/**
 * Directive that implements {@link DbxValueListItemModifier}, managing a collection of item modifiers
 * that transform list items before rendering. Accepts modifiers via the `dbxListItemModifier` input or programmatically.
 *
 * @example
 * ```html
 * <dbx-list-view [dbxListItemModifier]="myModifiers" [config]="listViewConfig"></dbx-list-view>
 * ```
 */
@Directive({
  selector: 'dbxListItemModifier,[dbxListItemModifier]',
  providers: provideDbxValueListViewModifier(DbxValueListItemModifierDirective),
  standalone: true
})
export class DbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements DbxValueListItemModifier<T, I> {
  readonly inputModifiers = input<Maybe<ArrayOrValue<Modifier<I>>>, Maybe<'' | ArrayOrValue<Modifier<I>>>>(undefined, { alias: 'dbxListItemModifier', transform: transformEmptyStringInputToUndefined });

  private readonly _additionalModifiers = completeOnDestroy(new BehaviorSubject<Maybe<ModifierMap<I>>>(undefined));

  readonly modifiers$ = combineLatest([this._additionalModifiers, toObservable(this.inputModifiers)]).pipe(
    map(([modifiers, inputModifiers]) => {
      return combineMaps(modifiers, inputModifiers ? addModifiers(inputModifiers) : undefined);
    }),
    shareReplay(1)
  );

  // MARK: Modifiers
  addModifiers(modifiers: ArrayOrValue<Modifier<I>>): void {
    this._additionalModifiers.next(addModifiers(modifiers, this._additionalModifiers.value));
  }

  removeModifiers(modifiers: ArrayOrValue<Modifier<I>>): void {
    this._additionalModifiers.next(removeModifiers(modifiers, this._additionalModifiers.value));
  }
}

/**
 * Abstract base directive for creating custom list item modifiers. Automatically registers and unregisters
 * its modifiers with the parent {@link DbxValueListItemModifier}. Extend this to build reusable modifier directives.
 */
@Directive()
export abstract class AbstractDbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxValueListItemModifier = inject(DbxValueListItemModifier<T, I>);

  private _currentLinkedModifiers: Maybe<ArrayOrValue<Modifier<I>>>;

  private readonly _modifiers = completeOnDestroy(new BehaviorSubject<MaybeObservableOrValue<ArrayOrValue<Modifier<I>>>>(undefined));
  readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<I>>>> = this._modifiers.pipe(maybeValueFromObservableOrValue(), distinctUntilChanged());

  constructor() {
    cleanSubscription(
      this.modifiers$.subscribe((modifiers) => {
        this._linkModifiers(modifiers);
      })
    );

    clean(() => this._unlinkModifiers());
  }

  setModifiers(modifiers: MaybeObservableOrValue<ArrayOrValue<Modifier<I>>>) {
    this._modifiers.next(modifiers);
  }

  private _linkModifiers(modifiers: Maybe<ArrayOrValue<Modifier<I>>>) {
    this._unlinkModifiers();

    if (modifiers) {
      this.dbxValueListItemModifier.addModifiers(modifiers);
      this._currentLinkedModifiers = modifiers;
    }
  }

  private _unlinkModifiers() {
    if (this._currentLinkedModifiers) {
      this.dbxValueListItemModifier.removeModifiers(this._currentLinkedModifiers);
      this._currentLinkedModifiers = undefined;
    }
  }
}
