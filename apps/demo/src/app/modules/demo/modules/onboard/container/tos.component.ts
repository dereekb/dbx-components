import { Component } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';

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
