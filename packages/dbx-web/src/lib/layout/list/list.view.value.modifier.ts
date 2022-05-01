import { forwardRef, Provider, Type } from "@angular/core";
import { ArrayOrValue, modifier, Modifier, ModifierFunction, ModifierMap } from "@dereekb/util";
import { Observable } from "rxjs";
import { DbxValueListItem } from "./list.view.value";

// MARK: ValueListView
export abstract class DbxValueListItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {

  readonly abstract modifiers$: Observable<ModifierMap<I>>;

  abstract addModifiers(modifiers: ArrayOrValue<Modifier<I>>): void;
  abstract removeModifiers(modifiers: ArrayOrValue<Modifier<I>>): void;

}

export function ProvideDbxValueListViewModifier<V extends DbxValueListItemModifier<any>>(sourceType: Type<V>): Provider[] {
  return [{
    provide: DbxValueListItemModifier,
    useExisting: forwardRef(() => sourceType)
  }];
}

// MARK: Utility
export type ListItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> = Modifier<I>;

export function listItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>>(key: string, modify: ModifierFunction<I>): ListItemModifier<T, I> {
  return modifier(key, modify);
}
