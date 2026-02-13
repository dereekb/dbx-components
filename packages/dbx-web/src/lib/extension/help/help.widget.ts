import { InjectionToken, type Type } from '@angular/core';
import { type GetterOrValue, type Maybe } from '@dereekb/util';
import { type DbxHelpContextKey } from './help';

/**
 * Entry defining a help widget for a specific context
 */
export interface DbxHelpWidgetServiceEntry<D = unknown> {
  /**
   * Help context string specific to this entry.
   */
  readonly helpContextKey: DbxHelpContextKey;
  /**
   * Title/Label for the help topic.
   */
  readonly title: string;
  /**
   * Icon for the help topic, if applicable.
   */
  readonly icon?: Maybe<string>;
  /**
   * Arbitrary metadata associated with the entry.
   */
  readonly meta?: Maybe<D>;
  /**
   * The priority to use when sorting the entities.
   *
   * Higher values are displayed first in the list.
   */
  readonly sortPriority?: Maybe<number>;
  /**
   * Custom help widget component class to use.
   *
   * The component will receive the context string as data.
   */
  readonly widgetComponentClass: GetterOrValue<Type<unknown>>;
  /**
   * Custom header component class to use that shows up on the widget.
   *
   * The component will receive the context string as data.
   */
  readonly headerComponentClass?: GetterOrValue<Maybe<Type<unknown>>>;
}

// MARK: Injection
export interface DbxHelpWidgetEntryData<D = unknown> {
  /**
   * Corresponding widget entry.
   */
  readonly helpWidgetEntry: DbxHelpWidgetServiceEntry<D>;
}

/**
 * Injection token for DbxHelpWidgetData.
 */
export const DBX_HELP_WIDGET_ENTRY_DATA_TOKEN = new InjectionToken<DbxHelpWidgetEntryData>('DbxHelpWidgetEntryData');
