import { iterableToArray } from '@dereekb/util';
import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { DbxWidgetEntry, DbxWidgetType } from '@dereekb/dbx-web';

/**
 * Default providers to inject.
 */
export const DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN = new InjectionToken('DefaultDbxFirebaseDevelopmentWidgetEntries');

export interface DbxFirebaseDevelopmentWidgetEntry {
  readonly label?: string;
  /**
   * Widget entry for this provider.
   */
  readonly widget: DbxWidgetEntry;
}

/**
 * Service used for registering widgets used for development.
 *
 * Default providers can be configured by the DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN injectable value.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseDevelopmentWidgetService {
  private _entries = new Map<DbxWidgetType, DbxFirebaseDevelopmentWidgetEntry>();

  constructor(@Optional() @Inject(DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN) defaultEntries: DbxFirebaseDevelopmentWidgetEntry[]) {
    if (defaultEntries) {
      defaultEntries.forEach((x) => this.register(x, false));
    }
  }

  /**
   * Used to register a provider. If a provider is already registered, this will override it by default.
   *
   * @param provider
   * @param override
   */
  register(provider: DbxFirebaseDevelopmentWidgetEntry, override: boolean = true): boolean {
    const type = provider.widget.type;

    if (override || !this._entries.has(type)) {
      this._entries.set(type, provider);
      return true;
    } else {
      return false;
    }
  }

  getEntryWidgetIdentifiers(): DbxWidgetType[] {
    return Array.from(this._entries.keys());
  }

  getEntries(): DbxFirebaseDevelopmentWidgetEntry[] {
    return iterableToArray(this._entries.values());
  }
}
