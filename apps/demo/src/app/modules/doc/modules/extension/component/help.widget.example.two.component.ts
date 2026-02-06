import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { DbxHelpContextString } from '@dereekb/dbx-web';

export const HELP_WIDGET_EXAMPLE_CONTEXT_STRING_TWO: DbxHelpContextString = 'example-two';

/**
 * Example help widget for user profile
 */
@Component({
  selector: 'doc-extension-help-user-profile-widget-two',
  template: `
    <div>
      <p>This is a second help example widget.</p>
    </div>
  `,
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionHelpExampleWidgetTwoComponent {}
