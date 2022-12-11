import { Injectable, Type } from '@angular/core';
import { Maybe, filterMaybeValues, mapIterable, StringErrorCode } from '@dereekb/util';
import { DbxErrorDefaultErrorWidgetComponent } from './default.error.widget.component';

export const DEFAULT_ERROR_WIDGET_CODE = 'DEFAULT_ERROR_WIDGET';

export interface DbxErrorWidgetEntry {
  /**
   * Error code to respond to.
   */
  readonly code: StringErrorCode;
  /**
   * Error widget component class to use.
   */
  readonly componentClass: Type<unknown>;
}

/**
 * Service used to register error widgets.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxErrorWidgetService {
  private _entries = new Map<StringErrorCode, DbxErrorWidgetEntry>();

  constructor() {
    this.registerDefaultEntry({ componentClass: DbxErrorDefaultErrorWidgetComponent });
  }

  registerDefaultEntry(entry: Omit<DbxErrorWidgetEntry, 'code'>) {
    return this.register({
      ...entry,
      code: DEFAULT_ERROR_WIDGET_CODE
    });
  }

  register(entry: DbxErrorWidgetEntry, override: boolean = true): boolean {
    if (override || !this._entries.has(entry.code)) {
      this._entries.set(entry.code, entry);
      return true;
    } else {
      return false;
    }
  }

  // MARK: Get
  getErrorWidgetIdentifiers(): StringErrorCode[] {
    return Array.from(this._entries.keys());
  }

  getDefaultErrorWidgetEntry(): Maybe<DbxErrorWidgetEntry> {
    return this.getErrorWidgetEntry(DEFAULT_ERROR_WIDGET_CODE);
  }

  getErrorWidgetEntry(code: StringErrorCode): Maybe<DbxErrorWidgetEntry> {
    return this._entries.get(code);
  }

  getErrorWidgetEntries(codes: Iterable<StringErrorCode>): DbxErrorWidgetEntry[] {
    return filterMaybeValues(mapIterable(codes ?? [], (x) => this._entries.get(x)));
  }
}
