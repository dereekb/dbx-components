import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'doc-extension-help-list-bottom-example',
  template: `
    <div class="text-center">
      <p class="dbx-hint dbx-small">This is an example component that shows up at the bottom of the help list. It is configured in DbxHelpWidgetServiceConfig.</p>
    </div>
  `,
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionHelpListBottomExampleComponent {}
