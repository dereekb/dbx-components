import { forwardRef, type Provider, type Type } from '@angular/core';
import { type ArrayOrValue, modifier, type Modifier, type ModifierFunction, type ModifierMap } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxValueListItem } from './list.view.value';

// MARK: ValueListView
export abstract class DbxValueListItemModifier<T = unknown, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  abstract readonly modifiers$: Observable<ModifierMap<I>>;
  abstract addModifiers(modifiers: ArrayOrValue<Modifier<I>>): void;
  abstract removeModifiers(modifiers: ArrayOrValue<Modifier<I>>): void;
}

export function provideDbxValueListViewModifier<V extends DbxValueListItemModifier>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxValueListItemModifier,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

// MARK: Utility
export type ListItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> = Modifier<I>;

export function listItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>>(key: string, modify: ModifierFunction<I>): ListItemModifier<T, I> {
  return modifier(key, modify);
}
