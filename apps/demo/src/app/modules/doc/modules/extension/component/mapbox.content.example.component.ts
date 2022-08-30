import { Inject, Optional, Component } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';

export interface DocExtensionMapboxContentExampleData {}

@Component({
  template: `
    <div style="width: 340px;">
      <dbx-content-border>
        <p>Example Content</p>
      </dbx-content-border>
    </div>
  `
})
export class DocExtensionMapboxContentExampleComponent {
  constructor(@Optional() @Inject(DBX_INJECTION_COMPONENT_DATA) readonly data?: DocExtensionMapboxContentExampleData) {}
}
