import { Injectable, Type } from '@angular/core';
import { Maybe, filterMaybeArrayValues, mapIterable } from '@dereekb/util';
import { DbxWidgetType } from './widget';

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
 * Service used to register widgets.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxWidgetService {
  private _entries = new Map<DbxWidgetType, DbxWidgetEntry>();

  /**
   * Used to register an entry. If an entry with the same type is already registered, this will override it by default.
   *
   * @param entry
   * @param override
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
    return Array.from(this._entries.keys());
  }

  getWidgetEntry(type: DbxWidgetType): Maybe<DbxWidgetEntry> {
    return this._entries.get(type);
  }

  getWidgetEntries(types: Iterable<DbxWidgetType>): DbxWidgetEntry[] {
    return filterMaybeArrayValues(mapIterable(types ?? [], (x) => this._entries.get(x)));
  }
}
