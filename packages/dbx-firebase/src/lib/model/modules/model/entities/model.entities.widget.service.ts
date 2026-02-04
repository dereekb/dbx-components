import { Inject, Injectable, Optional, Type } from '@angular/core';
import { ArrayOrValue, Maybe, asArray, filterMaybeArrayValues, mapIterable } from '@dereekb/util';
import { FirestoreModelIdentity } from '@dereekb/firebase';

export interface DbxFirebaseModelEntitiesWidgetEntry {
  /**
   * Widget type to respond to.
   */
  readonly identity: FirestoreModelIdentity;
  /**
   * Widget component that is specific to this entity.
   */
  readonly entityComponentClass?: Maybe<Type<unknown>>;
  /**
   * Overrides the "common" widget component used for all entities.
   */
  readonly commonComponentClass?: Maybe<Type<unknown>>;
  /**
   * Optional widget component that is specific to this entity that provides additional debug information, and is displayed after the common widget.
   */
  readonly debugComponentClass?: Maybe<Type<unknown>>;
}

/**
 * Configuration provided in the root module for configuring entries.
 */
export abstract class DbxFirebaseModelEntitiesWidgetServiceConfig {
  /**
   * Entries to register.
   */
  abstract entries: DbxFirebaseModelEntitiesWidgetEntry[];
  /**
   * The default "common" widget component used for all entities.
   */
  abstract commonComponentClass?: Maybe<Type<unknown>>;
  /**
   * The default "debug" widget component used for all entities.
   */
  abstract debugComponentClass?: Maybe<Type<unknown>>;
}

/**
 * Service used to register widgets used for model entities.
 */
@Injectable()
export class DbxFirebaseModelEntitiesWidgetService {
  private _commonComponentClass: Maybe<Type<unknown>>;
  private _debugComponentClass: Maybe<Type<unknown>>;

  private readonly _entries = new Map<FirestoreModelIdentity, DbxFirebaseModelEntitiesWidgetEntry>();

  constructor(@Optional() @Inject(DbxFirebaseModelEntitiesWidgetServiceConfig) initialConfig?: DbxFirebaseModelEntitiesWidgetServiceConfig) {
    this._commonComponentClass = initialConfig?.commonComponentClass;
    this._debugComponentClass = initialConfig?.debugComponentClass;

    if (initialConfig?.entries) {
      this.register(initialConfig.entries);
    }
  }

  getCommonComponentClass(): Maybe<Type<unknown>> {
    return this._commonComponentClass;
  }

  setCommonComponentClass(componentClass: Maybe<Type<unknown>>): void {
    this._commonComponentClass = componentClass;
  }

  getDebugComponentClass(): Maybe<Type<unknown>> {
    return this._debugComponentClass;
  }

  setDebugComponentClass(componentClass: Maybe<Type<unknown>>): void {
    this._debugComponentClass = componentClass;
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

  getWidgetEntry(identity: FirestoreModelIdentity): DbxFirebaseModelEntitiesWidgetEntry {
    const entry = this._entries.get(identity);

    return entry
      ? {
          ...entry,
          commonComponentClass: entry.commonComponentClass ?? this._commonComponentClass,
          debugComponentClass: entry.debugComponentClass ?? this._debugComponentClass
        }
      : {
          identity,
          commonComponentClass: this._commonComponentClass,
          debugComponentClass: this._debugComponentClass
        };
  }

  getWidgetEntries(identities: Iterable<FirestoreModelIdentity>): DbxFirebaseModelEntitiesWidgetEntry[] {
    return filterMaybeArrayValues(mapIterable(identities ?? [], (x) => this.getWidgetEntry(x)));
  }
}
