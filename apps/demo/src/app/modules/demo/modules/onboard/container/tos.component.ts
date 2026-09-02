import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';

@Component({
  template: `
    <dbx-content-box>
      <p>Onboard ToS</p>
    </dbx-content-box>
  `,
  imports: [DbxContentBoxDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoOnboardTosComponent {}
