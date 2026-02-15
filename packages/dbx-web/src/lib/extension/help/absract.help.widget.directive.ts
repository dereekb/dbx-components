import { Directive, inject } from '@angular/core';
import { DBX_HELP_WIDGET_ENTRY_DATA_TOKEN, DbxHelpWidgetEntryData } from './help.widget';
import { DbxHelpContextKey } from './help';

/**
 * Abstract help widget directive that injects the help widget data.
 */
@Directive({})
export abstract class AbstractDbxHelpWidgetDirective<D = unknown> {
  readonly helpWidgetData = inject<DbxHelpWidgetEntryData<D>>(DBX_HELP_WIDGET_ENTRY_DATA_TOKEN);
  readonly helpWidgetEntry = this.helpWidgetData.helpWidgetEntry;

  get helpContextKey(): DbxHelpContextKey {
    return this.helpWidgetEntry.helpContextKey;
  }
}
