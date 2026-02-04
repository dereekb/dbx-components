import { Inject, Injectable, Optional, Type } from '@angular/core';
import { ArrayOrValue, Maybe, asArray, filterMaybeArrayValues, mapIterable } from '@dereekb/util';
import { FirestoreModelIdentity } from '@dereekb/firebase';

export interface DbxFirebaseModelEntitiesWidgetEntry {
  /**
   * Widget type to respond to.
   */
  readonly identity: FirestoreModelIdentity;
  /**
   * Widget component class to use.
   */
  readonly componentClass: Type<unknown>;
}

/**
 * Configuration provided in the root module for configuring entries.
 */
export abstract class DbxFirebaseModelEntitiesWidgetServiceConfig {
  /**
   * Entries to register.
   */
  abstract entries: DbxFirebaseModelEntitiesWidgetEntry[];
}

/**
 * Service used to register widgets used for model entities.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseModelEntitiesWidgetService {
  private readonly _entries = new Map<FirestoreModelIdentity, DbxFirebaseModelEntitiesWidgetEntry>();

  constructor(@Optional() @Inject(DbxFirebaseModelEntitiesWidgetServiceConfig) initialConfig?: DbxFirebaseModelEntitiesWidgetServiceConfig) {
    if (initialConfig?.entries) {
      this.register(initialConfig.entries);
    }
  }

  /**
   * Used to register one or more entries.
   *
   * If an entry with the same identity is already registered, this will override it by default.
   *
   * @param entries
   * @param override
   */
  register(entries: ArrayOrValue<DbxFirebaseModelEntitiesWidgetEntry>, override: boolean = true): void {
    const entriesArray = asArray(entries);

    entriesArray.forEach((entry) => {
      if (override || !this._entries.has(entry.identity)) {
        this._entries.set(entry.identity, entry);
      }
    });
  }

  // MARK: Get
  getAllRegisteredWidgetIdentities(): FirestoreModelIdentity[] {
    return Array.from(this._entries.keys());
  }

  getWidgetEntry(identity: FirestoreModelIdentity): Maybe<DbxFirebaseModelEntitiesWidgetEntry> {
    return this._entries.get(identity);
  }

  getWidgetEntries(identities: Iterable<FirestoreModelIdentity>): DbxFirebaseModelEntitiesWidgetEntry[] {
    return filterMaybeArrayValues(mapIterable(identities ?? [], (x) => this._entries.get(x)));
  }
}
