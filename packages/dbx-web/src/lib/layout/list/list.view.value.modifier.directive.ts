import { BehaviorSubject, map, Observable, shareReplay, combineLatest } from 'rxjs';
import { Directive, Input, OnDestroy, OnInit } from "@angular/core";
import { DbxValueListItem } from "./list.view.value";
import { addModifiers, ArrayOrValue, combineMaps, Maybe, Modifier, ModifierMap, removeModifiers } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxValueListItemModifier, ProvideDbxValueListViewModifier } from './list.view.value.modifier';

/**
 * DbxValueListViewModifier implementation
 */
@Directive({
  'selector': '[dbxListItemModifier]',
  providers: ProvideDbxValueListViewModifier(DbxValueListItemModifierDirective)
})
export class DbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements DbxValueListItemModifier<T, I>, OnDestroy {

  private _modifiers = new BehaviorSubject<Maybe<ModifierMap<I>>>(undefined);
  private _inputModifiers = new BehaviorSubject<Maybe<ArrayOrValue<Modifier<I>>>>(undefined);

  readonly modifiers$ = combineLatest([this._modifiers, this._inputModifiers]).pipe(
    map(([modifiers, inputModifiers]) => {
      return combineMaps(modifiers, (inputModifiers) ? addModifiers(inputModifiers) : undefined);
    }),
    shareReplay(1)
  );

  constructor() { }

  ngOnDestroy(): void {
    this._modifiers.complete();
  }

  // MARK: Modifiers
  addModifiers(modifiers: ArrayOrValue<Modifier<I>>): void {
    this._modifiers.next(addModifiers(modifiers, this._modifiers.value));
  }

  removeModifiers(modifiers: ArrayOrValue<Modifier<I>>): void {
    this._modifiers.next(removeModifiers(modifiers, this._modifiers.value));
  }

  // MARK: Input Modifiers
  @Input('dbxListItemModifier')
  set inputModifiers(inputModifiers: Maybe<ArrayOrValue<Modifier<I>>>) {
    this._inputModifiers.next(inputModifiers);
  }

}

/**
 * Abstract directive used for managing modifyers for a DbxValueListView.
 */
@Directive()
export abstract class AbstractDbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements OnInit, OnDestroy {

  abstract readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<I>>>>;

  private _linkedModifiers: Maybe<ArrayOrValue<Modifier<I>>>;
  private _modifiersSub = new SubscriptionObject();

  constructor(readonly dbxValueListItemModifier: DbxValueListItemModifier<T, I>) { }

  ngOnInit(): void {
    this._modifiersSub.subscription = this.modifiers$.subscribe((modifiers) => {
      this._linkModifiers(modifiers);
    });
  }

  ngOnDestroy(): void {
    this._unlinkModifiers();
  }

  private _linkModifiers(modifiers: Maybe<ArrayOrValue<Modifier<I>>>) {
    this._unlinkModifiers();

    if (modifiers) {
      this.dbxValueListItemModifier.addModifiers(modifiers);
      this._linkedModifiers = modifiers;
    }
  }

  private _unlinkModifiers() {
    if (this._linkedModifiers) {
      this.dbxValueListItemModifier.removeModifiers(this._linkedModifiers);
      this._linkedModifiers = undefined;
    }
  }

}
