import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { DbxAbstractHelpWidgetDirective, DbxButtonComponent, DbxHelpContextString } from '@dereekb/dbx-web';

export const HELP_WIDGET_EXAMPLE_CONTEXT_STRING: DbxHelpContextString = 'example';

/**
 * Example help widget for user profile
 */
@Component({
  selector: 'doc-extension-help-user-profile-widget-header',
  template: `
    <dbx-button icon="live_help">{{ helpContextString }}</dbx-button>
  `,
  standalone: true,
  imports: [MatIcon, DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionHelpExampleWidgetExampleHeaderComponent extends DbxAbstractHelpWidgetDirective {}
