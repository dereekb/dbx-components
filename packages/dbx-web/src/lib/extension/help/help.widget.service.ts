import { inject, Injectable, type Type } from '@angular/core';
import { type ArrayOrValue, type Maybe, asArray, cachedGetter, mapIterable } from '@dereekb/util';
import { type DbxHelpContextKey } from './help';
import { type DbxHelpWidgetServiceEntry } from './help.widget';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';

/**
 * Abstract configuration class for providing initial settings to the {@link DbxHelpWidgetService}, including default entries, icons, and component configs.
 */
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

  constructor() {
    const initialConfig = inject(DbxHelpWidgetServiceConfig, { optional: true });
    this.setDefaultWidgetComponentClass(initialConfig?.defaultWidgetComponentClass);
    this.setDefaultIcon(initialConfig?.defaultIcon);
    this.setPopoverHeaderComponentConfig(initialConfig?.popoverHeaderComponentConfig);
    this.setHelpListHeaderComponentConfig(initialConfig?.helpListHeaderComponentConfig);
    this.setHelpListFooterComponentConfig(initialConfig?.helpListFooterComponentConfig);

    if (initialConfig?.entries) {
      this.register(initialConfig.entries);
    }
  }

  /**
   * Returns the component class used for unrecognized help context keys.
   *
   * @returns The default widget component class, or undefined if not set
   */
  getDefaultWidgetComponentClass(): Maybe<Type<unknown>> {
    return this._defaultWidgetComponentClass;
  }

  setDefaultWidgetComponentClass(componentClass: Maybe<Type<unknown>>): void {
    this._defaultWidgetComponentClass = componentClass;
  }

  /**
   * Returns the default icon used for help entries without a specific icon.
   *
   * @returns The default icon string, or undefined if not set
   */
  getDefaultIcon(): Maybe<string> {
    return this._defaultIcon;
  }

  setDefaultIcon(icon: Maybe<string>): void {
    this._defaultIcon = icon;
  }

  /**
   * Returns the component config displayed in the popover header, if set.
   *
   * @returns The popover header component config, or undefined if not set
   */
  getPopoverHeaderComponentConfig(): Maybe<DbxInjectionComponentConfig> {
    return this._popoverHeaderComponentConfig;
  }

  setPopoverHeaderComponentConfig(componentConfig: Maybe<DbxInjectionComponentConfig>): void {
    this._popoverHeaderComponentConfig = componentConfig;
  }

  /**
   * Returns the component config displayed at the top of the help list view, if set.
   *
   * @returns The help list header component config, or undefined if not set
   */
  getHelpListHeaderComponentConfig(): Maybe<DbxInjectionComponentConfig> {
    return this._helpListHeaderComponentConfig;
  }

  setHelpListHeaderComponentConfig(componentConfig: Maybe<DbxInjectionComponentConfig>): void {
    this._helpListHeaderComponentConfig = componentConfig;
  }

  /**
   * Returns the component config displayed at the bottom of the help list view, if set.
   *
   * @returns The help list footer component config, or undefined if not set
   */
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
   * @returns Always returns true after registration completes
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
  /**
   * Returns all currently registered help context keys.
   *
   * @returns Array of all registered help context keys
   */
  getAllRegisteredHelpContextKeys(): DbxHelpContextKey[] {
    return [...this._entries.keys()];
  }

  /**
   * Retrieves the widget entry for a given help context key. Falls back to a default entry if a default widget component class is configured.
   *
   * @param helpContextKey - The help context key to look up
   * @returns The matching widget entry, a default entry if a default component class is configured, or undefined
   */
  getHelpWidgetEntry(helpContextKey: DbxHelpContextKey): Maybe<DbxHelpWidgetServiceEntry> {
    return this._entries.get(helpContextKey) ?? (this._defaultWidgetComponentClass ? { helpContextKey, title: '<Missing Help Topic>', widgetComponentClass: this._defaultWidgetComponentClass } : undefined);
  }

  /**
   * Retrieves widget entries for multiple help context keys, filtering out any unresolvable keys.
   *
   * @param helpContextKeys - Array of help context keys to look up
   * @returns Array of resolved widget entries, excluding any keys that could not be resolved
   */
  getHelpWidgetEntriesForHelpContextKeys(helpContextKeys: DbxHelpContextKey[]): DbxHelpWidgetServiceEntry[] {
    return helpContextKeys.map((context) => this.getHelpWidgetEntry(context)).filter((entry) => !!entry) as DbxHelpWidgetServiceEntry[];
  }

  /**
   * Checks whether a widget entry is registered for the given help context key.
   *
   * @param context - The help context key to check
   * @returns True if a widget entry exists for the given key
   */
  hasHelpWidgetEntry(context: DbxHelpContextKey): boolean {
    return this._entries.has(context);
  }

  /**
   * Returns a cached map of help context keys to their sort priority values.
   *
   * @returns Map of help context keys to their numeric sort priorities
   */
  getSortPriorityMap() {
    return this._sortPriorityMap();
  }
}
