import { Injectable, Type } from '@angular/core';
import { Maybe, filterMaybeArrayValues, mapIterable, StringErrorCode } from '@dereekb/util';
import { DbxErrorDefaultErrorWidgetComponent } from './default.error.widget.component';

export const DEFAULT_ERROR_WIDGET_CODE = 'DEFAULT_ERROR_WIDGET';
export const UNKNOWN_ERROR_WIDGET_CODE = 'UNKNOWN_ERROR_WIDGET';

export interface DbxErrorWidgetEntry {
  /**
   * Error code to respond to.
   */
  readonly code: StringErrorCode;
  /**
   * Error widget component class to use.
   *
   * @deprecated use `widgetComponentClass` instead.
   */
  readonly componentClass?: Maybe<Type<unknown>>;
  /**
   * In-line error widget component class to use.
   *
   * This changes how it appears in dbx-error.
   *
   * If not provided, dbx-error will display the default output.
   */
  readonly errorComponentClass?: Maybe<Type<unknown>>;
  /**
   * Custom popup error widget component class to use.
   *
   * This changes how it appears in the dbx-error-widget-view.
   *
   * If not provided, the widget will display the default entry.
   */
  readonly widgetComponentClass?: Maybe<Type<unknown>>;
}

export type DbxErrorWidgetEntryWithPopupComponentClass = Omit<DbxErrorWidgetEntry, 'popupComponentClass'> & { popupComponentClass: Type<unknown> };

/**
 * Service used to register error widgets.
 *
 * It has two default widgets:
 *
 * - default: used in cases where an error has been registered by its error code
 * - unknown: used in cases where an error has an error code that has not been registered
 *
 * By default the DbxErrorDefaultErrorWidgetComponent is registered to both the default and unknown error entries.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxErrorWidgetService {
  private readonly _entries = new Map<StringErrorCode, DbxErrorWidgetEntry>();

  constructor() {
    const defaultEntry = { widgetComponentClass: DbxErrorDefaultErrorWidgetComponent };
    this.registerDefaultEntry(defaultEntry);
    this.registerUnknownEntry(defaultEntry);
  }

  registerDefaultEntry(entry: Omit<DbxErrorWidgetEntry, 'errorComponentClass' | 'code'>) {
    return this.register({
      ...entry,
      errorComponentClass: null, // errorComponentClass is not allowed nor used for the default entry
      code: DEFAULT_ERROR_WIDGET_CODE
    });
  }

  registerUnknownEntry(entry: Omit<DbxErrorWidgetEntry, 'errorComponentClass' | 'code'>) {
    return this.register({
      ...entry,
      errorComponentClass: null, // errorComponentClass is not allowed nor used for the unknown entry
      code: UNKNOWN_ERROR_WIDGET_CODE
    });
  }

  register(entry: DbxErrorWidgetEntry, override: boolean = true): boolean {
    if (override || !this._entries.has(entry.code)) {
      this._entries.set(entry.code, {
        ...entry,
        widgetComponentClass: entry.widgetComponentClass ?? entry.componentClass
      });
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

  getUnknownErrorWidgetEntry(): Maybe<DbxErrorWidgetEntry> {
    return this.getErrorWidgetEntry(UNKNOWN_ERROR_WIDGET_CODE);
  }

  getErrorWidgetEntry(code: StringErrorCode): Maybe<DbxErrorWidgetEntry> {
    return this._entries.get(code);
  }

  getErrorWidgetEntries(codes: Iterable<StringErrorCode>): DbxErrorWidgetEntry[] {
    return filterMaybeArrayValues(mapIterable(codes ?? [], (x) => this._entries.get(x)));
  }
}
