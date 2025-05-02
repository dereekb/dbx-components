import { Component } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DemoAuthLoginViewComponent } from './login.view.component';

@Component({
  template: `
    <dbx-content-box>
      <demo-login-view></demo-login-view>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DemoAuthLoginViewComponent]
})
export class DemoAuthLoginComponent {}
