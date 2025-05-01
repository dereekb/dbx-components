import { Component } from '@angular/core';
import { DbxContentBoxDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.box.directive';

@Component({
    template: `
    <dbx-content-box>
      <p>Onboard ToS</p>
    </dbx-content-box>
  `,
    standalone: true,
    imports: [DbxContentBoxDirective]
})
export class DemoOnboardTosComponent {}
