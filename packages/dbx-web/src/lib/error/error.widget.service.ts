import { Injectable, type Type } from '@angular/core';
import { type Maybe, filterMaybeArrayValues, mapIterable, type StringErrorCode } from '@dereekb/util';
import { DbxErrorDefaultErrorWidgetComponent } from './default.error.widget.component';

/**
 * Error code used to identify the default error widget entry in {@link DbxErrorWidgetService}.
 */
export const DEFAULT_ERROR_WIDGET_CODE = 'DEFAULT_ERROR_WIDGET';

/**
 * Error code used to identify the unknown/fallback error widget entry in {@link DbxErrorWidgetService}.
 */
export const UNKNOWN_ERROR_WIDGET_CODE = 'UNKNOWN_ERROR_WIDGET';

/**
 * Registration entry that maps an error code to one or more widget component classes for rendering that error.
 */
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

/**
 * A {@link DbxErrorWidgetEntry} that is guaranteed to have a `popupComponentClass` defined.
 */
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
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        widgetComponentClass: entry.widgetComponentClass ?? entry.componentClass
      });
      return true;
    } else {
      return false;
    }
  }

  // MARK: Get
  getErrorWidgetIdentifiers(): StringErrorCode[] {
    return [...this._entries.keys()];
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
