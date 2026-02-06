import { Directive, inject } from '@angular/core';
import { DBX_HELP_WIDGET_ENTRY_DATA_TOKEN } from './help.widget';
import { DbxHelpContextString } from './help';

/**
 * Abstract help widget directive that injects the help widget data.
 */
@Directive({})
export abstract class DbxAbstractHelpWidgetDirective {
  readonly helpWidgetData = inject(DBX_HELP_WIDGET_ENTRY_DATA_TOKEN);
  readonly helpWidgetEntry = this.helpWidgetData.helpWidgetEntry;

  get helpContextString(): DbxHelpContextString {
    return this.helpWidgetEntry.helpContextString;
  }
}
