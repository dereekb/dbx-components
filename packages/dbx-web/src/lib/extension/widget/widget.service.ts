import { Injectable, type Type } from '@angular/core';
import { type Maybe, filterMaybeArrayValues, mapIterable } from '@dereekb/util';
import { type DbxWidgetType } from './widget';

/**
 * Maps a widget type identifier to its corresponding Angular component class for rendering by the {@link DbxWidgetService}.
 */
export interface DbxWidgetEntry {
  /**
   * Widget type to respond to.
   */
  readonly type: DbxWidgetType;
  /**
   * Widget component class to use.
   */
  readonly componentClass: Type<unknown>;
}

/**
 * Registry service for widget components. Components are registered by type identifier and resolved by {@link DbxWidgetViewComponent} to render the appropriate widget for a given type/data pair.
 *
 * @example
 * ```typescript
 * widgetService.register({ type: 'my-widget', componentClass: MyWidgetComponent });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class DbxWidgetService {
  private readonly _entries = new Map<DbxWidgetType, DbxWidgetEntry>();

  /**
   * Used to register an entry. If an entry with the same type is already registered, this will override it by default.
   *
   * @param entry - The widget entry mapping a type identifier to its component class
   * @param override - Whether to replace an existing entry with the same type. Defaults to true.
   * @returns True if the entry was registered, false if an entry with the same type already exists and override is false
   */
  register(entry: DbxWidgetEntry, override: boolean = true): boolean {
    if (override || !this._entries.has(entry.type)) {
      this._entries.set(entry.type, entry);
      return true;
    } else {
      return false;
    }
  }

  // MARK: Get
  getWidgetIdentifiers(): DbxWidgetType[] {
    return [...this._entries.keys()];
  }

  getWidgetEntry(type: DbxWidgetType): Maybe<DbxWidgetEntry> {
    return this._entries.get(type);
  }

  getWidgetEntries(types: Iterable<DbxWidgetType>): DbxWidgetEntry[] {
    return filterMaybeArrayValues(mapIterable(types ?? [], (x) => this._entries.get(x)));
  }
}
