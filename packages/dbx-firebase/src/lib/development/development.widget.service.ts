import { iterableToArray } from '@dereekb/util';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { DbxWidgetService, type DbxWidgetType } from '@dereekb/dbx-web';
import { type DbxFirebaseDevelopmentWidgetEntry } from './development.widget';

/**
 * Default providers to inject.
 */
export const DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN = new InjectionToken<DbxFirebaseDevelopmentWidgetEntry[]>('DefaultDbxFirebaseDevelopmentWidgetEntries');

/**
 * Service used for registering widgets used for development.
 *
 * Default providers can be configured by the DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN injectable value.
 */
@Injectable()
export class DbxFirebaseDevelopmentWidgetService {
  readonly dbxWidgetService = inject(DbxWidgetService);

  private readonly _entries = new Map<DbxWidgetType, DbxFirebaseDevelopmentWidgetEntry>();
  private readonly _defaultEntries = inject(DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN, { optional: true });

  constructor() {
    if (this._defaultEntries) {
      this._defaultEntries.forEach((x) => this.register(x, false));
    }
  }

  /**
   * Used to register a provider. If a provider is already registered, this will override it by default.
   *
   * @param provider - The development widget entry to register.
   * @param override - Whether to override an existing entry of the same type. Defaults to true.
   * @returns True if the entry was registered, false if it already existed and override was false.
   */
  register(provider: DbxFirebaseDevelopmentWidgetEntry, override: boolean = true): boolean {
    const type = provider.widget.type;

    if (override || !this._entries.has(type)) {
      this._entries.set(type, provider);
      this.dbxWidgetService.register(provider.widget, override);
      return true;
    }

    return false;
  }

  getEntryWidgetIdentifiers(): DbxWidgetType[] {
    return [...this._entries.keys()];
  }

  getEntries(): DbxFirebaseDevelopmentWidgetEntry[] {
    return iterableToArray(this._entries.values());
  }
}
