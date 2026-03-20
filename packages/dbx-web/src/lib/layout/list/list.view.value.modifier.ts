import { forwardRef, type Provider, type Type } from '@angular/core';
import { type ArrayOrValue, modifier, type Modifier, type ModifierFunction, type ModifierMap } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxValueListItem } from './list.view.value';

// MARK: ValueListView
/**
 * Abstract class and injection token for managing modifiers on value list items. Modifiers allow transforming
 * list item properties (e.g., disabling ripple, marking as selected) before rendering.
 */
export abstract class DbxValueListItemModifier<T = unknown, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  abstract readonly modifiers$: Observable<ModifierMap<I>>;
  abstract addModifiers(modifiers: ArrayOrValue<Modifier<I>>): void;
  abstract removeModifiers(modifiers: ArrayOrValue<Modifier<I>>): void;
}

/**
 * Registers a directive as a {@link DbxValueListItemModifier} provider for dependency injection.
 *
 * @example
 * ```ts
 * @Directive({
 *   providers: provideDbxValueListViewModifier(MyModifierDirective)
 * })
 * export class MyModifierDirective extends DbxValueListItemModifier<MyItem> { ... }
 * ```
 *
 * @param sourceType - the directive class to register as the DbxValueListItemModifier provider
 * @returns an array of Angular providers that wire up the directive as a DbxValueListItemModifier
 */
export function provideDbxValueListViewModifier<V extends DbxValueListItemModifier>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxValueListItemModifier,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

// MARK: Utility
/**
 * A {@link Modifier} specialized for {@link DbxValueListItem} instances.
 */
export type ListItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> = Modifier<I>;

/**
 * Creates a {@link ListItemModifier} with the given key and modification function.
 *
 * @example
 * ```ts
 * const highlightModifier = listItemModifier<MyItem>('highlight', (item) => {
 *   item.selected = item.itemValue.isImportant;
 * });
 * ```
 *
 * @param key - a unique string identifier for this modifier in the modifier map
 * @param modify - the function that mutates list item properties during rendering
 * @returns a new ListItemModifier with the given key and modification function
 */
export function listItemModifier<T, I extends DbxValueListItem<T> = DbxValueListItem<T>>(key: string, modify: ModifierFunction<I>): ListItemModifier<T, I> {
  return modifier(key, modify);
}
