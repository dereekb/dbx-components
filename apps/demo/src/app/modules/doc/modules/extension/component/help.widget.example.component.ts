import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { DbxHelpContextKey } from '@dereekb/dbx-web';

export const HELP_WIDGET_EXAMPLE_CONTEXT_STRING: DbxHelpContextKey = 'example';

/**
 * Example help widget for user profile
 */
@Component({
  selector: 'doc-extension-help-user-profile-widget',
  template: `
    <div>
      <p>This is the user profile section where you can:</p>
      <ul>
        <li>Update your personal information</li>
        <li>Change your profile picture</li>
        <li>Manage your account settings</li>
      </ul>
    </div>
  `,
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionHelpExampleWidgetComponent {}
