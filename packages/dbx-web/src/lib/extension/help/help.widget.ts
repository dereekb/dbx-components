import { InjectionToken, Type } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxHelpContextString } from './help';

/**
 * Entry defining a help widget for a specific context
 */
export interface DbxHelpWidgetServiceEntry {
  /**
   * Help context string specific to this entry.
   */
  readonly helpContextString: DbxHelpContextString;
  /**
   * Title/Label for the help topic.
   */
  readonly title: string;
  /**
   * Icon for the help topic, if applicable.
   */
  readonly icon?: Maybe<string>;
  /**
   * Custom help widget component class to use.
   *
   * The component will receive the context string as data.
   */
  readonly widgetComponentClass: Type<unknown>;
  /**
   * Custom header component class to use that shows up on the widget.
   *
   * The component will receive the context string as data.
   */
  readonly headerComponentClass?: Maybe<Type<unknown>>;
}

// MARK: Injection
export interface DbxHelpWidgetEntryData {
  /**
   * Corresponding widget entry.
   */
  readonly helpWidgetEntry: DbxHelpWidgetServiceEntry;
}

/**
 * Injection token for DbxHelpWidgetData.
 */
export const DBX_HELP_WIDGET_ENTRY_DATA_TOKEN = new InjectionToken<DbxHelpWidgetEntryData>('DbxHelpWidgetEntryData');
