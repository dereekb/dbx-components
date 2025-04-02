import { BehaviorSubject, map, Observable, shareReplay, combineLatest } from 'rxjs';
import { Directive, Input, OnDestroy, OnInit, inject, input } from '@angular/core';
import { DbxValueListItem } from './list.view.value';
import { addModifiers, ArrayOrValue, combineMaps, Maybe, Modifier, ModifierMap, removeModifiers } from '@dereekb/util';
import { asObservable, SubscriptionObject } from '@dereekb/rxjs';
import { DbxValueListItemModifier, provideDbxValueListViewModifier } from './list.view.value.modifier';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * DbxValueListViewModifier implementation
 */
@Directive({
  selector: '[dbxListItemModifier]',
  providers: provideDbxValueListViewModifier(DbxValueListItemModifierDirective),
  standalone: true
})
export class DbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements DbxValueListItemModifier<T, I>, OnDestroy {
  readonly inputModifiers = input<Maybe<ArrayOrValue<Modifier<I>>>>(undefined, {
    alias: 'dbxListItemModifier'
  });

  private readonly _modifiers = new BehaviorSubject<Maybe<ModifierMap<I>>>(undefined);

  readonly modifiers$ = combineLatest([this._modifiers, toObservable(this.inputModifiers)]).pipe(
    map(([modifiers, inputModifiers]) => {
      return combineMaps(modifiers, inputModifiers ? addModifiers(inputModifiers) : undefined);
    }),
    shareReplay(1)
  );

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
}

/**
 * Abstract directive used for managing modifyers for a DbxValueListView.
 */
@Directive()
export abstract class AbstractDbxValueListItemModifierDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements OnInit, OnDestroy {
  readonly dbxValueListItemModifier = inject(DbxValueListItemModifier<T, I>);

  abstract readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<I>>>>;

  private _linkedModifiers: Maybe<ArrayOrValue<Modifier<I>>>;
  private readonly _modifiersSub = new SubscriptionObject();

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
