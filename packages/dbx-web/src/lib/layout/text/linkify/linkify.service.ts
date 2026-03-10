import { inject, Injectable } from '@angular/core';
import { DEFAULT_DBX_LINKIFY_STRING_TYPE, type DbxLinkifyStringType, type DbxLinkifyStringOptions } from './linkify';
import { type ArrayOrValue, type Maybe, useIterableOrValue } from '@dereekb/util';

/**
 * A registered linkify configuration keyed by type, holding the linkify-string options for that type.
 */
export interface DbxLinkifyServiceEntry {
  readonly type: DbxLinkifyStringType;
  readonly options: DbxLinkifyStringOptions;
}

/**
 * Default entry type without the type field.
 *
 * Used for registerDefaultEntry() and DbxLinkifyServiceConfig.
 */
export type DbxLinkifyServiceDefaultEntry = Omit<DbxLinkifyServiceEntry, 'type'>;

/**
 * Configuration provided in the root module for configuring entries.
 */
export abstract class DbxLinkifyServiceConfig {
  /**
   * Optional default entry override.
   */
  abstract defaultEntry?: Maybe<DbxLinkifyServiceDefaultEntry>;
  /**
   * Entries to register.
   */
  abstract entries?: Maybe<ArrayOrValue<DbxLinkifyServiceEntry>>;
}

/**
 * Service used to register and retrieve linkify configurations by type.
 *
 * It has a default entry that is used when no type is specified or the requested type is not found.
 * By default, the default entry uses `{ defaultProtocol: 'https', target: { url: '_blank' } }`.
 *
 * Apps can override the default and register additional types via DbxLinkifyServiceConfig
 * (provided by provideDbxLinkify()) or by calling register()/registerDefaultEntry() directly.
 */
@Injectable({
  providedIn: 'root' // does not need to be strictly provided/configured. Works out of the box.
})
export class DbxLinkifyService {
  private readonly _entries = new Map<DbxLinkifyStringType, DbxLinkifyServiceEntry>();

  constructor() {
    const initialConfig = inject(DbxLinkifyServiceConfig, { optional: true });

    if (initialConfig?.defaultEntry) {
      this.registerDefaultEntry(initialConfig.defaultEntry);
    }

    if (initialConfig?.entries) {
      this.register(initialConfig.entries);
    }

    // If no default was provided, register inline defaults
    if (!this._entries.has(DEFAULT_DBX_LINKIFY_STRING_TYPE)) {
      this.registerDefaultEntry({ options: { defaultProtocol: 'https', target: { url: '_blank' } } });
    }
  }

  /**
   * Registers the default entry.
   *
   * @param entry Entry without the type field
   */
  registerDefaultEntry(entry: DbxLinkifyServiceDefaultEntry): void {
    this._entries.set(DEFAULT_DBX_LINKIFY_STRING_TYPE, {
      ...entry,
      type: DEFAULT_DBX_LINKIFY_STRING_TYPE
    });
  }

  /**
   * Registers one or more entries by type.
   *
   * @param entries One or more entries to register
   * @param override Whether to override existing entries (default: true)
   */
  register(entries: ArrayOrValue<DbxLinkifyServiceEntry>, override: boolean = true): void {
    useIterableOrValue(entries, (entry) => {
      if (override || !this._entries.has(entry.type)) {
        this._entries.set(entry.type, entry);
      }
    });
  }

  // MARK: Get
  /**
   * Returns the default entry.
   */
  getDefaultEntry(): Maybe<DbxLinkifyServiceEntry> {
    return this._entries.get(DEFAULT_DBX_LINKIFY_STRING_TYPE);
  }

  /**
   * Returns the entry for the given type.
   */
  getEntryRegisteredForType(type: DbxLinkifyStringType): Maybe<DbxLinkifyServiceEntry> {
    return this._entries.get(type);
  }

  /**
   * Returns the entry for the given type, or the default type if there is no entry registered or the input type is null/undefined.
   */
  getEntry(type?: Maybe<DbxLinkifyStringType>): Maybe<DbxLinkifyServiceEntry> {
    return type ? this._entries.get(type) : this.getDefaultEntry();
  }
}
