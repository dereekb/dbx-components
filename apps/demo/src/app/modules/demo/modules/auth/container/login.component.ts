import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DemoAuthLoginViewComponent } from './login.view.component';

@Component({
  template: `
    <dbx-content-box>
      <app-login-view></app-login-view>
    </dbx-content-box>
  `,
  imports: [DbxContentBoxDirective, DemoAuthLoginViewComponent]
})
export class DemoAuthLoginComponent {}
