import { Inject, Optional, Component } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';

export interface DocExtensionMapboxContentExampleData {}

@Component({
  template: `
    <div style="width: 400px;">
      <dbx-content-border>
        <p>Example Content</p>
        <p class="dbx-hint">The width of this content is set to 400px, but the max width is controlled by the --dbx-mapbox-min-width-var variable, or defaults to the width of the drawer button.</p>
      </dbx-content-border>
    </div>
  `
})
export class DocExtensionMapboxContentExampleComponent {
  constructor(@Optional() @Inject(DBX_INJECTION_COMPONENT_DATA) readonly data?: DocExtensionMapboxContentExampleData) {}
}
