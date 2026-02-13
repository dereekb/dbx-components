import { Inject, Injectable, Optional, Type } from '@angular/core';
import { ArrayOrValue, Maybe, asArray, cachedGetter, mapIterable } from '@dereekb/util';
import { DbxHelpContextKey } from './help';
import { DbxHelpWidgetServiceEntry } from './help.widget';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

export abstract class DbxHelpWidgetServiceConfig {
  /**
   * All help widget service entries.
   */
  abstract readonly entries?: Maybe<DbxHelpWidgetServiceEntry[]>;
  /**
   * Default icon to use for unknown help topics.
   */
  abstract readonly defaultIcon?: Maybe<string>;
  /**
   * Default/Unknown help topic component class.
   */
  abstract readonly defaultWidgetComponentClass?: Maybe<Type<unknown>>;
  /**
   * Optional header component class to use for the list view.
   */
  abstract readonly helpListHeaderComponentConfig?: Maybe<DbxInjectionComponentConfig>;
  /**
   * Optional footer component class to use for the list view.
   */
  abstract readonly helpListFooterComponentConfig?: Maybe<DbxInjectionComponentConfig>;
  /**
   * Optional header component class to use for the popover view.
   */
  abstract readonly popoverHeaderComponentConfig?: Maybe<DbxInjectionComponentConfig>;
}

/**
 * Service used to register help widgets.
 *
 * Similar to DbxErrorWidgetService, this maintains a registry of help widgets
 * that can be displayed for specific help context strings.
 */
@Injectable()
export class DbxHelpWidgetService {
  private readonly _entries = new Map<DbxHelpContextKey, DbxHelpWidgetServiceEntry>();

  private readonly _sortPriorityMap = cachedGetter(() => {
    return new Map<DbxHelpContextKey, number>(mapIterable(this._entries.values(), (entry) => [entry.helpContextKey, entry.sortPriority ?? -1]));
  });

  private _defaultWidgetComponentClass: Maybe<Type<unknown>>;
  private _helpListHeaderComponentConfig: Maybe<DbxInjectionComponentConfig>;
  private _helpListFooterComponentConfig: Maybe<DbxInjectionComponentConfig>;

  private _defaultIcon: Maybe<string>;
  private _popoverHeaderComponentConfig: Maybe<DbxInjectionComponentConfig>;

  constructor(@Optional() @Inject(DbxHelpWidgetServiceConfig) initialConfig?: DbxHelpWidgetServiceConfig) {
    this.setDefaultWidgetComponentClass(initialConfig?.defaultWidgetComponentClass);
    this.setDefaultIcon(initialConfig?.defaultIcon);
    this.setPopoverHeaderComponentConfig(initialConfig?.popoverHeaderComponentConfig);
    this.setHelpListHeaderComponentConfig(initialConfig?.helpListHeaderComponentConfig);
    this.setHelpListFooterComponentConfig(initialConfig?.helpListFooterComponentConfig);

    if (initialConfig?.entries) {
      this.register(initialConfig.entries);
    }
  }

  getDefaultWidgetComponentClass(): Maybe<Type<unknown>> {
    return this._defaultWidgetComponentClass;
  }

  setDefaultWidgetComponentClass(componentClass: Maybe<Type<unknown>>): void {
    this._defaultWidgetComponentClass = componentClass;
  }

  getDefaultIcon(): Maybe<string> {
    return this._defaultIcon;
  }

  setDefaultIcon(icon: Maybe<string>): void {
    this._defaultIcon = icon;
  }

  getPopoverHeaderComponentConfig(): Maybe<DbxInjectionComponentConfig> {
    return this._popoverHeaderComponentConfig;
  }

  setPopoverHeaderComponentConfig(componentConfig: Maybe<DbxInjectionComponentConfig>): void {
    this._popoverHeaderComponentConfig = componentConfig;
  }

  getHelpListHeaderComponentConfig(): Maybe<DbxInjectionComponentConfig> {
    return this._helpListHeaderComponentConfig;
  }

  setHelpListHeaderComponentConfig(componentConfig: Maybe<DbxInjectionComponentConfig>): void {
    this._helpListHeaderComponentConfig = componentConfig;
  }

  getHelpListFooterComponentConfig(): Maybe<DbxInjectionComponentConfig> {
    return this._helpListFooterComponentConfig;
  }

  setHelpListFooterComponentConfig(componentConfig: Maybe<DbxInjectionComponentConfig>): void {
    this._helpListFooterComponentConfig = componentConfig;
  }

  /**
   * Used to register one or more entries.
   *
   * If an entry with the same identity is already registered, this will override it by default.
   *
   * @param entries The entries to register
   * @param override Whether to override existing entries (default: true)
   */
  register(entries: ArrayOrValue<DbxHelpWidgetServiceEntry>, override: boolean = true): boolean {
    const entriesArray = asArray(entries);

    entriesArray.forEach((entry) => {
      if (override || !this._entries.has(entry.helpContextKey)) {
        this._entries.set(entry.helpContextKey, entry);
      }
    });

    return true;
  }

  // MARK: Get
  getAllRegisteredHelpContextKeys(): DbxHelpContextKey[] {
    return Array.from(this._entries.keys());
  }

  getHelpWidgetEntry(helpContextKey: DbxHelpContextKey): Maybe<DbxHelpWidgetServiceEntry> {
    return this._entries.get(helpContextKey) ?? (this._defaultWidgetComponentClass ? { helpContextKey, title: '<Missing Help Topic>', widgetComponentClass: this._defaultWidgetComponentClass } : undefined);
  }

  getHelpWidgetEntriesForHelpContextKeys(helpContextKeys: DbxHelpContextKey[]): DbxHelpWidgetServiceEntry[] {
    return helpContextKeys.map((context) => this.getHelpWidgetEntry(context)).filter((entry) => !!entry) as DbxHelpWidgetServiceEntry[];
  }

  hasHelpWidgetEntry(context: DbxHelpContextKey): boolean {
    return this._entries.has(context);
  }

  getSortPriorityMap() {
    return this._sortPriorityMap();
  }
}
