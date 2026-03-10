import { Directive, inject } from '@angular/core';
import { DBX_HELP_WIDGET_ENTRY_DATA_TOKEN, type DbxHelpWidgetEntryData } from './help.widget';
import { type DbxHelpContextKey } from './help';

/**
 * Abstract base directive for help widget components that automatically injects the {@link DbxHelpWidgetEntryData} for the current help context.
 * Subclasses can access the widget entry and its associated help context key.
 *
 * @example
 * ```typescript
 * @Directive()
 * class MyHelpWidget extends AbstractDbxHelpWidgetDirective<MyData> {
 *   // Access this.helpWidgetData, this.helpWidgetEntry, this.helpContextKey
 * }
 * ```
 */
@Directive({})
export abstract class AbstractDbxHelpWidgetDirective<D = unknown> {
  readonly helpWidgetData = inject<DbxHelpWidgetEntryData<D>>(DBX_HELP_WIDGET_ENTRY_DATA_TOKEN);
  readonly helpWidgetEntry = this.helpWidgetData.helpWidgetEntry;

  get helpContextKey(): DbxHelpContextKey {
    return this.helpWidgetEntry.helpContextKey;
  }
}
