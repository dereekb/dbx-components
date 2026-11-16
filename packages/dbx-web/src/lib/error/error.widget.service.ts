import { Service, type Type } from '@angular/core';
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
 * App-wide registry that maps an error code to custom error widget views.
 *
 * Register an entry per error code to change how that error renders:
 * - `errorComponentClass` is the inline view rendered inside `<dbx-error>` in place of the default message.
 * - `widgetComponentClass` is the popover/details view opened from `<dbx-error>`.
 *
 * Widget components extend `AbstractDbxErrorWidgetComponent` to read the error's `code`, `message` and `data`.
 * {@link DbxErrorWidgetService.register} replaces any existing entry with the same error code, so register both classes in one call.
 *
 * The service is provided automatically. Register widgets at startup, for example in `provideAppInitializer()`.
 * The `HTTP_NETWORK_ERROR_CODE` code (set by `convertToServerErrorResponse()` when the server could not be reached) can drive an "offline" view.
 *
 * It has two default widgets:
 *
 * - default: used in cases where an error has been registered by its error code
 * - unknown: used in cases where an error has an error code that has not been registered
 *
 * By default the DbxErrorDefaultErrorWidgetComponent is registered to both the default and unknown error entries.
 *
 * @dbxWebComponent
 * @dbxWebSlug error-widget-service
 * @dbxWebCategory feedback
 * @dbxWebRelated error, error-snackbar-service
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```ts
 * inject(DbxErrorWidgetService).register({ code: HTTP_NETWORK_ERROR_CODE, errorComponentClass: AppOfflineErrorComponent });
 * ```
 *
 * @example
 * ```ts
 * provideAppInitializer(() => {
 *   inject(DbxErrorWidgetService).register({ code: 'NAME_TAKEN', errorComponentClass: NameTakenErrorComponent, widgetComponentClass: NameTakenErrorWidgetComponent });
 * });
 * // NameTakenErrorComponent extends AbstractDbxErrorWidgetComponent to read this.code / this.message / this.data.
 * ```
 */
@Service()
export class DbxErrorWidgetService {
  private readonly _entries = new Map<StringErrorCode, DbxErrorWidgetEntry>();

  constructor() {
    const defaultEntry = { widgetComponentClass: DbxErrorDefaultErrorWidgetComponent };
    this.registerDefaultEntry(defaultEntry);
    this.registerUnknownEntry(defaultEntry);
  }

  /**
   * Registers the widget used for an error whose code has a registered entry without its own `widgetComponentClass`.
   *
   * @param entry - The widget configuration for the default entry.
   * @returns True if the entry was registered.
   */
  registerDefaultEntry(entry: Omit<DbxErrorWidgetEntry, 'errorComponentClass' | 'code'>) {
    return this.register({
      ...entry,
      errorComponentClass: null, // errorComponentClass is not allowed nor used for the default entry
      code: DEFAULT_ERROR_WIDGET_CODE
    });
  }

  /**
   * Registers the widget used for an error whose code has no registered entry.
   *
   * @param entry - The widget configuration for the unknown entry.
   * @returns True if the entry was registered.
   */
  registerUnknownEntry(entry: Omit<DbxErrorWidgetEntry, 'errorComponentClass' | 'code'>) {
    return this.register({
      ...entry,
      errorComponentClass: null, // errorComponentClass is not allowed nor used for the unknown entry
      code: UNKNOWN_ERROR_WIDGET_CODE
    });
  }

  /**
   * Registers the widget views for an error code.
   *
   * @param entry - The error code and the inline and/or popover widget component classes to use for it.
   * @param override - Whether to replace an existing entry with the same code. Defaults to true.
   * @returns True if the entry was registered.
   */
  register(entry: DbxErrorWidgetEntry, override: boolean = true): boolean {
    let registered = false;

    if (override || !this._entries.has(entry.code)) {
      this._entries.set(entry.code, entry);
      registered = true;
    }

    return registered;
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
