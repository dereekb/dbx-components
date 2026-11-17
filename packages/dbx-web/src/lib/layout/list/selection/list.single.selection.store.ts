import { Injectable, Injector, Optional, type Provider, SkipSelf, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type Maybe } from '@dereekb/util';
import { distinctUntilChanged, map, type Observable } from 'rxjs';
import { type DbxListSingleSelectionEntry } from './list.single.selection';

/**
 * State of a {@link DbxListSingleSelectionStore}.
 */
export interface DbxListSingleSelectionStoreState<T> {
  /**
   * The currently selected entry.
   */
  readonly selected?: Maybe<DbxListSingleSelectionEntry<T>>;
  /**
   * The entry that was selected before the current selection.
   */
  readonly previous?: Maybe<DbxListSingleSelectionEntry<T>>;
  /**
   * Whether toggling the selected entry deselects it.
   */
  readonly allowDeselect: boolean;
}

/**
 * Component store that tracks a single selected list item and the item that was selected before it.
 *
 * Items are identified by their list item key. Used by {@link DbxListItemSingleSelectionModifierDirective}; a page can
 * provide its own instance above the list to share the selection with other components, such as a detail panel.
 *
 * @example
 * ```ts
 * readonly selectionStore = inject(DbxListSingleSelectionStore<MyItem>);
 * readonly selectedSignal = this.selectionStore.selectedValueSignal;
 * ```
 */
@Injectable()
export class DbxListSingleSelectionStore<T = unknown> extends ComponentStore<DbxListSingleSelectionStoreState<T>> {
  constructor() {
    super({ allowDeselect: false });
  }

  // MARK: Accessors
  readonly selected$: Observable<Maybe<DbxListSingleSelectionEntry<T>>> = this.select((x) => x.selected);
  readonly selectedKey$: Observable<Maybe<string>> = this.selected$.pipe(
    map((x) => x?.key),
    distinctUntilChanged()
  );
  readonly selectedValue$: Observable<Maybe<T>> = this.select((x) => x.selected?.value);
  readonly previous$: Observable<Maybe<DbxListSingleSelectionEntry<T>>> = this.select((x) => x.previous);
  readonly previousValue$: Observable<Maybe<T>> = this.select((x) => x.previous?.value);
  readonly hasSelection$: Observable<boolean> = this.select((x) => x.selected != null);
  readonly allowDeselect$: Observable<boolean> = this.select((x) => x.allowDeselect);

  readonly selectedSignal = this.selectSignal((x) => x.selected);
  readonly selectedKeySignal = this.selectSignal((x) => x.selected?.key);
  readonly selectedValueSignal = this.selectSignal((x) => x.selected?.value);
  readonly previousSignal = this.selectSignal((x) => x.previous);
  readonly previousValueSignal = this.selectSignal((x) => x.previous?.value);
  readonly hasSelectionSignal = this.selectSignal((x) => x.selected != null);

  // MARK: State Changes
  /**
   * Selects the entry. Re-selecting the selected key does nothing; otherwise the current selection becomes the previous selection.
   */
  readonly selectEntry = this.updater((state, entry: DbxListSingleSelectionEntry<T>) => dbxListSingleSelectionStoreSelect(state, entry));

  /**
   * Selects the entry, or deselects it when it is already selected and deselecting is allowed.
   */
  readonly toggle = this.updater((state, entry: DbxListSingleSelectionEntry<T>) => {
    let result: DbxListSingleSelectionStoreState<T>;

    if (state.selected?.key === entry.key) {
      result = state.allowDeselect ? dbxListSingleSelectionStoreClear(state) : state;
    } else {
      result = dbxListSingleSelectionStoreSelect(state, entry);
    }

    return result;
  });

  /**
   * Clears the selection. The cleared entry becomes the previous selection.
   */
  readonly clear = this.updater((state) => dbxListSingleSelectionStoreClear(state));

  /**
   * Clears the selection only if the selected entry has the given key. Useful when an item is removed from the list.
   */
  readonly clearIfKey = this.updater((state, key: string) => (state.selected?.key === key ? dbxListSingleSelectionStoreClear(state) : state));

  /**
   * Sets whether toggling the selected entry deselects it.
   */
  readonly setAllowDeselect = this.updater((state, allowDeselect: Maybe<boolean>) => ({ ...state, allowDeselect: allowDeselect ?? false }));
}

function dbxListSingleSelectionStoreSelect<T>(state: DbxListSingleSelectionStoreState<T>, entry: DbxListSingleSelectionEntry<T>): DbxListSingleSelectionStoreState<T> {
  return state.selected?.key === entry.key ? state : { ...state, selected: entry, previous: state.selected ?? state.previous };
}

function dbxListSingleSelectionStoreClear<T>(state: DbxListSingleSelectionStoreState<T>): DbxListSingleSelectionStoreState<T> {
  return state.selected == null ? state : { ...state, selected: undefined, previous: state.selected };
}

/**
 * Provides a {@link DbxListSingleSelectionStore}, re-using one from a parent injector when available.
 *
 * Lets a page provide the store above a list to share the selection, while a list without one gets its own store.
 *
 * @returns The provider.
 */
export function provideDbxListSingleSelectionStoreIfParentIsUnavailable(): Provider {
  return {
    provide: DbxListSingleSelectionStore,
    useFactory: (parentStore?: Maybe<DbxListSingleSelectionStore>) => {
      let store = parentStore;

      if (!store) {
        const parentInjector = inject(Injector);
        const injector = Injector.create({ providers: [{ provide: DbxListSingleSelectionStore }], parent: parentInjector });
        store = injector.get(DbxListSingleSelectionStore);
      }

      return store;
    },
    deps: [[new Optional(), new SkipSelf(), DbxListSingleSelectionStore]]
  };
}
