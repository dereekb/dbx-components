import { BehaviorSubject, map, Observable, shareReplay, combineLatest, distinctUntilChanged } from 'rxjs';
import { Directive, OnDestroy, inject, input } from '@angular/core';
import { DbxValueListItem } from './list.view.value';
import { addModifiers, ArrayOrValue, combineMaps, Maybe, Modifier, ModifierMap, removeModifiers } from '@dereekb/util';
import { MaybeObservableOrValue, maybeValueFromObservableOrValue, SubscriptionObject } from '@dereekb/rxjs';
import { DbxValueListItemModifier, provideDbxValueListViewModifier } from './list.view.value.modifier';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * DbxValueListViewModifier implementation
 */
@Directive({
  selector: 'dbxListItemModifier,[dbxListItemModifier]',
  providers: provideDbxValueListViewModifier(DbxValueListItemModifierDirective),
  standalone: true
})
export class DbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements DbxValueListItemModifier<T, I>, OnDestroy {
  readonly inputModifiers = input<Maybe<ArrayOrValue<Modifier<I>>>, Maybe<string | ArrayOrValue<Modifier<I>>>>(undefined, { alias: 'dbxListItemModifier', transform: (x) => (typeof x === 'string' ? undefined : x) });

  private readonly _additionalModifiers = new BehaviorSubject<Maybe<ModifierMap<I>>>(undefined);

  readonly modifiers$ = combineLatest([this._additionalModifiers, toObservable(this.inputModifiers)]).pipe(
    map(([modifiers, inputModifiers]) => {
      return combineMaps(modifiers, inputModifiers ? addModifiers(inputModifiers) : undefined);
    }),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this._additionalModifiers.complete();
  }

  // MARK: Modifiers
  addModifiers(modifiers: ArrayOrValue<Modifier<I>>): void {
    this._additionalModifiers.next(addModifiers(modifiers, this._additionalModifiers.value));
  }

  removeModifiers(modifiers: ArrayOrValue<Modifier<I>>): void {
    this._additionalModifiers.next(removeModifiers(modifiers, this._additionalModifiers.value));
  }
}

/**
 * Abstract directive used for managing modifyers for a DbxValueListView.
 */
@Directive()
export abstract class AbstractDbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements OnDestroy {
  readonly dbxValueListItemModifier = inject(DbxValueListItemModifier<T, I>);

  private _currentLinkedModifiers: Maybe<ArrayOrValue<Modifier<I>>>;

  private readonly _modifiers = new BehaviorSubject<MaybeObservableOrValue<ArrayOrValue<Modifier<I>>>>(undefined);
  readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<I>>>> = this._modifiers.pipe(maybeValueFromObservableOrValue(), distinctUntilChanged());

  private readonly _modifiersSub = new SubscriptionObject(
    this.modifiers$.subscribe((modifiers) => {
      this._linkModifiers(modifiers);
    })
  );

  ngOnDestroy(): void {
    this._modifiersSub.destroy();
    this._unlinkModifiers();
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
